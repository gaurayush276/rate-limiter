/**
 * app.js — Express Application Setup
 *
 * This file creates and configures the Express app: registering middleware
 * and mounting routes. It does NOT start the HTTP server — that lives in
 * server.js. Keeping these two concerns separate means tests can import the
 * app directly (via supertest) without binding to a real port.
 *
 * Requirements: 1.2
 */

'use strict';

const express = require('express');
const apiRouter = require('./routes/api');

const app = express();

/**
 * express.json() — Body-parsing middleware
 *
 * Parses incoming requests with a JSON Content-Type header and populates
 * req.body with the parsed object. Without this, req.body would be undefined
 * for POST/PUT requests that send JSON payloads. It must be registered before
 * any route handlers that need to read req.body.
 */
app.use(express.json());

/**
 * Mount the API router.
 *
 * All routes defined in routes/api.js (GET /, GET /api/test) are attached
 * here. Using a router keeps route definitions modular and out of app.js.
 */
app.use('/', apiRouter);

// Export the configured app so server.js can start it and tests can import it.
module.exports = app;
