# Rate Limiter

A beginner-friendly Node.js + Express backend that demonstrates how rate limiting works internally using the **Sliding Window** algorithm. Each IP address is limited to **5 requests per 10 seconds**. Every non-obvious line of code is commented so you can learn by reading.

---

## Setup

```bash
npm install
npm start
```

The server starts on `http://localhost:3000`.

---

## Testing with curl

Send 6 rapid requests to see the rate limiter in action. The first 5 succeed; the 6th is blocked.

```bash
# Run all 6 requests back-to-back
for i in {1..6}; do
  echo "--- Request $i ---"
  curl -s -i http://localhost:3000/api/test
  echo
done
```

Or send them individually:

```bash
curl -i http://localhost:3000/api/test   # 200 OK  (1/5)
curl -i http://localhost:3000/api/test   # 200 OK  (2/5)
curl -i http://localhost:3000/api/test   # 200 OK  (3/5)
curl -i http://localhost:3000/api/test   # 200 OK  (4/5)
curl -i http://localhost:3000/api/test   # 200 OK  (5/5)
curl -i http://localhost:3000/api/test   # 429 Too Many Requests
```

Expected 429 response:

```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "You have exceeded the limit of 5 requests per 10 seconds. Please wait before retrying.",
  "retryAfterMs": 9821
}
```

The `Retry-After` header tells you how many seconds to wait before trying again.

---

## Testing with Postman

1. Open Postman and create a new request.
2. Set the method to **GET** and the URL to `http://localhost:3000/api/test`.
3. Click **Send** — you should see a `200 OK` response with a JSON body.
4. Check the **Headers** tab in the response panel. You'll see:
   - `X-RateLimit-Limit: 5`
   - `X-RateLimit-Remaining: 4` (decrements with each request)
5. Click **Send** four more times (5 total). The last allowed response will show `X-RateLimit-Remaining: 0`.
6. Click **Send** a 6th time — you'll receive a `429 Too Many Requests` response with a `Retry-After` header.
7. Wait the number of seconds shown in `Retry-After`, then send again — it will succeed.

> Tip: Use Postman's **Runner** (Collection Runner) to automate sending multiple requests in sequence.

---

## How It Works

### The Sliding Window Algorithm

Instead of resetting a counter at a fixed clock tick (e.g. every 10 seconds on the dot), the sliding window looks back exactly 10 seconds from *right now* and counts how many requests arrived in that rolling period.

**Step by step for each incoming request:**

1. Record the current time (`Date.now()` in milliseconds).
2. Look up the client's IP in the store and retrieve their timestamp array.
3. Remove any timestamps older than `now - 10,000 ms` — these are outside the window.
4. Count the remaining timestamps. That's how many requests this client has made in the last 10 seconds.
5. If the count is **less than 5**: record this request's timestamp and let it through (`next()`).
6. If the count is **5 or more**: return `429` and tell the client when to retry.

**Why is this fairer than a fixed window?**

With a fixed window, a client could send 5 requests at `t=9.9s` and another 5 at `t=10.1s` — 10 requests in 0.2 seconds — and both batches would be allowed because they fall in different fixed windows. The sliding window sees all 10 requests within a 10-second span and blocks the second burst.

**In-memory storage:**

Each client's timestamps are stored in a JavaScript `Map` keyed by IP address:

```
"192.168.1.1" → [1700000001000, 1700000003500, 1700000007200]
"::1"         → [1700000009000]
```

When the server restarts, the Map is cleared and all windows reset — this is by design for a learning project.

---

## Algorithm Comparison

| Algorithm | How it works | Pros | Cons |
|---|---|---|---|
| **Fixed Window** | Divide time into fixed slots (e.g. 0–10s, 10–20s). Reset counter at each boundary. | Simple to implement; O(1) memory per client | Boundary bursts: a client can double their effective rate at window edges |
| **Sliding Window** | Track individual request timestamps. Count only those within the last N seconds. | No boundary bursts; accurate and fair | O(k) memory per client where k = max requests per window |
| **Token Bucket** | Each client has a "bucket" of tokens. Tokens refill at a fixed rate. Each request consumes one token. | Allows controlled bursting; smooth traffic shaping | Slightly more complex state (token count + last refill time) |

### When to use each

- **Fixed Window** — when simplicity matters more than precision (e.g. internal tooling, low-traffic APIs).
- **Sliding Window** — when fairness and accuracy are important (e.g. public APIs, user-facing rate limits). This is what we implement here.
- **Token Bucket** — when you want to allow short bursts but still enforce an average rate (e.g. upload bandwidth limiting, payment APIs).

---

## Scaling with Redis

### Why in-memory doesn't work across multiple servers

This project stores timestamps in a JavaScript `Map` that lives in the Node.js process memory. That works fine for a single server, but real production apps run multiple instances behind a load balancer:

```
Client → Load Balancer → Server A (Map: {"::1": [t1, t2]})
                       → Server B (Map: {"::1": []})
                       → Server C (Map: {"::1": [t3]})
```

If a client's requests are spread across servers, each server sees only a fraction of the requests. A client could send 5 requests to Server A, 5 to Server B, and 5 to Server C — 15 total — and never be rate-limited. The in-memory store has no shared state.

### How Redis solves it

Redis is an in-memory data store that runs as a separate process all servers can talk to. Instead of a local `Map`, every server reads and writes to the same Redis instance.

The sliding window maps naturally to a Redis **Sorted Set**, where each member is a unique request ID and its score is the request timestamp:

```
# Record a new request for IP "192.168.1.1"
ZADD rate:192.168.1.1 <timestamp_ms> <unique_request_id>

# Remove timestamps older than the window start
ZREMRANGEBYSCORE rate:192.168.1.1 0 <window_start_ms>

# Count remaining requests in the window
ZCARD rate:192.168.1.1
```

- `ZADD` — adds a member with a score (our timestamp). Equivalent to `timestamps.push(now)`.
- `ZREMRANGEBYSCORE` — removes all members with a score in a given range. Equivalent to `timestamps.filter(ts => ts > windowStart)`.
- `ZCARD` — returns the number of members. Equivalent to `timestamps.length`.

All three commands can be wrapped in a `MULTI`/`EXEC` transaction (or a Lua script) to make the check-and-increment atomic, preventing race conditions that *can* occur across multiple processes (unlike single-threaded Node.js where they cannot).

This is the standard production pattern used by APIs at scale — the algorithm is identical to what's in this project; only the storage layer changes.
# rate-limiter
