# Chaos Shop

Chaos Shop adds a **?** tab to the Deadlock item shop. Roll one random item, draft from three cards, or play a shared draft with a friend. The shop pins your choice and requests the purchase when you can afford it in a shop zone. A new inventory slot confirms the purchase.

## Install

Enable [random_shop.vpk](random_shop.vpk) with your Deadlock mod manager and restart the game. Use one Chaos Shop build at a time. [Chaos Shop.zip](Chaos%20Shop.zip) also includes the Panorama sources.

## Play together

1. Both players install the same VPK and open **? → Duo room** (in Russian, **Комната на двоих**).
2. One player chooses **Create room** and sends the invitation to the other. The second player pastes the invitation in the shop address field, or enters the ten-character code and chooses **Join**.
3. At **2/2**, the host selects categories and a tier. Both players see the same cards. The host can reroll once before either player picks. Each buys their own choice with their own souls.
4. After both players buy or pass, the host can deal again. Leaving closes the room. Rooms expire after four hours.

The VPK opens the [hosted room service](https://chaos-shop-rooms.vercel.app/) when you select Duo room. Players need no launcher, account or personal server. Solo play and shared seeds work offline.

## Play solo

Choose Weapon, Vitality or Spirit and a tier. **Single roll** pins one item. **Pick one of three** offers a hand and one optional reroll before picking. A shared seed gives two players the same sequence when they select the same tier, categories and rerolls.

## Earlier versions

- [Pre-Vercel build, including the portable Windows host](https://github.com/matveygu/Chaos-Shop/tree/pre-vercel-rooms)
- [Original release before the shop updates](https://github.com/matveygu/Chaos-Shop/tree/original-before-shop-updates)

The [implementation notes](DOCUMENTATION.md) cover the game files and the room service.
