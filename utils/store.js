/**
 * utils/store.js — In-Memory Request Store
 *
 * This module exports a single shared Map instance used by the rate limiter
 * middleware to track request timestamps per client IP.
 *
 * Why Map instead of a plain object {}?
 *
 *  1. O(1) average-case performance: Map.get(), Map.set(), and Map.has() all
 *     run in O(1) time on average, just like a plain object — but Map is
 *     optimised by V8 specifically for dynamic key/value storage.
 *
 *  2. Key flexibility: Map keys can be any value (strings, numbers, objects).
 *     Plain objects coerce all keys to strings, which can cause subtle bugs
 *     if we ever switch from IP strings to richer key types.
 *
 *  3. No prototype collisions: A plain object inherits keys from
 *     Object.prototype (e.g. "constructor", "toString", "hasOwnProperty").
 *     If a client IP happened to match one of those names the lookup would
 *     return the prototype method instead of our data. Map has no such
 *     inherited keys — every key you find in it was explicitly set by us.
 *
 *  4. Built-in utilities: Map exposes .size, .forEach(), .entries(), and is
 *     directly iterable — handy for debugging and future cleanup tasks.
 *
 * Data shape:
 *   Map<string, number[]>
 *     key   → Client IP address (e.g. "192.168.1.1" or "unknown")
 *     value → Array of request timestamps in milliseconds (e.g. [1700000001000, 1700000003500])
 */

const store = new Map();

module.exports = store;
