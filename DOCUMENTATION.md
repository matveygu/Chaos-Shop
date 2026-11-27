# Implementation notes

The shop layout loads the draft, inventory and shop scripts from `panorama/scripts`. The Quickbuy HUD watches the pinned item while the shop is closed. It activates the matching native shop card when buying is possible. The shop checks the local hero’s equipment to confirm the purchase. For items with matching equipment signatures, it also checks ownership of the exact card or a new named purchase entry.

Single roll and Blind draw from eligible local shop cards. A three-card draft uses the local pool by default. Entering an optional seed uses the deterministic catalog, tier, category mask, round and reroll flag.

A Blind reservation stores its mode alongside the chosen item in the match HUD. While it is pending, the shop renders a question mark and a neutral tier label. After the HUD confirms acquisition for that roll, the shop saves the name and artwork so the player can see the reveal after reopening the shop or reloading its layout. Starting the next roll clears the reveal.

Compile the two Panorama layouts, four scripts and `random_shop.css` with the Source 2 resource compiler. Pack the seven compiled resources using their original Panorama paths. Run `node tests/shop.test.cjs` against source or pass the path to a decompiled Panorama directory to check the packaged scripts. The tests cover buying with the shop closed, independent drafts, seeded hands and the Blind reveal.
