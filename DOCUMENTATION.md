# Implementation notes

The shop layout loads the draft, inventory and shop scripts from `panorama/scripts`. The Quickbuy HUD watches the selected item while the shop is closed. It activates the matching native shop card only when buying is possible, and records success when the local hero's equipped inventory confirms the item.

The three-card draft uses a deterministic catalog and the same room code, tier, category mask, round and reroll flag on each client. Eligibility and purchases remain local to each player. Team room opens a CitadelHTMLPanel with a code field and a copy button. The current VPK advertises support for six players. Panorama sends fixed actions in the URL fragment and accepts validated room snapshots from the page title. A server response can reserve an item only after the local player chooses it.

The Quickbuy HUD pauses room polling when the shop is hidden. It can report a confirmed purchase while the shop layout is suspended, with retries limited to once per minute after backoff. Reopening the shop refreshes the room.

Compile the two Panorama layouts, four scripts and `random_shop.css` with the Source 2 resource compiler. Pack the seven compiled resources using their original Panorama paths. Run `node tests/shop.test.cjs` to check purchase handling, draft codes and the shop/room bridge.

See [room hosting and tests](rooms/README.md). For the previous standalone Windows host, see the [pre-Vercel tag](https://github.com/matveygu/Chaos-Shop/tree/pre-vercel-rooms).
