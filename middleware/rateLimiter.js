/**
 * middleware/rateLimiter.js — Sliding Window Rate Limiter
 *
 * HOW THE SLIDING WINDOW ALGORITHM WORKS (plain English):
 *
 * Imagine a 10-second window that moves forward in time with every request.
 * Instead of resetting a counter at a fixed clock tick (e.g. every :00 second),
 * we look back exactly 10 seconds from *right now* and count how many requests
 * arrived in that rolling period.
 *
 * Example:
 *   - Requests arrived at t=1s, t=3s, t=7s, t=9s (4 requests)
 *   - A new request arrives at t=12s
 *   - We look back to t=2s (12 - 10). Timestamps at t=1s and t=3s are now
 *     outside the window; t=7s, t=9s are still inside.
 *   - Count = 2, so the new request is allowed.
 *
 * This is fairer than a fixed window because a burst at the boundary of two
 * fixed windows (e.g. 5 requests at t=9.9s + 5 at t=10.1s) cannot sneak
 * through — the sliding window would see all 10 requests within 10 seconds.
 *
 * Node.js single-threaded safety:
 * JavaScript runs on a single-threaded event loop. All callbacks are processed
 * one at a time, so there is no true concurrency. Two requests from the same IP
 * cannot interleave their reads/writes to the timestamp array — one will always
 * complete before the other begins. This means we get race-condition-free
 * behaviour without any locks or mutexes.
 */

'use strict';

const store = require('../utils/store');

// Maximum number of requests a single client IP may make within one window.
const MAX_REQUESTS = 5;

// Length of the sliding window in milliseconds (10 seconds).
const WINDOW_SIZE_MS = 10 * 1000;

/**
 * rateLimiter — Express middleware that enforces the sliding window limit.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function rateLimiter(req, res, next) {
  try {
    // Record the current time once so every comparison in this request uses
    // the same "now" value (avoids tiny drift between multiple Date.now() calls).
    const now = Date.now();

    // --- Client IP extraction ---
    // req.ip is set by Express and works correctly when the app is accessed
    // directly. However, when the app runs behind a reverse proxy or load
    // balancer (e.g. Nginx, AWS ALB), the proxy forwards the original client
    // IP in the X-Forwarded-For header. Without this fallback, every request
    // would appear to come from the proxy's IP, making rate limiting useless.

 
    const clientIP =
    // use || ''  because localhost nginx does not exist so header is undefined 
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      'unknown';

    // --- Get or create the timestamp array for this IP ---
    // If this is the first request from this IP, initialise an empty array.
    if (!store.has(clientIP)) {
      store.set(clientIP, []);
    }
    const timestamps = store.get(clientIP);

    // --- Sliding window cleanup (this is the "sliding" part) ---
    // Remove all timestamps that fall outside the current window.
    // A timestamp is "stale" if it is older than (now - WINDOW_SIZE_MS).
    // After this filter, only requests from the last 10 seconds remain.
    //
    // Time complexity: O(k) where k = number of timestamps currently stored
    // for this IP. In practice k ≤ MAX_REQUESTS (5), so this is effectively
    // O(1). In the absolute worst case (many stale entries from a previous
    // burst) it is still bounded by the window size, not the total request
    // history.
    const windowStart = now - WINDOW_SIZE_MS;
    
    const recentTimestamps = timestamps.filter(ts => ts > windowStart);
  

    // Write the cleaned array back to the store so stale entries are removed.
    store.set(clientIP, recentTimestamps);

    const count = recentTimestamps.length;

    if (count < MAX_REQUESTS) {
      // --- Request is within the limit: allow it ---

      // Record this request's timestamp.
      recentTimestamps.push(now);

      // Set informational rate-limit headers so clients can track their quota.
      // X-RateLimit-Limit    → the hard cap per window
      // X-RateLimit-Remaining → how many requests are left after this one
      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
      res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - recentTimestamps.length);

      return next();
    } else {
      // --- Request exceeds the limit: reject with 429 ---

      // Calculate how many milliseconds until the oldest request in the window
      // expires, which is when the client will be able to make a new request.
      const oldestTimestamp = recentTimestamps[0];
      const retryAfterMs = oldestTimestamp + WINDOW_SIZE_MS - now;

      // Retry-After is specified in seconds (HTTP standard).
      res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));

      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `You have exceeded the limit of ${MAX_REQUESTS} requests per ${WINDOW_SIZE_MS / 1000} seconds. Please wait before retrying.`,
        retryAfterMs,
      });
    }
  } catch (err) {
    // --- Error safety net ---
    // If anything unexpected goes wrong (e.g. a corrupted store entry), we
    // log the error but still call next() so legitimate traffic is never
    // blocked by an internal bug in the rate limiter itself.
    console.error('[rateLimiter] Unexpected error:', err);
    return next();
  }
}

module.exports = rateLimiter;
