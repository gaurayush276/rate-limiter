# Requirements Document

## Introduction

A beginner-friendly Rate Limiter backend project built with Node.js and Express. The system limits each user (identified by IP address) to 5 requests per 10-second window using the Sliding Window technique with in-memory storage. The project is structured to teach beginners how rate limiting works internally, with detailed comments explaining every concept.

## Glossary

- **Rate_Limiter**: The middleware component that tracks and enforces request limits per user
- **Sliding_Window**: A rate limiting algorithm that tracks requests within a rolling time window rather than fixed intervals
- **Client**: A user identified by their IP address making HTTP requests
- **Request_Log**: The in-memory record of timestamps for each client's recent requests
- **Store**: A JavaScript Map used to hold per-IP request timestamp arrays
- **Window**: The 10-second time period within which requests are counted
- **Limit**: The maximum number of requests (5) allowed per Client per Window

## Requirements

### Requirement 1: Project Structure

**User Story:** As a beginner developer, I want a well-organized project structure, so that I can understand how a real Node.js backend is laid out.

#### Acceptance Criteria

1. THE Rate_Limiter project SHALL contain the following folders: `controllers/`, `middleware/`, `routes/`, `utils/`
2. THE Rate_Limiter project SHALL contain an `app.js` file that wires all components together
3. THE Rate_Limiter project SHALL contain a `server.js` file that starts the HTTP server
4. WHEN a developer opens any file, THE Rate_Limiter project SHALL include comments explaining the purpose of each folder and file

---

### Requirement 2: In-Memory Store

**User Story:** As a beginner developer, I want to understand why and how a Map is used for storage, so that I can learn the data structure behind rate limiting.

#### Acceptance Criteria

1. THE Store SHALL use a JavaScript `Map` where each key is a Client IP string and each value is an array of request timestamps
2. WHEN a new Client makes a request, THE Store SHALL create a new entry with an empty timestamp array for that Client
3. WHEN a Client already exists in the Store, THE Store SHALL append the current timestamp to that Client's array
4. THE Store SHALL include comments explaining why `Map` is preferred over a plain object for this use case (O(1) lookup, key flexibility)

---

### Requirement 3: Sliding Window Algorithm

**User Story:** As a beginner developer, I want to understand how the sliding window algorithm works, so that I can explain it in interviews and implement it myself.

#### Acceptance Criteria

1. WHEN a request arrives, THE Rate_Limiter SHALL record the current timestamp in milliseconds
2. WHEN processing a request, THE Rate_Limiter SHALL remove all timestamps from the Client's log that are older than `currentTime - windowSizeMs` (10,000 ms)
3. AFTER removing stale timestamps, THE Rate_Limiter SHALL count the remaining timestamps to determine how many requests the Client has made in the current window
4. THE Rate_Limiter SHALL include comments explaining the time complexity of the sliding window cleanup (O(n) per request where n is the number of timestamps in the window)
5. THE Rate_Limiter SHALL include comments explaining the difference between sliding window and fixed window approaches

---

### Requirement 4: Request Limiting

**User Story:** As a backend developer, I want the system to enforce a 5-requests-per-10-seconds limit per IP, so that no single client can overwhelm the server.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL allow a maximum of 5 requests per Client within any 10-second sliding window
2. WHEN a Client's request count within the window is less than 5, THE Rate_Limiter SHALL call `next()` to pass the request to the route handler
3. WHEN a Client's request count within the window reaches or exceeds 5, THE Rate_Limiter SHALL return HTTP status 429
4. WHEN returning HTTP 429, THE Rate_Limiter SHALL include a JSON response body with a descriptive message explaining the limit and when to retry
5. THE Rate_Limiter SHALL set the `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` response headers on every response

---

### Requirement 5: Client Identification

**User Story:** As a backend developer, I want each client to be identified by their IP address, so that rate limits are applied per user.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL extract the Client IP from `req.ip` or `req.headers['x-forwarded-for']` as a fallback
2. WHEN the IP cannot be determined, THE Rate_Limiter SHALL use the string `"unknown"` as the Client key
3. THE Rate_Limiter SHALL include a comment explaining why `x-forwarded-for` is needed when the app runs behind a proxy or load balancer

---

### Requirement 6: Sample Route

**User Story:** As a beginner developer, I want a working sample route to test the rate limiter against, so that I can see it in action immediately.

#### Acceptance Criteria

1. THE project SHALL expose a `GET /api/test` route
2. WHEN a request to `GET /api/test` is within the rate limit, THE server SHALL respond with HTTP 200 and a JSON body containing a success message and the Client's IP
3. THE `rateLimiter` middleware SHALL be applied to the `/api/test` route before the route handler executes
4. THE project SHALL include a `GET /` health check route that returns HTTP 200 without rate limiting

---

### Requirement 7: Educational Comments and Documentation

**User Story:** As a beginner developer, I want every non-obvious line of code to be explained with a comment, so that I can learn by reading the code.

#### Acceptance Criteria

1. THE Rate_Limiter middleware file SHALL include a block comment at the top explaining the sliding window concept in plain English
2. THE Store utility file SHALL include comments explaining why `Map` is used, its time complexity, and its memory trade-offs
3. THE project SHALL include a `README.md` with: setup instructions, how to run the server, how to test with `curl` and Postman, and an explanation of the three rate limiting algorithms (Fixed Window, Sliding Window, Token Bucket)
4. THE README SHALL include a section explaining how this system would scale using Redis

---

### Requirement 8: Error Handling and Edge Cases

**User Story:** As a backend developer, I want the rate limiter to handle edge cases gracefully, so that the server remains stable under unexpected conditions.

#### Acceptance Criteria

1. IF the Store lookup throws an unexpected error, THEN THE Rate_Limiter SHALL catch it, log it to the console, and call `next()` to avoid blocking legitimate traffic
2. WHEN the server restarts, THE Store SHALL reset to empty (in-memory only — no persistence required)
3. THE Rate_Limiter SHALL handle concurrent requests from the same IP without corrupting the timestamp array (single-threaded Node.js event loop guarantees this — the code SHALL include a comment explaining why)
