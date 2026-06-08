# Random Shop — полная документация мода

## Содержание

1. [Идея и суть мода](#1-идея-и-суть-мода)
2. [Как работает Deadlock Panorama UI](#2-как-работает-deadlock-panorama-ui)
3. [Структура файлов](#3-структура-файлов)
4. [Поток выполнения (user flow)](#4-поток-выполнения-user-flow)
5. [Машина состояний](#5-машина-состояний)
6. [Подробно: каждый файл мода](#6-подробно-каждый-файл-мода)
7. [Ключевые технические решения и почему они такие](#7-ключевые-технические-решения-и-почему-они-такие)
8. [Известные баги и их фиксы](#8-известные-баги-и-их-фиксы)
9. [Известные оставшиеся риски](#9-известные-оставшиеся-риски)
10. [Справочник: Panorama API](#10-справочник-panorama-api)
11. [Справочник: панели Deadlock](#11-справочник-панели-deadlock)
12. [Папка shop/ — эталонный пример](#12-папка-shop--эталонный-пример)

---

## 1. Идея и суть мода

**Random Shop** полностью убирает свободный выбор предметов в магазине Deadlock.

Вместо стандартного магазина игрок видит 4 кнопки — по одной на каждый тир (T1–T4). При нажатии случайно выбирается один предмет из нужного тира во всех категориях (Weapon/Vitality/Spirit). Этот предмет **нужно купить** — пока он не куплен, новый ролл недоступен.

После ролла:
1. Наш HUD исчезает.
2. Магазин автоматически переключается на вкладку, где находится выпавший предмет.
3. Все остальные предметы становятся невидимыми и некликабельными (`opacity: 0`, `hittest: false`).
4. Нужный предмет подсвечивается — игрок кликает по нему и покупает.
5. После покупки всё сбрасывается, снова отображается наш HUD.

Цель режима: убрать мету, создать элемент roguelike — каждая игра уникальна, билд складывается случайно.

---

## 2. Как работает Deadlock Panorama UI

Panorama — это UI-фреймворк Valve, используемый в Deadlock (и CS2). Основы:

### Файлы и загрузка
- Игра загружает UI-файлы из папки `panorama/` внутри пака игры.
- Моды работают через **VPK-переопределение**: файлы в папке мода с тем же путём заменяют оригинальные.
- Путь мода: `random-shop/mod/panorama/` → соответствует `game/citadel/panorama/` в самой игре.

### Форматы файлов
| Расширение | Назначение |
|---|---|
| `.xml` | Layout — описывает дерево панелей (аналог HTML) |
| `.css` | Стили панелей (похоже на CSS, но с нестандартными свойствами Valve) |
| `.js` | Скрипты (ограниченное ES6 без DOM API — только Panorama API) |

### Панели
- Всё в Panorama — **Panel** (аналог `<div>`).
- У каждой панели есть `id`, классы CSS, тип (`paneltype`), методы API.
- Нативные типы — `CitadelShopModsList`, `CitadelShopMod`, `CitadelHudHeroShop` и др. — создаются движком и имеют дополнительное поведение.

### Ключевые особенности
- **`$.GetContextPanel()`** — получить текущую "корневую" панель скрипта (та, к которой привязан `<scripts>` блок в XML).
- **`FindChildTraverse(id)`** — рекурсивный поиск потомка по id.
- **`FindChildrenWithClassTraverse(cls)`** — рекурсивный поиск ВСЕХ потомков с классом. **ВАЖНО**: может возвращать одну панель несколько раз, если она соответствует поиску через разные ветки дерева.
- **`$.Schedule(sec, fn)`** — отложенный вызов (аналог `setTimeout` в секундах).
- **`$.DispatchEvent(name, ...args)`** — отправить событие в UI-шину.
- **`AddClass/RemoveClass/BHasClass/SetHasClass`** — управление CSS-классами.
- **`GetAttributeInt(name, default)`** — читать числовой атрибут панели (на нативных панелях хранятся игровые данные).

### CSS-особенности Panorama
- `ignore-parent-flow: true` — панель "выпадает" из flow и позиционируется поверх (аналог `position: absolute`).
- `hittest: false` — панель не получает клики и ховеры (аналог `pointer-events: none`).
- `visibility: collapse` — скрывает панель И удаляет её из layout (вызывает layout shift!).
- `opacity: 0` — скрывает визуально, но оставляет в layout (предпочтительно для стабильности).
- `z-index` — работает как в CSS.
- `flow-children: down/right` — вертикальный/горизонтальный flow (аналог flexbox column/row).
- `brightness: N` — фильтр яркости (не цифровой CSS `filter`).
- `pre-transform-scale2d: N` — масштаб (аналог `transform: scale()`).

---

## 3. Структура файлов

```
random-shop/
├── mod/                          ← АКТИВНЫЙ МОД (то, что грузится в игре)
│   └── panorama/
│       ├── layout/
│       │   ├── citadel_hud_hero_shop.xml     ← главный layout магазина (переопределяет нативный)
│       │   └── citadel_shop_mod_view.xml     ← layout отдельного предмета (переопределяет нативный)
│       ├── scripts/
│       │   ├── random_shop.js    ← ГЛАВНЫЙ скрипт мода (вся логика)
│       │   ├── update.js         ← вспомогательный скрипт (иконки, мониторинг)
│       │   └── icon.js           ← скрипт создания иконок-оверлеев (из примера)
│       └── styles/
│           ├── random_shop.css   ← стили мода
│           └── custom_icons.css  ← иконки предметов (из примера)
│
├── shop/                         ← ЭТАЛОННЫЙ ПРИМЕР (не грузится в игре, только для изучения)
│   └── panorama/ ...
│
├── public/
│   ├── favicon.svg
│   └── icons.svg                 ← SVG-спрайты иконок для React-компаньона
│
└── DOCUMENTATION.md              ← этот файл
```

> **Важно**: папка `shop/` — это исходный пример мода, изученный для понимания структуры. В игре грузится только папка `mod/`.

---

## 4. Поток выполнения (user flow)

```
Игрок открывает магазин
        │
        ▼
[HUD мода появляется поверх магазина]
Видно: заголовок "RANDOM SHOP", 4 кнопки тиров
Скрыто (CSS): вкладки навигации, поиск, стандартный список предметов
        │
        ▼
Игрок нажимает на кнопку тира (T1–T4)
        │
        ▼
[loadAllItemsThenRoll] — циклически переключает вкладки
WeaponMod → (60ms) → Armor → (60ms) → Tech → (100ms) → doRoll()
(это нужно, чтобы Deadlock загрузил панели всех предметов в DOM)
        │
        ▼
[doRoll] — собирает все предметы нужного тира, выбирает случайный
Заполняет state: itemClass, itemTier, itemListId, itemType
        │
        ▼
setMode('rolled') → root получает класс rs-mode-rolled
Показывается карточка выпавшего предмета (#RSRolledView)
        │
        ▼
tryAddToQuickbuy() — пытается добавить в очередь быстрой покупки
monitorPurchase() — запускает async-наблюдатель за покупкой
highlightLoop() — запускает 50ms петлю подсветки
RandomShopBuyItem() — автоматически переходит в режим покупки
        │
        ▼
[showCategoryForItem] — диспатчит CitadelShopModsActivate
Переключает магазин на вкладку нужного предмета
        │
        ▼
После 200ms:
root получает класс rs-mode-buying
        │
        ▼
[Режим покупки]
• #RandomShopPanel скрывается (visibility: collapse)
• Все предметы с rs-dimmed: opacity 0, hittest false
• Нужный предмет с rs-rolled: подсвечен, кликабелен
• highlightLoop переприменяет классы каждые 50ms
        │
        ▼
Игрок кликает на нужный светящийся предмет → покупает
        │
        ▼
[monitorPurchase] обнаруживает BHasClass('owned') на state.item
→ onItemPurchased():
  clearHighlights() — снимает все rs-rolled/rs-dimmed
  setMode('idle') — убирает rs-mode-rolled и rs-mode-buying
  Сбрасывает state
        │
        ▼
HUD снова появляется, игрок может сделать следующий ролл
```

---

## 5. Машина состояний

```javascript
state = {
    mode:      'idle' | 'rolled',
    item:      Panel | null,   // живая ссылка на панель предмета (обновляется в applyHighlights)
    itemType:  number,         // числовой ItemType для quickbuy (может быть 0 — не критично)
    itemClass: string,         // CSS-класс предмета ('closeRange', 'techPower' и т.д.)
    itemTier:  number,         // 1–4
    itemListId: string         // 'ShopModsListWeapon' | 'ShopModsListArmor' | 'ShopModsListTech'
}
```

### CSS-классы на root-панели

| Класс | Когда присутствует | Эффект |
|---|---|---|
| `rs-mode-rolled` | После ролла | Кнопки тиров тускнеют, появляется карточка предмета |
| `rs-mode-buying` | В режиме покупки | HUD скрыт, чужие предметы `opacity: 0` |

### CSS-классы на панелях предметов

| Класс | Назначение |
|---|---|
| `rs-rolled` | Нужный предмет — подсветка, масштаб |
| `rs-dimmed` | Все остальные — `opacity: 0.05` (в idle) / `0` (в buying) |

---

## 6. Подробно: каждый файл мода

---

### 6.1 `citadel_hud_hero_shop.xml`

Главный layout магазина. Заменяет оригинальный файл Deadlock.

**Что добавлено:**
- Подключает `random_shop.css` и `custom_icons.css` в блоке `<styles>`.
- Добавляет `#RandomShopPanel` внутрь `#ShopModsContainer` — наш оверлей.
- В блоке `<scripts>` загружается только `random_shop.js`.

**Структура `#RandomShopPanel`:**
```
#RandomShopPanel
├── .RSTitle          ("RANDOM SHOP")
├── .RSSubtitle       ("Choose a tier to get a random item")
├── #RSTierButtons
│   ├── #RSTier1.RSTierBtn  [onmouseactivate → RandomShopRollTier(1)]
│   ├── #RSTier2.RSTierBtn  [onmouseactivate → RandomShopRollTier(2)]
│   ├── #RSTier3.RSTierBtn  [onmouseactivate → RandomShopRollTier(3)]
│   └── #RSTier4.RSTierBtn  [onmouseactivate → RandomShopRollTier(4)]
├── #RSNoItemsMsg     (показывает "All TierN items already owned!")
└── #RSRolledView     [onmouseactivate → RandomShopBuyItem()]
    ├── .RSDivider
    ├── #RSBigIconWrapper   (получает класс "{itemClass}-style" от JS)
    │   └── #OverlayImage.RSOverlayImage
    ├── #RSItemName
    └── #RSItemTier
```

**Позиционирование оверлея** (из `random_shop.css`):
```css
#RandomShopPanel {
    ignore-parent-flow: true;  /* выпадает из потока, перекрывает список предметов */
    width: 100%;
    height: 100%;
    z-index: 50;               /* выше нативного списка */
}
```

**Что остаётся из нативного XML, но скрыто через CSS:**
- `#ShopNavigation` — вкладки Weapon/Vitality/Spirit (`visibility: collapse`)
- `#ShopModsListAll` — список всех предметов (`visibility: collapse`)
- `#ShopModsSelectedBuild` — билд-список (`visibility: collapse`)
- `#SearchHeader` — панель поиска (`visibility: collapse`)
- `.HeroFavoritesHeaderLabel` — заголовок рекомендаций (`visibility: collapse`)

**Что остаётся активным (не скрыто):**
- `#ShopModsListWeapon`, `#ShopModsListArmor`, `#ShopModsListTech` — нативные списки предметов. Они ДОЛЖНЫ оставаться в DOM (не collapse), иначе JS не найдёт панели предметов.

**Стабы для нативных обработчиков:**
```javascript
ctx.ToggleFavoritesNav       = function () {};
ctx.ToggleFavoritesTemporary = function () {};
ctx.ActivateTabWithFavorites = function () {};
ctx.ActivateSearch           = function () {};
```
Нужны потому что кнопки в `#ShopNavigation` вызывают эти функции через `onmouseactivate` — без стабов будет JS-ошибка при любом взаимодействии с нативной навигацией.

---

### 6.2 `citadel_shop_mod_view.xml`

Переопределяет нативный layout одного предмета в магазине.

**Ключевая структура:**
```
CitadelShopMod.mod_view
└── #background
    └── #ModCard
        └── .modIconContainer
            ├── .mod_icon
            ├── #ModIconImage
            └── ... (статус-иконки: owned, quickbuy и т.д.)
```

Этот файл не содержит блока `<scripts>` — наш JS в него не загружается. Файл минимально изменён: подключает только `random_shop.vcss_c` вместо стандартного набора стилей.

---

### 6.3 `random_shop.js` — главный скрипт

Весь код обёрнут в IIFE `(function(){ 'use strict'; ... })()` во избежание загрязнения глобального пространства имён.

#### Async-утилиты (строки 1–21)

```javascript
var _Async = (typeof Async !== 'undefined') ? Async : null;
if (!_Async) {
    // минимальная реализация Delay + Condition
}
```

Если `update.js` загружен раньше (он определяет глобальный `Async`), используется он. Иначе создаётся минимальная версия. На практике `update.js` в `<scripts>` мода **не включён**, поэтому всегда используется fallback.

#### ALL_MOD_CLASSES (строки 26–56)

Массив из ~130 CSS-классов всех предметов игры. Каждый предмет в Deadlock имеет уникальный CSS-класс на своей панели (например `closeRange`, `techPower`). Это единственный надёжный способ идентифицировать предмет в Panorama — нативные ID нестабильны.

Список разделён на комментарии Weapon / Vitality / Spirit, но технически это один массив — категория определяется тем, в каком `ShopModsListXxx` нашлась панель.

#### collectItemsForTier(tierNum)

Собирает все предметы нужного тира, исключая уже купленные (`BHasClass('owned')`).

Алгоритм:
1. Для каждого list-id (`ShopModsListWeapon/Armor/Tech`):
2. Для каждого CSS-класса из `ALL_MOD_CLASSES`:
3. `FindChildrenWithClassTraverse(cls)` — находит панели с этим классом
4. Для каждой найденной панели: проверяет тир через `getTierFromPanel`, не owned
5. Добавляет в результат `{ icon, type, cls, listId }`

**Дублирование панелей**: `FindChildrenWithClassTraverse` может вернуть одну панель дважды (если у неё несколько классов из нашего массива). При сборе для ролла это не критично, потому что мы просто добавляем дублей в список — шансы остаются пропорциональными. Для `applyHighlights` дублирование критично, поэтому там есть dedup (см. ниже).

#### getTierFromPanel(panel, listRoot)

Поднимается по цепочке родителей от `panel` до `listRoot`. Ищет панель, в `id` которой есть `"tier"` (нечувствительно к регистру) + цифры. Возвращает число тира (1–4) или 0.

Работает потому что Deadlock раскладывает предметы в контейнеры типа `"Tier1Group"`, `"Tier2Group"` и т.д.

#### getItemType(iconPanel)

Пытается прочитать числовой `ItemType` из атрибутов панели или её родителей/потомков. Используется для quickbuy. Может вернуть 0 — это не критично для работы мода, но quickbuy тогда не сработает.

#### applyHighlights() — двухпроходный алгоритм

**Почему не однопроходный**: `FindChildrenWithClassTraverse` итерируется по всем классам из `ALL_MOD_CLASSES`. Если панель имеет классы `closeRange` и `owned` (например), она будет найдена при поиске по `closeRange`. Если затем её найдут при поиске по другому классу (что маловероятно, но возможно из-за структуры дерева), второй раз она получит `rs-dimmed`, перебив уже поставленный `rs-rolled`.

**Решение — два прохода:**

Проход 1 — dedup:
```javascript
var allPanels = [];
for каждый класс:
    found = FindChildrenWithClassTraverse(cls)
    for каждый f in found:
        if f уже в allPanels → пропустить
        allPanels.push(f)
```

Проход 2 — применить классы:
```javascript
for каждый icon in allPanels:
    isTarget = icon.BHasClass(state.itemClass)
               && getTierFromPanel(icon, list) === state.itemTier
               && LIST_IDS[li] === state.itemListId
    if isTarget:
        state.item = icon  // обновить живую ссылку!
        AddClass('rs-rolled'), RemoveClass('rs-dimmed')
    else:
        AddClass('rs-dimmed'), RemoveClass('rs-rolled')
```

`BHasClass(state.itemClass)` — проверяет класс прямо на панели, независимо от того, каким путём мы её нашли. Это ключевое отличие от предыдущей версии, которая использовала сравнение `icon === rolledIcon` (ссылка устаревала после tab-switch).

#### highlightLoop()

```javascript
function highlightLoop() {
    if (state.mode !== 'rolled') return;  // самозавершается при переходе в idle
    applyHighlights();
    $.Schedule(0.05, highlightLoop);      // 50ms
}
```

Deadlock пересоздаёт панели предметов при ховере (для обновления tooltip, affordability, и т.д.). Это стирает наши CSS-классы. Петля 50ms переприменяет их постоянно.

#### doRoll(tierNum)

```javascript
function doRoll(tierNum) {
    var items = collectItemsForTier(tierNum);
    if (items.length === 0) { /* сообщение "all owned" */ return; }

    var picked = items[Math.floor(Math.random() * items.length)];
    // заполнить state...

    setMode('rolled');
    updateRolledDisplay();   // обновить карточку
    tryAddToQuickbuy();      // попытка добавить в quickbuy
    monitorPurchase();       // async-наблюдатель
    highlightLoop();         // 50ms петля подсветки
    RandomShopBuyItem();     // автоматический переход в buying mode
}
```

Вызывается из `loadAllItemsThenRoll` после того как все три вкладки были принудительно загружены.

#### loadAllItemsThenRoll(tierNum, onReady)

```javascript
$.DispatchEvent('CitadelShopModsActivate', 'EItemSlotType_WeaponMod');
$.Schedule(0.06, function() {
    $.DispatchEvent('CitadelShopModsActivate', 'EItemSlotType_Armor');
    $.Schedule(0.06, function() {
        $.DispatchEvent('CitadelShopModsActivate', 'EItemSlotType_Tech');
        $.Schedule(0.1, function() {
            onReady(tierNum);  // → doRoll
        });
    });
});
```

**Зачем это нужно**: Deadlock лениво загружает содержимое каждой вкладки — панели предметов существуют в DOM только когда их вкладка активна или была активна хотя бы раз. При открытии магазина активна только одна вкладка, остальные пусты. Переключение через все три вкладки принудительно создаёт все панели.

#### showCategoryForItem(listId)

```javascript
// Удалить все showing* классы с shopRoot
// DispatchEvent('CitadelShopModsActivate', tabType)
// После 50ms → DispatchEvent Favorites
// После ещё 100ms → AddClass(tabClass) + applyHighlights()
```

Переключает видимую вкладку магазина на ту, где находится выпавший предмет. Использует двухшаговый dispatch (на нужную вкладку, потом на Favorites) — паттерн взятый из `update.js`, который нужен для корректного обновления нативного состояния магазина.

#### monitorPurchase()

```javascript
async function monitorPurchase() {
    var target = state.item;  // захватываем ссылку
    await _Async.Condition(function() {
        return !target.IsValid() || target.BHasClass('owned');
    });
    onItemPurchased();
}
```

**Известный риск**: ссылка `target` захватывается в момент вызова. Если после tab-switching панель пересоздаётся, `target` становится невалидным (`!target.IsValid() === true`) → условие сразу истинно → `onItemPurchased()` вызывается ложно.

`applyHighlights()` обновляет `state.item` до живой панели, но `monitorPurchase` использует свою локальную `target`, а не `state.item`. Это потенциальный баг.

**Предлагаемый фикс:**
```javascript
async function monitorPurchase() {
    await _Async.Condition(function() {
        if (!state.item || !state.item.IsValid()) return false;  // ждать валидной ссылки
        return state.item.BHasClass('owned');
    });
    onItemPurchased();
}
```

#### tryAddToQuickbuy()

Пробует несколько подходов добавить предмет в очередь быстрой покупки. Все вызовы обёрнуты в `try/catch` — если API не существует, просто ничего не происходит. Функциональность вспомогательная: мод работает и без quickbuy.

---

### 6.4 `random_shop.css`

Вся CSS-логика разделена на блоки:

#### Базовые скрытия
```css
#ShopNavigation, #ShopModsListAll, #ShopModsSelectedBuild,
#SearchHeader, .HeroFavoritesHeaderLabel { visibility: collapse; }
```
`visibility: collapse` убирает панель из layout полностью (не просто скрывает).

#### Позиционирование оверлея
```css
#RandomShopPanel {
    ignore-parent-flow: true; width: 100%; height: 100%;
    z-index: 50; flow-children: down;
    background-color: gradient(linear, ...);  /* тёмный фон */
    padding: 28px 24px;
}
```

#### Состояние rolled
```css
.rs-mode-rolled .RSTierBtn { opacity: 0.45; hittest: false; }
.rs-mode-rolled #RSRolledView { visibility: visible; opacity: 1; }
```

#### Состояние buying (критически важно)
```css
/* Скрыть наш HUD */
.rs-mode-buying #RandomShopPanel { visibility: collapse; }

/* Скрыть все предметы кроме нужного — opacity, НЕ visibility */
.rs-mode-buying .rs-dimmed,
.rs-mode-buying .rs-dimmed:hover {    /* :hover блокирует нативный hover-стиль */
    opacity: 0;
    hittest: false;
    transition-duration: 0s;          /* без анимации, чтобы не мигало при re-apply петли */
}

/* Подсветить нужный предмет */
.rs-mode-buying .rs-rolled {
    brightness: 2.5;
    pre-transform-scale2d: 1.18;
    box-shadow: 0px 0px 30px 12.0 #f0e060ee;
    z-index: 10;
    transition-duration: 0.25s;
}
```

**Почему `opacity: 0`, а не `visibility: collapse`**: `visibility: collapse` удаляет панели из layout, из-за чего нативный layout магазина ломается — кнопки и элементы "уезжают" на странные позиции. `opacity: 0` сохраняет занимаемое место в layout.

**Почему `.rs-dimmed:hover`**: Deadlock при ховере на предмет применяет внутренние стили через нативный CSS. Без явного `:hover`-правила нативный `:hover`-стиль мог восстановить `opacity` у скрытых предметов, делая их видимыми и кликабельными на долю секунды.

#### Базовые стили подсветки (вне buying mode)
```css
.rs-rolled { box-shadow: ...; brightness: 1.6; pre-transform-scale2d: 1.12; z-index: 5; }
.rs-dimmed { opacity: 0.05; hittest: false; }
```
В режиме `rolled` (до buying) предметы видны с 5% прозрачностью — игрок видит весь магазин, но нужный предмет выделен.

---

### 6.5 `custom_icons.css`

Содержит правила вида:
```css
.closeRange-style #OverlayImage { background-image: url("..."); }
.techPower-style #OverlayImage { background-image: url("..."); }
/* ... для каждого предмета */
```

JS добавляет класс `"{itemClass}-style"` на `#RSBigIconWrapper`. CSS-правило срабатывает и устанавливает фоновое изображение на `#OverlayImage` внутри wrapper.

Также содержит стили `.CategoryContainer`, `.TierGroup`, `.UniversalModOverlay` — они нужны для системы иконок из `shop/` (эталонный пример), но не используются в нашем активном моде.

---

### 6.6 `update.js`

Вспомогательный файл из эталонного примера `shop/`. В активном моде **не подключён** в `<scripts>` блоке `citadel_hud_hero_shop.xml`.

Содержит:
- Глобальный namespace `Async` с `Delay`, `NextFrame`, `Condition`, `RunSequence`, `AbortController`, `SequenceController`.
- `MonitorShop()` — async-цикл, следит за открытием/закрытием магазина.
- `MonitorModAttributes()` — следит за изменением атрибутов экипированных предметов.
- `WaitForTooltipPurchaseUpdate()` — следит за тултипом покупки.
- `SyncOwnedStatus()` — синхронизирует статус `owned`/`canAfford` для оверлеев.

---

### 6.7 `icon.js`

Вспомогательный файл из эталонного примера `shop/`. В активном моде **не подключён**.

Создаёт `UniversalModOverlay` панели в `#ShopModsListIcons` — визуальные оверлеи поверх нативных иконок предметов с кастомными изображениями. Эта система не нужна для Random Shop.

---

## 7. Ключевые технические решения и почему они такие

### 7.1 Почему предметы идентифицируются по CSS-классу, а не по ID

У панелей предметов в Deadlock нет стабильных уникальных ID. После переключения вкладок и при ховере Deadlock может пересоздавать панели, и ID меняются. CSS-классы (`closeRange`, `techPower` и т.д.) — единственный стабильный идентификатор предмета.

### 7.2 Почему состояние хранит itemClass+itemTier+itemListId, а не panel reference

После `showCategoryForItem()` (которая диспатчит события переключения вкладок), Deadlock может пересоздать панели предметов. Старая ссылка `state.item` стаёт невалидной. Хранение класса+тира+listId позволяет `applyHighlights()` каждый раз находить актуальную живую панель.

### 7.3 Почему `highlightLoop` обновляет `state.item`

```javascript
if (isTarget) {
    state.item = icon;  // обновляем живую ссылку
    ...
}
```

После tab-switch старая `state.item` инвалидна. Петля каждые 50ms находит предмет заново по class+tier+listId и обновляет `state.item`. Это также помогает `monitorPurchase` — но только если `monitorPurchase` читает `state.item` напрямую, а не через захваченную переменную (см. раздел 9).

### 7.4 Почему два диспатча в showCategoryForItem (Activate → Favorites)

```javascript
$.DispatchEvent('CitadelShopModsActivate', tabType);
$.Schedule(0.05, function() {
    $.DispatchEvent('CitadelShopModsActivate', 'EItemSlotType_Favorites');
});
```

Паттерн взят из `update.js`. Смысл: первый диспатч грузит нужную вкладку, второй (Favorites) — сбрасывает состояние нативной системы избранного, которая иначе может конфликтовать с нашим управлением вкладками.

### 7.5 Почему loadAllItemsThenRoll делает циклическое переключение вкладок

Deadlock использует ленивую загрузку: панели предметов создаются только когда их вкладка становится активной. При открытии магазина обычно активна только одна вкладка (Weapon). Перед роллом нужно "обойти" все три вкладки, чтобы DOM содержал предметы всех категорий — иначе роллы из невидимых вкладок всегда будут пустыми.

---

## 8. Известные баги и их фиксы

### Баг 1: Layout магазина ломается при entering buying mode
**Симптом**: При переходе в режим покупки кнопки и элементы нативного магазина "уезжают".  
**Причина**: Использовался `visibility: collapse` на `rs-dimmed` панелях.  
**Фикс**: Заменить на `opacity: 0; hittest: false` — панели остаются в layout, только скрываются визуально.

### Баг 2: Нет иконок ни у одного предмета в режиме покупки
**Симптом**: В buying mode все предметы невидимы, включая нужный.  
**Причина 1**: `applyHighlights(rolledIcon)` использовала `icon === rolledIcon` — сравнение ссылок. После `showCategoryForItem()` нативные панели пересоздавались, старая ссылка становилась невалидной. Все панели получали `rs-dimmed`, нужный — тоже.  
**Причина 2**: `FindChildrenWithClassTraverse` возвращала одну панель несколько раз. При второй находке (не тем классом) она получала `rs-dimmed` поверх уже поставленного `rs-rolled`.  
**Фикс**: Двухпроходный алгоритм в `applyHighlights()` с dedup + `BHasClass(state.itemClass)` для определения target.

### Баг 3: При ховере на нужный предмет восстанавливаются другие предметы
**Симптом**: Наведение на светящийся нужный предмет делает другие предметы видимыми и кликабельными на момент ховера.  
**Причина**: Deadlock пересоздаёт панели при ховере. 100ms интервал петли оставлял окно, когда классы были сброшены.  
**Фикс 1**: Уменьшить интервал петли до 50ms.  
**Фикс 2**: Добавить `.rs-mode-buying .rs-dimmed:hover { opacity: 0; transition-duration: 0s; }` чтобы CSS-блокировка работала даже между итерациями петли.

### Баг 4: Промежуточный шаг "клик на карточку для перехода в buying mode"
**Симптом**: После ролла нужно было кликнуть на карточку предмета в нашем HUD.  
**Причина**: `RandomShopBuyItem()` была только обработчиком клика на `#RSRolledView`.  
**Фикс**: Вызывать `RandomShopBuyItem()` автоматически в конце `doRoll()`.

---

## 9. Известные оставшиеся риски

### Риск 1: monitorPurchase() захватывает стейл-ссылку

```javascript
async function monitorPurchase() {
    var target = state.item;  // ← захват здесь
    await _Async.Condition(function() {
        return !target.IsValid() || target.BHasClass('owned');  // ← использует старую ссылку
    });
    onItemPurchased();
}
```

Если после tab-switch `target` стала невалидной, условие `!target.IsValid()` сразу `true` → `onItemPurchased()` вызывается без реальной покупки → всё сбрасывается в idle.

**Предлагаемый фикс:**
```javascript
async function monitorPurchase() {
    await _Async.Condition(function() {
        if (!state.item || !state.item.IsValid()) return false;
        return state.item.BHasClass('owned');
    });
    onItemPurchased();
}
```

### Риск 2: Нет отката при закрытии магазина

Если игрок закрывает магазин, не купив предмет, `state.mode` остаётся `'rolled'`, `highlightLoop` продолжает работать. При следующем открытии магазина он будет в состоянии `rolled`.

**Предлагаемый фикс**: Слушать событие закрытия магазина и вызывать `onItemPurchased()` / `setMode('idle')`.

### Риск 3: itemType может быть 0

`getItemType()` не всегда может найти числовой ItemType. Quickbuy в этом случае не работает. Основная функциональность мода не затронута.

---

## 10. Справочник: Panorama API

| API | Описание |
|---|---|
| `$.GetContextPanel()` | Текущая root-панель скрипта |
| `panel.FindChildTraverse(id)` | Рекурсивный поиск потомка по id |
| `panel.FindChildrenWithClassTraverse(cls)` | Все потомки с CSS-классом (может дублировать!) |
| `panel.FindChild(id)` | Прямой потомок по id (не рекурсивный) |
| `panel.Children()` | Массив прямых потомков |
| `panel.GetParent()` | Родительская панель |
| `panel.IsValid()` | Жива ли ссылка (false после пересоздания) |
| `panel.BHasClass(cls)` | Есть ли CSS-класс |
| `panel.AddClass(cls)` | Добавить CSS-класс |
| `panel.RemoveClass(cls)` | Удалить CSS-класс |
| `panel.SetHasClass(cls, bool)` | Установить/снять CSS-класс |
| `panel.GetAttributeInt(name, default)` | Читать числовой атрибут |
| `panel.SetAttributeInt(name, val)` | Записать числовой атрибут |
| `panel.DeleteAsync(delay)` | Удалить панель через delay секунд |
| `panel.id` | ID панели |
| `panel.paneltype` | Тип панели ('Panel', 'CitadelHudHeroShop', …) |
| `panel.text` | Текст Label-панели |
| `$.Schedule(sec, fn)` | Отложенный вызов (аналог setTimeout в секундах) |
| `$.CancelScheduled(handle)` | Отменить $.Schedule |
| `$.FrameTime()` | Текущее время кадра |
| `$.Msg(...args)` | Вывод в консоль |
| `$.Localize(key)` | Локализованная строка по ключу |
| `$.DispatchEvent(name, ...args)` | Диспатч события |
| `$.RegisterForUnhandledEvent(name, fn)` | Подписка на событие |
| `$.CreatePanel(type, parent, id)` | Создать панель |

---

## 11. Справочник: панели Deadlock

| Тип панели | Описание |
|---|---|
| `CitadelHudHeroShop` | Root-панель всего магазина. Имеет CSS-классы `gShopOpen`, `showingWeapon`, `showingArmor`, `showingTech`, `showingSearch` |
| `CitadelShopModsList` | Контейнер списка предметов одной категории. `id=ShopModsListWeapon/Armor/Tech/All` |
| `CitadelShopMod` | Панель одного предмета. Имеет CSS-классы с именем предмета (`closeRange`), `owned`, `canAffordMod`, `cantAfford` |
| `CitadelShopModsBuild` | Панель выбранного билда (hidden) |

### События магазина

| Событие | Аргументы | Описание |
|---|---|---|
| `CitadelShopModsActivate` | `'EItemSlotType_WeaponMod'` / `'EItemSlotType_Armor'` / `'EItemSlotType_Tech'` / `'EItemSlotType_Favorites'` | Переключить активную вкладку |
| `CitadelQuickbuyAddMod` | `itemType: number` | Добавить в quickbuy (предположительно) |

### Структура идентификации предмета

- **CSS-класс**: `closeRange`, `techPower` и т.д. — стабильный, уникальный для каждого предмета
- **Тир**: определяется по id контейнера-родителя (`"Tier1Group"` → тир 1)
- **Категория**: определяется по list-id (`ShopModsListWeapon/Armor/Tech`)
- **ItemType**: числовой атрибут, хранится в `modIconContainer.GetAttributeInt('ItemType', 0)` — нестабильный, нужен только для quickbuy

---

## 12. Папка shop/ — эталонный пример

Папка `random-shop/shop/` содержит более полный мод с кастомными иконками и синхронизацией статусов. Он **не используется в игре** — он нужен как эталон для изучения структуры и API.

### Чем отличается от активного мода

| | `mod/` (активный) | `shop/` (пример) |
|---|---|---|
| Иконки предметов | Через CSS класс на wrapper | `icon.js` создаёт оверлеи |
| Мониторинг магазина | — | `update.js` MonitorShop() |
| Синхронизация owned | — | `update.js` SyncOwnedStatus() |
| Кастомные панели quickbuy | — | `hud_quickbuy.xml` |

### Ценные паттерны в shop/

- **`update.js` → `updateclass()`**: двойной dispatch `(Tab → Favorites)` с нужным классом восстановленным через 300ms — надёжный способ переключения вкладок.
- **`icon.js` → создание оверлеев**: как создавать кастомные панели поверх нативных через `$.CreatePanel`.
- **`SyncOwnedStatus()`**: как синхронизировать статус владения через атрибуты.
