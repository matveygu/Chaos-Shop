# Chaos Shop

Chaos Shop adds a **?** tab to the Deadlock item shop. Choose a tier and the categories you want to roll. Each player rolls locally and spends their own souls.

## Install

Enable [random_shop.vpk](random_shop.vpk) with your Deadlock mod manager and restart the game. Use one Chaos Shop build at a time. [Chaos Shop.zip](Chaos%20Shop.zip) also includes the Panorama sources.

## Play

- **Single roll** shows one item and pins it until purchase.
- **Pick one of three** deals up to three eligible items. Choose a card or reroll the hand once. Leave the optional seed field empty for an independent draw.
- **Blind** (**Вслепую**) pins one mystery item from your selected tier and categories. A question mark and the purchase status stay on screen while you wait. When the item reaches your inventory, the **?** tab reveals its name and artwork. If the shop was closed, the reveal is there the next time you open the tab. It stays until your next roll.

All three modes use Deadlock's normal shop rules. Once you have enough souls and can buy in a shop zone, Chaos Shop requests the purchase even with the shop closed.

Open **? → History** anytime to see the latest 20 rolls in this match, newest first. Draft entries show the offered cards, rerolls, skips and your choice. A pending Blind entry shows **?** until the item reaches your inventory. The list lives in the current match HUD and resets for the next match.

## Earlier versions

- [Six-player room build](https://github.com/matveygu/Chaos-Shop/tree/pre-blind-solo)
- [Previous two-player VPK](https://github.com/matveygu/Chaos-Shop/tree/pre-six-player-rooms)
- [Pre-Vercel build, including the portable Windows host](https://github.com/matveygu/Chaos-Shop/tree/pre-vercel-rooms)
- [Original release before the shop updates](https://github.com/matveygu/Chaos-Shop/tree/original-before-shop-updates)

The [implementation notes](DOCUMENTATION.md) cover the game files and purchase confirmation.
