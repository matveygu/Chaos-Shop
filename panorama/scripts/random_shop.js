(function () {
    'use strict';

    var root = $.GetContextPanel();
    var hud = root;
    while (hud.GetParent() && hud.paneltype !== 'CitadelHud') hud = hud.GetParent();
    if (hud.paneltype !== 'CitadelHud') hud = root;
    // The HUD outlives the shop panel but belongs to the current game.
    var instance = hud.GetAttributeInt('rs_shop_instance', 0) + 1;
    hud.SetAttributeInt('rs_shop_instance', instance);
    var current = null;
    try { current = JSON.parse(hud.GetAttributeString('rs_reserved_item', 'null')); } catch (e) {}
    var ru = typeof $.Language === 'function' ? $.Language() === 'russian' : /[А-Яа-яЁё]/.test($.Localize('#upgrade_close_range'));
    var categories = ['Weapon', 'Vitality', 'Spirit'];
    var categoryClasses = ['isWeapon', 'isArmor', 'isTech'];
    var categoryLabels = ru ? ['Оружие', 'Живучесть', 'Дух'] : categories;
    var enabled = [true, true, true];
    var numerals = ['', 'I', 'II', 'III', 'IV'];
    // Game item class -> artwork, equipment CSS class, and optional shared slot signature.
    // Signatures include the item's category, tier and active/passive type in scripts/abilities.vdata.
    var shopItems = {
        upgrade_clip_size: ['weapon/basic_magazine', 'clipSize'],
        upgrade_non_player_bonus: ['weapon/monster_rounds', 'reaperRounds'],
        upgrade_non_player_bonus_sacrifice: ['weapon/cultist_sacrifice', '', true],
        upgrade_chain_lightning: ['weapon/tesla_bullets', 'electrifiedBullets'],
        upgrade_capacitor: ['weapon/capacitor', 'electrifiedBullets'],
        upgrade_hollow_point_rounds: ['weapon/hollow_point', 'hollowPoint'],
        upgrade_pristine_emblem: ['weapon/opening_rounds', 'pristineEmblem'],
        upgrade_high_velocity_mag: ['weapon/high_velocity_rounds', 'highVelocityMag'],
        upgrade_lifestrike_gauntlets: ['vitality/melee_lifesteal', 'lifestrikeGauntlets'],
        upgrade_melee_rebuttal: ['vitality/rebuttal', 'parryRebuttal'],
        upgrade_counterspell: ['vitality/counterspell', 'parryRebuttal'],
        upgrade_weighted_shots: ['weapon/weighted_shots', 'closeRange'],
        upgrade_ancient_shield: ['brawl/ancient_shielding', 'closeRange'],
        upgrade_close_range: ['weapon/close_quarters', 'closeRange'],
        upgrade_long_range: ['weapon/long_range', 'longRange'],
        upgrade_slowing_bullets: ['weapon/slowing_bullets', 'slowingBullets'],
        upgrade_inhibitor: ['vitality/inhibitor', 'inhibitor'],
        upgrade_tech_defense_shredders: ['weapon/spirit_shredder_bullets', 'techResistShredder'],
        upgrade_dps_aura: ['weapon/heroic_aura', 'bulletDamageAura'],
        upgrade_targeted_silence: ['spirit/silence_glyph', 'targetedSilence'],
        upgrade_haunting_scream: ['brawl/haunting_scream', 'targetedSilence'],
        upgrade_proc_silence: ['weapon/silencer', 'empBullets'],
        upgrade_silencer: ['weapon/silencer', 'empBullets'],
        upgrade_berserker: ['weapon/berserker', 'berserker'],
        upgrade_fervor: ['weapon/frenzy', 'fervor'],
        upgrade_siphon_bullets: ['vitality/siphon_bullets', 'siphon_bullets'],
        upgrade_headshot_booster: ['weapon/headshot_booster', 'headshotBooster'],
        upgrade_headshot_booster2: ['weapon/weakening_headshot', 'headshotBooster'],
        upgrade_sharpshooter: ['weapon/sharp_shooter', 'longshot'],
        upgrade_headhunter: ['weapon/headhunter', 'headhunter'],
        upgrade_spellslinger_headshots: ['weapon/spellslinger_headshots', 'spellslingerHeadshots'],
        upgrade_banshee_slugs: ['weapon/crippling_headshot', 'bansheeSlugs'],
        upgrade_crackshot: ['weapon/mystic_shot', 'explosiveBullets'],
        upgrade_critshot: ['weapon/lucky_shot', 'critshot'],
        upgrade_close_quarter_combat: ['weapon/point_blank', 'pointBlank'],
        upgrade_toxic_bullets: ['weapon/toxic_bullets', 'toxicBullets'],
        upgrade_ricochet: ['weapon/ricochet', 'ricochet'],
        upgrade_apex_combat: ['brawl/apex_combat', 'ricochet'],
        upgrade_health: ['vitality/extra_health', 'upgrade_health'],
        upgrade_bullet_armor: ['vitality/bullet_resilience', 'bulletArmor', true],
        upgrade_tech_armor: ['vitality/spirit_resilience', 'techArmor'],
        upgrade_vampire: ['vitality/bullet_lifesteal', 'healthSstealingBullets'],
        upgrade_debuff_reducer: ['vitality/debuff_reducer', 'debuffReducer'],
        upgrade_reduce_debuff_duration: ['vitality/debuff_remover', 'debuffRemover'],
        upgrade_tech_purge: ['vitality/spirit_resilience', 'techPurge'],
        upgrade_improved_bullet_armor: ['vitality/bullet_resilience', 'improvedBulletArmor'],
        upgrade_metal_skin: ['vitality/metal_skin', 'metalSkin'],
        upgrade_healing_booster: ['vitality/healing_booster', 'healingBooster'],
        upgrade_chonky: ['vitality/fortitude', 'revitalizer'],
        upgrade_damage_recycler: ['vitality/leech', 'leech'],
        upgrade_sprint_booster: ['vitality/sprint_boots', 'sprintBooster'],
        upgrade_trophy_collector: ['vitality/trophy_collector', 'sprintBooster'],
        upgrade_cardio_calibrator: ['vitality/enduring_speed', 'cardioCalibrator'],
        upgrade_superior_stamina: ['vitality/stamina_mastery', 'superiorStamina'],
        upgrade_aerial_supremacy: ['brawl/aerial_mastery', 'superiorStamina'],
        upgrade_rapid_rounds: ['weapon/rapid_rounds', 'rapidRounds'],
        upgrade_improved_stamina: ['vitality/extra_stamina', 'improvedStamina'],
        upgrade_bullet_armor_reduction_aura: ['weapon/hunters_aura', 'bulletArmorReductionAura'],
        upgrade_grit: ['vitality/grit', 'bulletShield'],
        upgrade_weapon_shielding: ['vitality/weapon_shielding', 'bulletShield', true],
        upgrade_spirit_bubble: ['vitality/spirit_shielding', 'bulletShield', true],
        upgrade_regenerating_bullet_shield: ['vitality/battle_vest', 'bulletShield', true],
        upgrade_magic_shield: ['vitality/enchanters_emblem', 'techArmorPulse'],
        upgrade_improved_spirit: ['spirit/extra_spirit', 'techPower'],
        upgrade_mystic_regeneration: ['spirit/mystic_regen', 'endurance'],
        upgrade_soaring_spirit: ['spirit/improved_spirit', 'soaringSpirit'],
        upgrade_tech_overflow: ['weapon/spiritual_overflow', 'magicOverflow'],
        upgrade_return_fire: ['vitality/return_fire', 'lastStand'],
        upgrade_tech_range: ['spirit/greater_expansion', 'spiritualDominion'],
        upgrade_magic_reach: ['spirit/mystic_reach', 'techRange'],
        upgrade_extra_charge: ['spirit/extra_charge', 'extraCharge'],
        upgrade_health_stealing_magic: ['vitality/spirit_lifesteal', 'healthStealingTech'],
        upgrade_bullet_resist_shredder: ['spirit/bullet_resist_shredder', 'bulletResistShredder'],
        upgrade_mystic_reverb: ['spirit/mystic_reverb', 'magicReverb'],
        upgrade_magic_burst: ['spirit/mystic_burst', 'magicBurst'],
        upgrade_magic_shock: ['spirit/tankbuster', 'magicShock'],
        upgrade_magic_vulnerability: ['spirit/mystic_vulnerability', 'techVulnerability'],
        upgrade_healbane: ['vitality/healbane', 'healbane'],
        upgrade_magic_slow: ['spirit/mystic_slow', 'slowingTech'],
        upgrade_escalating_exposure: ['spirit/escalating_exposure', 'escalatingExposure', true],
        upgrade_rapid_recharge: ['spirit/rapid_recharge', 'rapidRecharge'],
        upgrade_omnicharge_pendant: ['brawl/omnicharge_pendant', 'rapidRecharge'],
        upgrade_magic_tempo: ['spirit/improved_cooldown', 'advancedRecharge'],
        upgrade_cooldown_reduction: ['spirit/superior_cooldown', 'spiritualFlow'],
        upgrade_transcendent_cooldown: ['spirit/transcendent_cooldown', '', true],
        upgrade_timeless_emblem: ['brawl/timeless_emblem', '', true],
        upgrade_shadow_step: ['brawl/shadow_step', 'warpStone'],
        upgrade_containment: ['spirit/slowing_hex', 'immobilize'],
        upgrade_spirit_sap: ['spirit/spirit_sap', 'focusedSilence'],
        upgrade_focus_lens: ['spirit/focus_lens', 'focusedSilence'],
        upgrade_withering_whip: ['spirit/rusted_barrel', 'slowingTech'],
        upgrade_greater_withering_whip: ['spirit/disarming_hex', 'disarm'],
        upgrade_rescue_beam: ['vitality/rescue_beam', 'medicBeam'],
        upgrade_rupture: ['spirit/decay', 'rupture'],
        upgrade_discord: ['spirit/scourge', 'rupture'],
        upgrade_target_stun: ['spirit/knockdown', 'knockdown'],
        upgrade_phantom_strike: ['vitality/phantom_strike', 'phantomStrike'],
        upgrade_warp_stone: ['vitality/warp_stone', 'warpStone'],
        upgrade_aoe_root: ['spirit/vortex_web', 'areaImmobilize'],
        upgrade_ability_refresher: ['spirit/refresher', 'abilityRefresher'],
        upgrade_ability_power_shard: ['spirit/echo_shard', 'powerShard'],
        upgrade_tech_damage_pulse: ['spirit/torment_pulse', 'tormentAura'],
        upgrade_cheat_death: ['vitality/cheat_death', 'tormentAura'],
        upgrade_cloaking_device_active: ['weapon/shadow_weave', 'cloakingDevice'],
        upgrade_rocket_booster: ['vitality/majestic_leap', 'rocketBooster'],
        upgrade_health_nova: ['vitality/healing_nova', 'healthNova'],
        upgrade_restorative_locket: ['vitality/restorative_locket', 'restorativeLocket'],
        upgrade_health_stimpak: ['vitality/healing_rite', 'stimPak'],
        upgrade_shrink_ray: ['brawl/shrink_ray', 'stimPak'],
        upgrade_infuser: ['vitality/infuser', 'infuser'],
        upgrade_guardian_ward: ['vitality/guardian_ward', 'savior'],
        upgrade_divine_barrier: ['vitality/divine_barrier', 'savior'],
        upgrade_thermal_detonator: ['weapon/alchemical_fire', 'techGrenade'],
        upgrade_blood_tribute: ['weapon/blood_tribute', '', true],
        upgrade_fleetfoot_boots: ['weapon/fleetfoot', 'fleetfootBoots'],
        upgrade_kinetic_sash: ['weapon/kinetic_dash', 'kineticSash'],
        upgrade_arcane_surge: ['spirit/arcane_surge', 'arcaneSurge'],
        upgrade_unstoppable: ['vitality/unstoppable', 'unstoppable'],
        upgrade_colossus: ['vitality/colossus', 'colossus'],
        upgrade_cold_front: ['spirit/cold_front', 'iceBlast'],
        upgrade_arctic_blast: ['spirit/arctic_blast', 'iceBlast'],
        upgrade_self_bubble: ['spirit/ethereal_shift', 'shiftingShroud'],
        upgrade_glitch: ['spirit/curse', 'glitch'],
        upgrade_arcane_extension: ['spirit/duration_extender', 'durationExtender'],
        upgrade_imbued_duration_extender: ['spirit/superior_duration', 'superiorDuration'],
        upgrade_glass_cannon: ['weapon/glass_cannon', 'glassCannon', true],
        upgrade_fury_trance: ['vitality/fury_trance', 'surgingPower'],
        upgrade_surging_power: ['vitality/vampiric_burst', 'surgingPower'],
        upgrade_boxing_glove: ['vitality/lifestrike', 'boxingGlove'],
        upgrade_acolytes_glove: ['spirit/spirit_strike', 'acolytesGlove'],
        upgrade_spirit_snatch: ['spirit/spirit_snatch', 'spiritSnatch'],
        upgrade_melee_charge: ['weapon/melee_charge', 'meleeCharge'],
        upgrade_crushing_fists: ['weapon/crushing_fists', 'meleeCharge'],
        upgrade_diviners_kevlar: ['vitality/diviners_kevlar', 'bulletShield'],
        upgrade_resonant_healing: ['spirit/radiant_regeneration', 'megaSpirit'],
        upgrade_boundless_spirit: ['spirit/boundless_spirit', 'megaSpirit'],
        upgrade_burst_fire: ['weapon/burst_fire', 'fireRatePlusPlus', true],
        upgrade_endurance: ['vitality/extra_regen', 'endurance'],
        upgrade_magic_storm: ['spirit/surge_of_power', 'magicStorm'],
        upgrade_suppressor: ['spirit/suppressor', 'weaponJammer'],
        upgrade_quick_silver: ['spirit/quicksilver_reload', 'fireRatePlus'],
        upgrade_ethereal_bullets: ['spirit/mercurial_magnum', 'fireRatePlus'],
        upgrade_intensifying_clip: ['weapon/intensifying_magazine', 'intensifyingClip'],
        upgrade_reinforcing_casings: ['weapon/escalating_resilience', 'reinforcingCasings'],
        upgrade_blitz_bullets: ['weapon/swift_striker', 'fireRatePlus', true],
        upgrade_veil_walker: ['vitality/veil_walker', 'veilWalker'],
        upgrade_vex_barrier: ['vitality/reactive_barrier', 'vexBarrier'],
        upgrade_auto_cleanse: ['vitality/indomitable', '', true],
        upgrade_medic_bullets: ['weapon/restorative_shot', 'medicBullets'],
        upgrade_titan_round: ['weapon/titanic_magazine', 'titanicMagazine'],
        upgrade_split_shot: ['weapon/split_shot', 'titanicMagazine'],
        upgrade_active_reload: ['weapon/active_reload', 'activeReload'],
        upgrade_magic_carpet: ['spirit/magic_carpet', 'magicCarpet'],
        upgrade_spirit_burn: ['spirit/spirit_burn', 'escalatingExposure', true],
        upgrade_ultimate_burst: ['spirit/lightning_scroll', 'ultimateBurst'],
        upgrade_absorbing_armor: ['vitality/witchmail', 'absorbingArmor', true],
        upgrade_healbuff: ['vitality/healing_tempo', 'healBuff'],
        upgrade_aprounds: ['weapon/armor_piercing_rounds', 'armorBreakingBullets'],
        upgrade_infinite_rounds: ['brawl/infinite_rounds', 'armorBreakingBullets'],
        upgrade_deflecting_armor: ['vitality/plated_armor', 'absorbingArmor', true],
        upgrade_spellbreaker: ['vitality/spellbreaker', '', true],
        upgrade_juggernaut: ['vitality/juggernaut', 'juggernaut'],
        upgrade_enchanted_holsters: ['weapon/spell_slinger', '', true],
        upgrade_weapon_backstabber: ['weapon/backstabber', '', true],
        upgrade_express_shot: ['weapon/express_shot', '', true],
        upgrade_icarus_wings: ['brawl/icarus_wings', '', true],
        upgrade_mystical_piano: ['brawl/mystical_piano', '', true],
        upgrade_nullification_aura: ['brawl/nullification_aura', '', true],
        upgrade_celestial_guidance: ['brawl/celestial_guidance', 'debuffReducer'],
        upgrade_eternal_gift: ['brawl/eternal_gift', '', true],
        upgrade_patrons_blessing: ['brawl/patrons_blessing', '', true],
        upgrade_eldritch_shot: ['brawl/eldritch_shot', 'explosiveBullets'],
        upgrade_cloak_of_opportunity: ['brawl/cloak_of_opportunity', '', true],
        upgrade_runed_gauntlets: ['brawl/runed_gauntlets', '', true],
        upgrade_electric_slippers: ['brawl/electric_slippers', '', true],
        upgrade_prism_blast: ['brawl/prism_blast', 'shiftingShroud'],
        upgrade_unstable_concoction: ['brawl/unstable_concoction', '', true],
        upgrade_shivas_bracelet: ['brawl/frostbite', '', true],
        upgrade_shadow_strike: ['brawl/shadow_strike', '', true],
        upgrade_bulletshredimbue: ['weapon/alchemical_seal', 'fireRatePlus'],
        upgrade_rechargingbullets: ['weapon/recharging_rounds', 'absorbingArmor'],
        upgrade_goose_egg: ['spirit/goose_egg', 'techPower']
    };
    var rollTier = 0;
    var loadTries = 0;
    var scheduled = false;
    var highlighted = null;
    var targetCards = [];
    var refreshCardsAt = 0;
    var followTarget = false;
    var tabClass = '';
    var tabGraceUntil = 0;

    function panel(id) { return root.FindChildTraverse(id); }
    function label(id, text) {
        var p = panel(id);
        if (p && p.text !== text) p.text = text;
    }
    function persist() {
        hud.SetAttributeString('rs_reserved_item', JSON.stringify(current));
        root.SetHasClass('rs-pending', !!current);
    }
    function validName(value) {
        return typeof value === 'string' && value.length > 0 && !/[{}]/.test(value);
    }
    function itemName(card) {
        var names = card.FindChildrenWithClassTraverse('modName');
        var name = names.length ? names[0].text : '';
        if (!validName(name) && typeof card.GetDialogVariable === 'function') name = card.GetDialogVariable('mod_name');
        return validName(name) ? name : '';
    }
    function amount(container, id) {
        var p = container && container.FindChildTraverse(id);
        return parseAmount(p && p.text);
    }
    function parseAmount(value) {
        var digits = String(value || '').replace(/[\s\u00a0\u202f.,']/g, '');
        return /^\d+$/.test(digits) ? Number(digits) : null;
    }
    function getCategory(card) {
        for (var i = 0; i < categories.length; i++) if (card.BHasClass(categoryClasses[i])) return i;
        return -1;
    }
    function acquired(card) { return card.BHasClass('owned') || card.BHasClass('usedAsComponent'); }
    function identify(card, name) {
        var image = card.FindChildTraverse('ModIconImage');
        var src = image && (image.src || image.GetAttributeString('src', '')) || '';
        var imageMatch = String(src).match(/[/]items[/]([a-z0-9_/]+?)(?:_psd[.]vtex(?:_c)?|[.]psd)$/i);
        var nameMatches = [], iconMatches = [];
        Object.keys(shopItems).forEach(function (token) {
            if ($.Localize('#' + token) === name) nameMatches.push(token);
            if (imageMatch && imageMatch[1] === shopItems[token][0]) iconMatches.push(token);
        });
        var matches = nameMatches.length && iconMatches.length ?
            nameMatches.filter(function (token) { return iconMatches.indexOf(token) !== -1; }) :
            (nameMatches.length ? nameMatches : iconMatches);
        var token = matches.length === 1 ? matches[0] : '';
        var art = imageMatch ? imageMatch[1] : (token && shopItems[token][0]);
        return { token: token, image: art ? 's2r://panorama/images/items/' + art + '_psd.vtex' : '' };
    }
    function draw(tier, list) {
        var cards = list.FindChildrenWithClassTraverse('mod_view');
        var seen = Object.create(null);
        var choices = [];
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.paneltype !== 'CitadelShopMod' || !card.BHasClass('ModTier' + tier)) continue;
            var category = getCategory(card);
            if (!enabled[category] || acquired(card) || card.BHasClass('itemDisabled') || card.BHasClass('disabledFromPurchasing')) continue;
            var name = itemName(card);
            var key = category + '|' + name;
            if (!name || seen[key]) continue;
            seen[key] = true;
            choices.push({ card: card, name: name, category: category });
        }
        var picked, identity;
        do {
            if (!choices.length) return false;
            picked = choices.splice(Math.floor(Math.random() * choices.length), 1)[0];
            identity = identify(picked.card, picked.name);
        } while (!identity.token);
        var serial = hud.GetAttributeInt('rs_roll_serial', 0) + 1;
        hud.SetAttributeInt('rs_roll_serial', serial);
        hud.SetAttributeString('rs_buy_status', 'pending');
        current = { name: picked.name, category: picked.category, tier: tier, token: identity.token,
            image: identity.image, slotClass: shopItems[identity.token][1], cost: amount(picked.card, 'ItemCost'), serial: serial };
        // Several upgrades share their equipment icon class. Require the exact catalog
        // card's owned state as a second signal for these items.
        current.activeItem = picked.card.BHasClass('isActiveItem');
        current.recentBefore = ChaosShopRecentCount(root, current.name);
        current.sharedSlotClass = !!shopItems[identity.token][2];
        current.beforeCount = ChaosShopCountEquipped(hud, current);

        targetCards = [picked.card];
        refreshCardsAt = 0;
        persist();
        renderItem();
        return true;
    }
    function renderItem() {
        var wrapper = panel('RSBigIconWrapper');
        var image = panel('RSIconImage');
        image.visible = !!current.image;
        if (current.image) image.SetImage(current.image);
        wrapper.SetHasClass('rs-has-art', !!current.image);
        label('RSFallbackTier', numerals[current.tier]);
        label('RSItemName', current.name);
        label('RSItemTier', categoryLabels[current.category] + '  ·  ' + (ru ? 'Уровень ' : 'Tier ') + numerals[current.tier]);
    }
    function findTarget(container) {
        var cards = container ? container.FindChildrenWithClassTraverse('mod_view') : [];
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.paneltype === 'CitadelShopMod' && card.BHasClass('ModTier' + current.tier)
                && card.BHasClass(categoryClasses[current.category]) && itemName(card) === current.name) return card;
        }
        return null;
    }
    function matchingCards() {
        var now = Date.now();
        // The catalog can rebuild or recycle a panel when the player changes tabs.
        targetCards = targetCards.filter(function (card) {
            return card.IsValid() && card.BHasClass('ModTier' + current.tier)
                && card.BHasClass(categoryClasses[current.category]) && itemName(card) === current.name;
        });
        if (now >= refreshCardsAt) {
            targetCards = ['ShopModsFiltered', 'ShopModsSelectedBuild', 'ShopModsRecommended']
                .map(function (id) { return findTarget(panel(id)); })
                .filter(function (card) { return !!card; });
            refreshCardsAt = now + 700;
        }
        return targetCards;
    }
    function spendableSouls() {
        var wallet = hud.FindChildTraverse('gold_and_ap_container');
        var balance = amount(wallet && wallet.FindChildTraverse('CurrentGoldAmount'), 'hudCurGoldLabel');
        return balance != null ? balance : amount(panel('CurrentGoldAmount'), 'hudCurGoldLabel');
    }
    function stopHighlight() {
        if (highlighted && highlighted.IsValid()) highlighted.RemoveClass('rs-native-target');
        highlighted = null;
    }
    function markTarget(card) {
        if (highlighted === card) return;
        stopHighlight();
        if (!card) return;
        highlighted = card;
        card.AddClass('rs-native-target');
        if (typeof card.ScrollParentToMakePanelFit === 'function') card.ScrollParentToMakePanelFit(1, false);
    }
    function purchaseStatus(message) { label('RSPurchaseStatus', message); }
    function monitor(menuOpen) {
        var cards = matchingCards();
        var card = cards[0];
        if (followTarget && menuOpen) markTarget(card);
        if (hud.GetAttributeInt('rs_equipped_serial', -1) === current.serial) {
            label('RSResult', (ru ? 'Куплено: ' : 'Purchased: ') + current.name);
            current = null;
            persist();
            stopHighlight();
            followTarget = false;
            return;
        }
        if (!menuOpen) return;
        var souls = spendableSouls();
        var reportedCost = card && amount(card, 'ItemCost');
        if (reportedCost != null && reportedCost !== current.cost) { current.cost = reportedCost; persist(); }
        var cost = current.cost;
        label('RSPrice', cost == null ? '' : (ru ? 'Цена · ' : 'Price · ') + cost);
        var status = hud.GetAttributeString('rs_buy_status', 'pending');
        var fraction = cost > 0 && souls != null ? Math.min(100, 100 * souls / cost) : 0;
        panel('RSProgress').style.width = fraction + '%';
        if (status === 'funds' && cost != null && souls != null) {
            purchaseStatus((ru ? 'Не хватает душ: ' : 'Souls needed: ') + Math.max(0, cost - souls));
        } else if (status === 'zone') {
            purchaseStatus(ru ? 'Вернись в зону магазина.' : 'Return to shop range.');
        } else if (status === 'blocked') {
            purchaseStatus(ru ? 'Покупка сейчас недоступна.' : 'Purchasing is currently unavailable.');
        } else if (status === 'sent') {
            purchaseStatus(ru ? 'Покупка отправлена.' : 'Purchase requested.');
        } else if (status === 'unconfirmed') {
            purchaseStatus(ru ? 'Предмет пока не появился в инвентаре.' : 'Waiting for the item to appear in inventory.');
        } else if (status === 'card') {
            purchaseStatus(ru ? 'Ожидание карточки предмета.' : 'Waiting for the shop item card.');
        } else if (status === 'error') {
            purchaseStatus(ru ? 'Быстрая покупка недоступна. Открой карточку предмета.' : 'Quickbuy unavailable. Open the item card.');
        } else {
            purchaseStatus(ru ? 'Ожидание автопокупки.' : 'Waiting to buy.');
        }
    }
    function updatePrices(list) {
        var rows = list ? list.FindChildrenWithClassTraverse('tierRow') : [];
        for (var i = 0; i < rows.length; i++) {
            var sticker = rows[i].FindChildrenWithClassTraverse('CostLabel')[0];
            var price = sticker && sticker.GetChildCount() > 1 ? parseAmount(sticker.GetChild(1).text) : null;
            if (price == null) continue;
            for (var t = 1; t <= 4; t++) if (rows[i].BHasClass('EModTier_' + t)) label('RSCost' + t, String(price));
        }
    }
    function schedule(delay) {
        if (scheduled) return;
        scheduled = true;
        $.Schedule(delay, tick);
    }
    function tick() {
        scheduled = false;
        if (!root.IsValid() || !hud.IsValid() || hud.GetAttributeInt('rs_shop_instance', 0) !== instance) return;
        var active = root.BHasClass('gShowingRandom');
        var open = root.BHasClass('gShopOpen');
        if (open && active && tabClass && !root.BHasClass(tabClass) && Date.now() >= tabGraceUntil) {
            leaveRandom();
            active = false;
        }
        if (current) monitor(open);
        if (open && active && !current) {
            var list = panel('ShopModsFiltered');
            updatePrices(list);
            if (rollTier) {
                if (list && root.BHasClass(tabClass) && draw(rollTier, list)) {
                    rollTier = 0;
                    monitor(true);
                } else if (++loadTries >= 8) {
                    rollTier = 0;
                    label('RSResult', ru ? 'Нет доступных предметов. Проверь выбранные категории и фильтры магазина.' :
                        'No eligible items. Check your categories and shop filters.');
                }
            }
        }
        if (!open) rollTier = 0;
        if (active || current) schedule(open ? 0.35 : 1);
    }
    function leaveRandom() {
        root.RemoveClass('gShowingRandom');
        rollTier = 0;
        followTarget = false;
        stopHighlight();
    }
    function selectCatalog(category) {
        var tabs = ['Weapon', 'Vitality', 'Spirit'];
        var classes = ['showingWeapon', 'showingArmor', 'showingTech'];
        tabClass = category == null ? 'showingAllItems' : classes[category];
        tabGraceUntil = Date.now() + 1000;
        $.DispatchEvent('CitadelSelectShopTab', 'EShopTab_' + (category == null ? 'AllItems' : tabs[category]));
    }
    root.ActivateRandomTab = function () {
        stopHighlight();
        followTarget = false;
        root.AddClass('gShowingRandom');
        selectCatalog(current ? current.category : null);
        if (current) renderItem();
        schedule(0.1);
    };
    root.RandomShopSelectTab = function (tab, sound) {
        leaveRandom();
        $.DispatchEvent('CitadelSelectShopTab', tab);
        $.DispatchEvent('PlaySoundEffect', sound);
    };
    root.RandomShopToggleCategory = function (category) {
        var i = categories.indexOf(category);
        if (current || rollTier || i < 0 || (enabled[i] && enabled.filter(Boolean).length === 1)) return;
        enabled[i] = !enabled[i];
        panel('RSFilter' + category).SetHasClass('rs-on', enabled[i]);
        label('RSResult', '');
    };
    root.RandomShopRollTier = function (tier) {
        if (current || rollTier || !numerals[tier] || !root.BHasClass('gShowingRandom')) return;
        rollTier = tier;
        loadTries = 0;
        if (tabClass !== 'showingAllItems') selectCatalog(null);
        label('RSResult', ru ? 'Выбираем предмет…' : 'Drawing an item…');
        schedule(0.1);
    };
    root.RandomShopShowItem = function () {
        if (!current) return;
        leaveRandom();
        followTarget = true;
        selectCatalog(current.category);
        schedule(0.1);
    };

    for (var i = 0; i < categories.length; i++) label('RSLabel' + categories[i], categoryLabels[i]);
    label('RSHint', ru ? 'Выбери категории и уровень. Выпавший предмет закрепится до покупки.' :
        'Choose categories and a tier. Your roll stays pinned until purchased.');
    label('RSPinnedLabel', ru ? 'Закреплённый предмет' : 'Pinned item');
    label('RSShowLabel', ru ? 'Показать предмет в магазине' : 'Show item in shop');
    persist();
    if (current) renderItem();
    if (root.BHasClass('gShowingRandom')) root.ActivateRandomTab();
    else if (current) schedule(0.1);
})();
