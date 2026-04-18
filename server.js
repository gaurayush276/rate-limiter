/**
 * server.js — HTTP Server Entry Point
 *
 * This file is intentionally separate from app.js. The separation exists for
 * testability: tests (e.g. with supertest) can import `app` directly without
 * ever binding to a real network port. server.js is only executed when you
 * actually want to run the server (e.g. `node server.js` or `npm start`).
 *
 * Requirements: 1.3
 */

'use strict';

const app = require('./app');

// Use the PORT environment variable if set (e.g. in production/Docker),
// otherwise fall back to 3000 for local development.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
