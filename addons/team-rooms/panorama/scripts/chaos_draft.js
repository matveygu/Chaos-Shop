// Version 1 shared pool from scripts/abilities.vdata. Index by tier and Weapon, Vitality, Spirit.
var ChaosDraftPoolV1 = [
    [
        'clip_size close_range headshot_booster high_velocity_mag medic_bullets non_player_bonus rapid_rounds',
        'endurance grit health health_stimpak improved_stamina lifestrike_gauntlets melee_rebuttal sprint_booster',
        'acolytes_glove extra_charge goose_egg improved_spirit magic_burst magic_reach mystic_regeneration withering_whip'
    ],
    [
        'active_reload blitz_bullets crackshot fleetfoot_boots headshot_booster2 intensifying_clip kinetic_sash long_range melee_charge pristine_emblem rechargingbullets slowing_bullets split_shot tech_defense_shredders titan_round weapon_backstabber',
        'cardio_calibrator debuff_reducer guardian_ward healbane healing_booster health_stealing_magic magic_shield regenerating_bullet_shield restorative_locket return_fire spirit_bubble trophy_collector vampire vex_barrier weapon_shielding',
        'arcane_extension arcane_surge bullet_resist_shredder cold_front containment magic_slow magic_tempo magic_vulnerability quick_silver soaring_spirit spirit_sap suppressor'
    ],
    [
        'berserker blood_tribute bullet_armor_reduction_aura bulletshredimbue burst_fire chain_lightning cloaking_device_active close_quarter_combat dps_aura express_shot headhunter hollow_point_rounds non_player_bonus_sacrifice reinforcing_casings sharpshooter spellslinger_headshots thermal_detonator toxic_bullets weighted_shots',
        'boxing_glove chonky counterspell fury_trance health_nova improved_bullet_armor metal_skin reduce_debuff_duration rescue_beam rocket_booster superior_stamina tech_purge veil_walker warp_stone',
        'cooldown_reduction greater_withering_whip imbued_duration_extender magic_shock magic_storm rapid_recharge resonant_healing rupture spirit_snatch target_stun targeted_silence tech_damage_pulse tech_range'
    ],
    [
        'aprounds banshee_slugs capacitor critshot crushing_fists enchanted_holsters fervor glass_cannon proc_silence ricochet tech_overflow',
        'absorbing_armor auto_cleanse cheat_death colossus damage_recycler deflecting_armor divine_barrier diviners_kevlar healbuff infuser inhibitor juggernaut phantom_strike siphon_bullets spellbreaker surging_power unstoppable',
        'ability_power_shard ability_refresher aoe_root arctic_blast boundless_spirit discord escalating_exposure ethereal_bullets focus_lens glitch magic_carpet mystic_reverb self_bubble spirit_burn transcendent_cooldown ultimate_burst'
    ]
];

// The same version, seed, tier, category mask and round produce the same hand on any client.
function ChaosDraftSharedPool(tier, mask) {
    var tokens = [];
    ChaosDraftPoolV1[tier - 1].forEach(function (group, category) {
        if (!(mask & (1 << category))) return;
        group.split(' ').forEach(function (suffix) { if (suffix) tokens.push('upgrade_' + suffix); });
    });
    return tokens;
}

function ChaosDraftCode(hand) {
    return 'CS1.' + hand.seed + '.' + hand.tier + hand.mask + '.' + hand.round + (hand.rerolled ? 'R' : '');
}

function ChaosDraftParse(text) {
    var value = String(text || '').trim().toUpperCase();
    if (/^[A-Z0-9]{0,10}$/.test(value)) return { seed: value };
    var match = /^CS1\.([A-Z0-9]{1,10})\.([1-4])([1-7])\.([1-9][0-9]{0,4})(R?)$/.exec(value);
    return match && { seed: match[1], tier: +match[2], mask: +match[3], round: +match[4], rerolled: !!match[5] };
}

function ChaosDraftRandom(key) {
    var state = 2166136261;
    for (var i = 0; i < key.length; i++) state = Math.imul(state ^ key.charCodeAt(i), 16777619) >>> 0;
    return function () {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function ChaosDraftDeal(pool, previous, random) {
    var fresh = pool.filter(function (token) { return previous.indexOf(token) < 0; });
    var repeats = pool.filter(function (token) { return previous.indexOf(token) >= 0; });
    var result = [];
    while (result.length < 3 && (fresh.length || repeats.length)) {
        var remaining = fresh.length ? fresh : repeats;
        result.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
    }
    return result;
}

function ChaosDraftSharedHand(hand) {
    var pool = ChaosDraftSharedPool(hand.tier, hand.mask);
    var key = [hand.seed, hand.tier, hand.mask, hand.round].join('/');
    var first = ChaosDraftDeal(pool, [], ChaosDraftRandom(key));
    return hand.rerolled ? ChaosDraftDeal(pool, first, ChaosDraftRandom(key + '/R')) : first;
}
