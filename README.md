# Chaos Shop

Chaos Shop adds a **?** tab to the Deadlock item shop. Pick one or more categories and a tier to roll an item from the current catalog. The result stays pinned until the equipped inventory of the local hero shows the acquisition. The tab supports English and Russian.

## Play

1. Open the shop and select **?**. Choose Weapon, Vitality or Spirit, then a tier from I to IV. You can roll before you have enough souls.
2. The card shows the item, its current price and the purchase status. You can close the shop or browse another tab and return to the same roll during the match.
3. Once you enter a purchase zone and can afford the pinned item, Chaos Shop automatically requests the purchase, even with the shop closed. If you earn the remaining souls while in range, it buys there too. If the game needs input, choose **Show item in shop** to jump to the highlighted card and finish there. A purchase through the regular shop also counts.
4. Roll again once the game confirms ownership. A timeout or an unsuccessful request keeps your selection pinned.

## Install

Import `random_shop.vpk` into your Deadlock mod manager, replacing any older Chaos Shop version, and restart Deadlock. The mod uses the shop and Quickbuy HUD layouts. Other mods that replace either layout can take precedence.

## Source

`panorama/layout/citadel_hud_hero_shop.xml` is based on the installed game's shop layout. `panorama/scripts/random_shop.js` manages the reservation. The Quickbuy HUD loads `panorama/scripts/chaos_quickbuy.js` from `panorama/layout/hud_quickbuy.xml` and activates the pinned native catalog card while the player is in shop range. Both layouts use `panorama/scripts/chaos_inventory.js` to check equipped slots. Items sharing an equipment appearance also require a new purchase-history entry naming the item or the exact catalog card to show ownership. `panorama/styles/random_shop.css` styles the selector and pinned card. Compile the two layouts, three scripts and stylesheet with the Source 2 resource compiler and pack their compiled counterparts under the same Panorama paths in the VPK.

Built for Deadlock. Not affiliated with Valve.
