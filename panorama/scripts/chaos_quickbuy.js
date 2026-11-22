(function () {
    'use strict';
    var quick = $.GetContextPanel();
    var hud = quick;
    while (hud.GetParent() && hud.paneltype !== 'CitadelHud') hud = hud.GetParent();
    if (hud.paneltype !== 'CitadelHud') return;
    var generation = hud.GetAttributeInt('rs_quickbuy_generation', 0) + 1;
    hud.SetAttributeInt('rs_quickbuy_generation', generation);
    var cachedCard = null;
    var wallet = null;
    var roomShop = null;
    var lastReceipt='', receiptRetry=0, receiptDelay=0;

    // This HUD remains scheduled even when the game suspends the hidden shop layout.
    function syncRoom() {
        var page=hud.GetAttributeString('rs_team_page','');
        if (!page) return;
        if (!roomShop || !roomShop.IsValid()) roomShop=hud.FindChildTraverse('CitadelHudHeroShop');
        if (!roomShop) return;
        var visible=hud.GetAttributeInt('rs_team_mode',0) && roomShop.BHasClass('gShopOpen') && roomShop.BHasClass('gShowingRandom') ? 1 : 0;
        if (Date.now()<Number(hud.GetAttributeString('rs_view_after','0'))) return;
        var received=hud.GetAttributeString('rs_team_receipt','');
        var pick=hud.GetAttributeString('rs_live_pick','');
        var confirmed=received && pick===received+'.'+hud.GetAttributeInt('rs_receipt_index',-1);
        var sendReceipt=confirmed && (lastReceipt!==pick || Date.now()>=receiptRetry);
        if (!sendReceipt && visible===hud.GetAttributeInt('rs_room_visible',1)) return;
        var frame=roomShop.FindChildTraverse('RSRoomBrowser');
        if (!frame || !frame.IsValid() || frame.GetAttributeInt('rs_room_frame',-1)!==hud.GetAttributeInt('rs_room_frame',0)) return;
        if (sendReceipt) {
            var match=/^([0-9A-F]{10})\.(\d+)(R?)\.([0-2])$/.exec(pick);
            if (match) {
                receiptDelay=lastReceipt===pick ? Math.min(60000,receiptDelay*2) : 3000;
                lastReceipt=pick; receiptRetry=Date.now()+receiptDelay;
                hud.SetAttributeString('rs_view_after',String(Date.now()+700));
                frame.SetURL(page+'#op=finish&code='+match[1]+'&round='+match[2]+'&r='+(match[3]?'1':'0')+'&index='+match[4]+'&n='+Date.now());
                return;
            }
        }
        frame.SetURL(page+'#view='+visible);
        hud.SetAttributeInt('rs_room_visible',visible);
    }

    function status(value) {
        if (hud.GetAttributeString('rs_buy_status', '') !== value) hud.SetAttributeString('rs_buy_status', value);
    }
    function balance() {
        if (!wallet || !wallet.IsValid()) {
            var box = hud.FindChildTraverse('gold_and_ap_container');
            var amount = box && box.FindChildTraverse('CurrentGoldAmount');
            wallet = amount && amount.FindChildTraverse('hudCurGoldLabel');
        }
        for (var p = wallet; p; p = p.GetParent()) {
            if (p.BHasClass('infiniteMoney')) return Infinity;
        }
        var digits = wallet && String(wallet.text).replace(/[\s\u00a0\u202f.,']/g, '');
        return digits && /^\d+$/.test(digits) ? Number(digits) : null;
    }
    function matches(card, item) {
        if (!card || !card.IsValid() || card.paneltype !== 'CitadelShopMod' ||
            !card.BHasClass(['isWeapon', 'isArmor', 'isTech'][item.category]) || !card.BHasClass('ModTier' + item.tier)) return false;
        var name = card.FindChildrenWithClassTraverse('modName')[0];
        return !!name && name.text === item.name;
    }
    function findCard(shop, item) {
        if (matches(cachedCard, item)) return cachedCard;
        if (!shop) return null;
        var catalog = shop.FindChildTraverse('ShopModsFiltered');
        if (!catalog) return null;
        var cards = catalog.FindChildrenWithClassTraverse('mod_view');
        for (var i = 0; i < cards.length; i++) {
            if (matches(cards[i], item)) return (cachedCard = cards[i]);
        }
        return null;
    }
    function processItem(item) {
        var serial = item.serial;
        if (hud.GetAttributeInt('rs_equipped_serial', -1) === serial) return;
        var shop = hud.FindChildTraverse('CitadelHudHeroShop');
        var card = findCard(shop, item);
        var count = ChaosShopCountEquipped(hud, item);
        // Restored layouts may see the roll before the native inventory initializes.
        if (count < 0) { status('blocked'); return; }
        var before = item.beforeCount;
        if (before == null || before < 0) {
            if (hud.GetAttributeInt('rs_baseline_serial', -1) !== serial) {
                hud.SetAttributeInt('rs_baseline_count', count);
                hud.SetAttributeInt('rs_baseline_serial', serial);
            }
            before = hud.GetAttributeInt('rs_baseline_count', count);
        }
        var newSlot = count > before;
        var owned = !!card && card.BHasClass('owned');
        // A fresh, named purchase row can disambiguate items with identical-looking
        // slots. The local equipment count must independently have increased.
        var namedReceipt = newSlot && item.sharedSlotClass && item.recentBefore >= 0 &&
            ChaosShopRecentCount(shop, item.name) > item.recentBefore;
        if (newSlot && (!item.sharedSlotClass || owned || namedReceipt)) {
            hud.SetAttributeInt('rs_equipped_serial', serial);
            if (item.team) {
                hud.SetAttributeString('rs_team_receipt',item.team);
                hud.SetAttributeInt('rs_receipt_index',item.teamIndex);
            }
            status('equipped');
            $.Msg('[Chaos Shop] Inventory confirmed: ' + item.name + ' (' + item.token + ')');
            return;
        }
        var sent = hud.GetAttributeInt('rs_sent_serial', -1) === serial;
        // An acquisition or a bought card can arrive before the other HUD updates.
        // Never activate an owned card: that can open the sell action.
        if ((newSlot && sent) || owned || (card && card.BHasClass('usedAsComponent'))) { status('unconfirmed'); return; }

        var zone = quick.BHasClass('InShopZone') || quick.FindChildrenWithClassTraverse('InShopZone').length > 0 ||
            (typeof quick.BAscendantHasClass === 'function' && quick.BAscendantHasClass('InShopZone'));
        var open = !!shop && shop.BHasClass('gShopOpen');
        var reason = '';
        if (!zone) reason = 'zone';
        else if (!card) reason = 'card';
        else if (['inCombat','purchasingDisabled','gEditingBuilds','TeamSpectator','spec_mode','dead','isShowingTrainingPage'].some(function (c) {
            return quick.BHasClass(c) || hud.BHasClass(c) || (open && shop.BHasClass(c));
        }) || card.BHasClass('itemDisabled') || card.BHasClass('disabledFromPurchasing')) reason = 'blocked';
        else {
            var souls = balance();
            var affordable = souls === Infinity || (souls != null && item.cost != null ? souls >= item.cost : card.BHasClass('canAffordMod'));
            if (!affordable) reason = 'funds';
        }
        if (reason) {
            status(reason);
            if (sent && (reason === 'zone' || reason === 'funds' || reason === 'blocked')) hud.SetAttributeInt('rs_sent_serial', -1);
            return;
        }
        if (sent) {
            if (Date.now() - Number(hud.GetAttributeString('rs_sent_at', '0')) > 2500 &&
                hud.GetAttributeString('rs_buy_status', '') === 'sent') {
                status('unconfirmed');
                $.Msg('[Chaos Shop] No inventory confirmation yet: ' + item.token);
            }
            return;
        }
        hud.SetAttributeInt('rs_sent_serial', serial);
        hud.SetAttributeString('rs_sent_at', String(Date.now()));
        $.DispatchEvent('Activated', card, 'mouse');
        status('sent');
        $.Msg('[Chaos Shop] Shop card activated: ' + item.token + ' shopOpen=' + open);
    }
    function watch() {
        if (!quick.IsValid() || !hud.IsValid() || hud.GetAttributeInt('rs_quickbuy_generation', 0) !== generation) return;
        var pending = hud.GetAttributeString('rs_reserved_item', 'null');
        if (pending !== 'null') {
            try {
                var item = JSON.parse(pending);
                if (item && item.token) processItem(item);
            } catch (e) {
                if (hud.GetAttributeString('rs_buy_status', '') !== 'error') $.Msg('[Chaos Shop] Quickbuy error: ' + e);
                status('error');
            }
        } else cachedCard = null;
        syncRoom();
        $.Schedule(pending === 'null' ? 0.25 : 0.15, watch);
    }
    watch();
})();
