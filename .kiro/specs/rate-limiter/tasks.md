# Implementation Plan: Rate Limiter

## Overview

Build the Rate Limiter project incrementally, starting from the project scaffold and working inward to the core algorithm, then wiring everything together. Each step produces runnable code so you can verify progress at every stage.

## Tasks

- [x] 1. Initialize project and install dependencies
  - Run `npm init -y` to create `package.json`
  - Install runtime dependencies: `express`
  - Install dev dependencies: `jest`, `supertest`, `fast-check`, `@jest/globals`
  - Add `"test": "jest"` script to `package.json`
  - Add `"start": "node server.js"` script to `package.json`
  - Create the folder structure: `controllers/`, `middleware/`, `routes/`, `utils/`
  - _Requirements: 1.1_

- [ ] 2. Create the in-memory store
  - [x] 2.1 Implement `utils/store.js`
    - Export a single shared `Map` instance
    - Add block comment explaining: why `Map` over plain object, O(1) lookup, key flexibility, no prototype collisions
    - _Requirements: 2.1, 2.4_

  - [ ]* 2.2 Write unit test for store initialization
    - Verify the exported value is a `Map` instance
    - Verify it starts empty (`.size === 0`)
    - _Requirements: 2.1_

- [ ] 3. Implement the sliding window rate limiter middleware
  - [x] 3.1 Implement `middleware/rateLimiter.js`
    - Define `WINDOW_SIZE_MS = 10 * 1000` and `MAX_REQUESTS = 5` as named constants with comments
    - Extract client IP from `req.ip` with `req.headers['x-forwarded-for']` fallback; default to `"unknown"`
    - Add comment explaining why `x-forwarded-for` is needed behind a proxy/load balancer
    - Get or create the timestamp array for the IP from the store
    - Filter out stale timestamps (older than `now - WINDOW_SIZE_MS`) — add comment explaining this is the "sliding" part
    - Add comment explaining O(k) time complexity where k = timestamps in window
    - If `count < MAX_REQUESTS`: push `now`, set `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers, call `next()`
    - If `count >= MAX_REQUESTS`: set `Retry-After` header, return 429 JSON with `success`, `error`, `message`, `retryAfterMs` fields
    - Wrap entire logic in try/catch — on error, log and call `next()` (never block traffic)
    - Add top-of-file block comment explaining the sliding window concept in plain English
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 8.1, 8.3_

  - [ ]* 3.2 Write property test for stale timestamp cleanup (Property 1)
    - **Property 1: Sliding window only counts recent timestamps**
    - **Validates: Requirements 3.2, 3.3**
    - Use `fast-check` to generate random arrays of timestamps spanning a 30-second range
    - Assert: after cleanup, no timestamp is older than `now - WINDOW_SIZE_MS`
    - `numRuns: 100`
    - `// Feature: rate-limiter, Property 1: Sliding window only counts recent timestamps`

  - [ ]* 3.3 Write property test for store never exceeding limit (Property 2)
    - **Property 2: Request count never exceeds the limit**
    - **Validates: Requirements 4.1, 4.3**
    - Generate random number of requests (1–20) from the same IP
    - Assert: `store.get(ip).length <= MAX_REQUESTS` after every request
    - `numRuns: 100`
    - `// Feature: rate-limiter, Property 2: Request count never exceeds the limit`

  - [ ]* 3.4 Write property test for allowed requests growing the array (Property 3)
    - **Property 3: Allowed requests increment the store**
    - **Validates: Requirements 4.2, 3.1**
    - Generate random IPs with 0–4 existing timestamps in window
    - Assert: array length increases by exactly 1 after a successful (non-429) request
    - `numRuns: 100`
    - `// Feature: rate-limiter, Property 3: Allowed requests increment the store`

  - [ ]* 3.5 Write property test for rejected requests not mutating the store (Property 4)
    - **Property 4: Rejected requests do not mutate the store**
    - **Validates: Requirements 4.3**
    - Generate IPs with exactly 5 timestamps in window
    - Assert: array length is unchanged after a rejected (429) request
    - `numRuns: 100`
    - `// Feature: rate-limiter, Property 4: Rejected requests do not mutate the store`

  - [ ]* 3.6 Write property test for idempotent cleanup (Property 5)
    - **Property 5: Stale timestamp removal is idempotent**
    - **Validates: Requirements 3.2**
    - Generate random timestamp arrays with a mix of old and recent entries
    - Assert: running cleanup twice produces the same result as running it once
    - `numRuns: 100`
    - `// Feature: rate-limiter, Property 5: Stale timestamp removal is idempotent`

  - [ ]* 3.7 Write property test for X-RateLimit-Remaining header consistency (Property 6)
    - **Property 6: X-RateLimit-Remaining is consistent with store**
    - **Validates: Requirements 4.5**
    - Generate random IPs with 0–4 existing timestamps
    - Assert: `X-RateLimit-Remaining` header value equals `MAX_REQUESTS - newCount`
    - `numRuns: 100`
    - `// Feature: rate-limiter, Property 6: X-RateLimit-Remaining is consistent with store`

  - [ ]* 3.8 Write unit tests for edge cases
    - Test: IP is `undefined` → key used is `"unknown"` (edge case for Requirements 5.2)
    - Test: store throws → middleware calls `next()` without crashing (edge case for Requirements 8.1)
    - Test: `"unknown"` IP is still rate-limited correctly (Property 7, Requirements 5.2)

