/**
 * controllers/testController.js
 *
 * MVC Role — Controller:
 * In the MVC (Model-View-Controller) pattern, the Controller sits between the
 * route (which receives the HTTP request) and any data/business logic. Its job
 * is to read what the middleware and route have prepared, build a response, and
 * send it back to the client. It does NOT contain rate-limiting logic — that
 * already ran in the rateLimiter middleware before this function was called.
 */

/**
 * test — handler for GET /api/test
 *
 * By the time this runs, rateLimiter middleware has already:
 *   1. Checked the client's request count
 *   2. Set the X-RateLimit-Remaining header on `res`
 *   3. Called next() to allow the request through
 *
 * We simply read that header back and include it in the JSON response so the
 * client can see how many requests they have left in the current window.
 */
const test = (req, res) => {
  // Extract the client IP the same way the middleware does (req.ip is set by Express)
  const yourIP = req.headers['x-forwarded-for'] || req.ip || 'unknown';

  // Read the remaining-requests value that rateLimiter already placed on the response
  // 10  as base 
  const requestsRemaining = parseInt(res.getHeader('X-RateLimit-Remaining'), 10);

  res.status(200).json({
    success: true,
    message: 'Request successful!',
    yourIP,
    requestsRemaining,
  });
};

module.exports = { test };
