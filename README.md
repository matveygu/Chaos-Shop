# Chaos Shop

> **No Plan. Just Chaos.**

A Deadlock mod that adds a **Random** tab directly into the game's item shop. Stop theorycrafting. Pick a tier, get a random item you don't own yet, and see what kind of cursed build the universe has planned for you.

---

## What it does

The mod adds a new **Random** tab alongside the existing Weapon / Vitality / Spirit / Favorites / Search tabs. The original shop is completely untouched — all native tabs work exactly as in vanilla.

Inside the Random tab:

- **Choose a tier** (1–4) to roll a random item from that tier
- The mod picks a random unowned item across all three categories
- If you can afford it — it purchases automatically
- If you can't — it waits until you collect enough souls, then buys

No confirmation dialogs. No second-guessing. Just chaos.

---

## Features

- Adds a Random tab without replacing or breaking the original shop
- Rolls only items you don't already own
- Auto-purchases when you have enough souls (or waits if you don't)
- Shows the rolled item with its icon, name, and tier
- Tier buttons dim when you can't afford them
- Clicking any native tab while in the Random tab smoothly returns you to normal shop

---

## Installation

1. Copy the `result/mod` folder into your Deadlock mods directory:
   ```
   Steam\steamapps\common\Deadlock\game\citadel\addons\
   ```
   So the final path looks like:
   ```
   addons\mod\panorama\layout\citadel_hud_hero_shop.xml
   ```

2. Launch the game. The Random tab will appear in the shop.

> **CSS requires a full game restart** to reload. JavaScript reloads every time you open the shop.

---

## How to use

1. Open the shop in-game (`B` by default)
2. Click the **pink tab** at the bottom of the tab list — that's the Random tab
3. Pick a tier:
   | Tier | Cost |
   |------|------|
   | 1    | 800 souls  |
   | 2    | 1600 souls |
   | 3    | 3200 souls |
   | 4    | 6400 souls |
4. A random item from that tier rolls — if you can afford it, it's purchased immediately
5. If not — the mod waits for you to collect enough souls, then auto-buys
6. Click any native tab (Weapon, Vitality, etc.) to go back to the normal shop

---

## Mod structure

```
random-shop/
├── result/mod/panorama/
│   ├── layout/
│   │   └── citadel_hud_hero_shop.xml   ← Original shop + Random tab added
│   ├── scripts/
│   │   └── random_shop.js              ← All mod logic
│   └── styles/
│       ├── random_shop.css             ← Tab styling + content layout
│       └── custom_icons.css            ← Per-item icon images
├── original_panorama/                  ← Vanilla game files (reference)
└── README.md
```

---

## Notes

- The mod only rolls items available in the current game mode
- Items already in your build are excluded from the roll pool
- If all items in a tier are owned, you'll see a message instead of rolling
- The Random tab does not interfere with builds, favorites, or search

---

*Built for Deadlock — Valve's game. Not affiliated with Valve.*