- [x] 4. Checkpoint — Ensure all middleware tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement the route handler and routes
  - [x] 5.1 Implement `controllers/testController.js`
    - Export a `test` function: `(req, res) => { ... }`
    - Respond with HTTP 200 JSON: `{ success: true, message, yourIP, requestsRemaining }`
    - Read `requestsRemaining` from the `X-RateLimit-Remaining` response header (already set by middleware)
    - Add a comment explaining the controller's role in MVC
    - _Requirements: 6.1, 6.2_

  - [x] 5.2 Implement `routes/api.js`
    - Import `rateLimiter` middleware and `testController`
    - Register `GET /api/test` with `rateLimiter` applied before the controller
    - Register `GET /` as a health check returning `{ status: "ok" }` with no rate limiting
    - Add comments explaining why middleware is applied at the route level
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ]* 5.3 Write integration tests for routes
    - Use `supertest` to test against the Express app
    - Test: first 5 requests to `GET /api/test` return 200
    - Test: 6th request returns 429 with correct JSON body fields
    - Test: `GET /` always returns 200 regardless of request count
    - Test: `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers are present on 200 responses
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 4.4, 4.5_

- [ ] 6. Wire everything together in `app.js` and `server.js`
  - [x] 6.1 Implement `app.js`
    - Create Express app
    - Register `express.json()` middleware with a comment explaining what it does
    - Mount routes from `routes/api.js`
    - Export the app (needed for testing with supertest)
    - _Requirements: 1.2_

  - [x] 6.2 Implement `server.js`
    - Import `app` from `app.js`
    - Read `PORT` from `process.env.PORT` with fallback to `3000`
    - Start the server and log the URL
    - Add a comment explaining why `server.js` and `app.js` are separate (testability)
    - _Requirements: 1.3_

- [ ] 7. Write the README
  - [x] 7.1 Create `README.md` with the following sections:
    - **Setup**: `npm install`, `npm start`
    - **Testing with curl**: example commands showing 6 rapid requests and the 429 response
    - **Testing with Postman**: step-by-step instructions
    - **How it works**: plain-English explanation of the sliding window
    - **Algorithm Comparison**: Fixed Window vs Sliding Window vs Token Bucket (simple table + explanation)
    - **Scaling with Redis**: explain why in-memory doesn't work across multiple servers, how Redis `ZADD`/`ZREMRANGEBYSCORE` replaces the Map
    - _Requirements: 7.3, 7.4_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
