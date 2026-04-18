/**
 * routes/api.js — API Route Definitions
 *
 * This file wires HTTP paths to their middleware and controller handlers.
 * It uses an Express Router so routes can be mounted at any prefix in app.js
 * without hardcoding the full path here.
 *
 * WHY MIDDLEWARE IS APPLIED AT THE ROUTE LEVEL:
 * Attaching rateLimiter directly to a specific route (rather than globally via
 * app.use()) gives us fine-grained control. The health-check route (GET /)
 * must remain unrestricted so load balancers and monitoring tools can always
 * reach it — applying rate limiting globally would block those too. Route-level
 * middleware keeps each route's concerns explicit and easy to reason about.
 */

'use strict';

const { Router } = require('express');
const rateLimiter = require('../middleware/rateLimiter');
const testController = require('../controllers/testController');

const router = Router();

/**
 * GET /
 * Health check — no rate limiting applied.
 *
 * Load balancers and uptime monitors hit this endpoint frequently to verify
 * the server is alive. Rate limiting here would cause false "down" alerts, so
 * we intentionally omit the rateLimiter middleware on this route.
 */
router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * GET /api/test
 * Sample endpoint that demonstrates the rate limiter in action.
 *
 * Middleware chain (left → right):
 *   1. rateLimiter — checks the sliding window, sets X-RateLimit-* headers,
 *      and either calls next() (allowed) or returns 429 (blocked).
 *   2. testController.test — only reached when rateLimiter calls next();
 *      reads the headers set by the middleware and returns a 200 JSON response.
 *
 * Applying rateLimiter here (route level) rather than globally means only
 * this route is subject to the 5-requests-per-10-seconds constraint.
 * Requirements: 6.1, 6.3
 */
router.get('/api/test', rateLimiter, testController.test);
 
module.exports = router;
