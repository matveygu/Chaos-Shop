# Chaos Shop Rooms

The public shop page and its same-origin `POST /room` API run on Vercel. The function and the primary Upstash Redis database run in Frankfurt. The client sends a random per-match player credential. Redis stores its SHA-256 digest and a private room for up to four hours. A ten-character code admits up to six players. Two can start a round. Leaving releases one seat, the next member inherits the host role, and the last departure deletes the room. Rooms created by the original two-player VPK keep the original capacity and close-on-leave behavior. Competing actions use an atomic compare-and-set so a pick locks the reroll.

## Hosting

Use the repository's `rooms` directory as the Vercel project root. Use the Other framework preset and the `public` output directory. Connect the Upstash Redis Free plan to Production in the same region, with automatic upgrades and Production Pack disabled. The function reads the server-side pair `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Never put these credentials in the VPK or public scripts.

The idle lobby and closed shop send zero periodic state requests. Opening the shop refreshes the room. Visible rooms start polling at 2.5 seconds with two or more members, or 5 seconds with one, and slow to 15 seconds without changes. Each steady-state poll reads one Redis key. Six continuously visible, idle shops make about 1,440 scheduled reads per hour once they reach that interval. Player actions, initial connections, retries and other rooms add to that figure. A confirmed purchase can still be sent with the shop closed. Connection failures back off to 60 seconds. Create and join requests share a limit of 24 per minute per source IP.

## Verification

`node --test tests/redis.test.mjs` starts a disposable local Redis instance. Put `redis-server` and `redis-cli` on PATH or set `ROOM_REDIS_SERVER` and `ROOM_REDIS_CLI`. The test checks concurrent joins, purchases, stale rounds, the four-hour TTL and cleanup.

`node tests/browser.mjs` checks the shop page with seven independent Chromium sessions. Install Playwright and a Chromium browser or set `ROOM_PLAYWRIGHT` and `ROOM_BROWSER` to existing installations. Set `ROOM_TEST_ORIGIN` to test a deployed site. The scenario fills six seats, checks the seventh player is refused, verifies code copying, round completion, host succession and reuse of a freed seat, then closes the room.
