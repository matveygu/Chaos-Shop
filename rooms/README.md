# Chaos Shop Rooms

The public shop page and its same-origin `POST /room` API run on Vercel. The function and the primary Upstash Redis database run in Frankfurt. The client sends a random per-match player credential. Redis stores its SHA-256 digest and a private room for up to four hours. Leaving releases both seats. Competing actions use an atomic compare-and-set so a pick locks the reroll.

## Hosting

Use the repository's `rooms` directory as the Vercel project root. Use the Other framework preset and the `public` output directory. Connect the Upstash Redis Free plan to Production in the same region, with automatic upgrades and Production Pack disabled. The function reads the server-side pair `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Never put these credentials in the VPK or public scripts.

The idle lobby and closed shop send zero periodic state requests. Opening the shop refreshes the room. Visible rooms start polling at 2.5 seconds with both players present, or 5 seconds with one player, and slow to 15 seconds without changes. Each steady-state poll reads one Redis key. At that interval two continuously open shops make at most 480 scheduled reads per hour after the initial backoff. Player actions, initial connections, retries and other rooms add to that figure. A confirmed purchase can still be sent with the shop closed. Connection failures back off to 60 seconds. Create and join requests share a limit of 24 per minute per source IP.

## Verification

`node --test tests/redis.test.mjs` starts a disposable local Redis instance. Put `redis-server` and `redis-cli` on PATH or set `ROOM_REDIS_SERVER` and `ROOM_REDIS_CLI`. The test checks concurrent joins, purchases, stale rounds, the four-hour TTL and cleanup.

`node tests/browser.mjs` checks the shop page with two independent Chromium sessions. Install Playwright and a Chromium browser or set `ROOM_PLAYWRIGHT` and `ROOM_BROWSER` to existing installations. Set `ROOM_TEST_ORIGIN` to test a deployed site. It creates a temporary two-player room and closes it after the scenario.
