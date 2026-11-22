// Native equipment slots live under the local hero's LowerLeft HUD. The shop,
// scoreboard and quickbuy queue all contain other CitadelModIcon panels.
function ChaosShopCountEquipped(hud, item) {
    var local = hud.FindChildTraverse('LowerLeft');
    if (!local || hud.BHasClass('spec_mode') || hud.BHasClass('TeamSpectator') || hud.BHasClass('dead')) return -1;
    var bag = local.FindChildTraverse('ModPurchasedPanelUniversal');
    if (!bag || !bag.FindChildTraverse('ModIconsContainer')) return -1;
    var pockets = [bag, local.FindChildTraverse('ModPurchasedPanelUniversalLocked')];
    var category = ['isWeapon', 'isArmor', 'isTech'][item.category];
    var count = 0;
    pockets.forEach(function (pocket) {
        if (!pocket) return;
        pocket.FindChildrenWithClassTraverse('hasAbility').forEach(function (slot) {
            if (slot.paneltype !== 'CitadelModIcon' || !slot.BHasClass(category) || !slot.BHasClass('isTier' + item.tier)) return;
            if (typeof item.activeItem === 'boolean' && slot.BHasClass('isActiveItem') !== item.activeItem) return;
            var icon = slot.FindChildTraverse('modIconContainer');
            if (icon && (!item.slotClass || icon.BHasClass(item.slotClass))) count++;
        });
    });
    return count;
}

function ChaosShopRecentCount(shop, name) {
    var history = shop && shop.FindChildTraverse('RecentPurchasesContainer');
    if (!history) return -1;
    return history.FindChildrenWithClassTraverse('recentModPurchaseName').filter(function (label) {
        return label.text === name;
    }).length;
}
