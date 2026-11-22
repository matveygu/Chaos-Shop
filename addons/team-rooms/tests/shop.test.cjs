const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const panorama = process.argv[2] || path.join(__dirname, '../panorama');
const inventoryScript = fs.readFileSync(path.join(panorama,'scripts/chaos_inventory.js'),'utf8');
const draftScript = fs.readFileSync(path.join(panorama, 'scripts/chaos_draft.js'), 'utf8');
const shopScript = draftScript + '\n' + fs.readFileSync(path.join(panorama, 'scripts/random_shop.js'), 'utf8');
const workerScript = fs.readFileSync(path.join(panorama, 'scripts/chaos_quickbuy.js'), 'utf8');
const xml = fs.readFileSync(path.join(panorama,'layout/citadel_hud_hero_shop.xml'),'utf8');
assert.match(fs.readFileSync(path.join(panorama,'layout/hud_quickbuy.xml'),'utf8'),/scripts\/chaos_quickbuy\.vjs/);
class Panel {
  constructor(id = '', type = 'Panel', parent = null, classes = []) {
    Object.assign(this,{id,paneltype:type,parent,children:[],text:'',style:{},attrs:{},classes:new Set(classes),valid:true});
    if (parent) parent.children.push(this);
  }
  GetParent(){return this.parent;}
  IsValid(){return this.valid;}
  DeleteAsync(){this.valid=false;}
  SetURL(value){this.url=value;}
  BHasClass(c){return this.classes.has(c);}
  AddClass(c){this.classes.add(c);}
  RemoveClass(c){this.classes.delete(c);}
  SetHasClass(c,v){v?this.AddClass(c):this.RemoveClass(c);}
  GetAttributeInt(k,d){return this.attrs[k]??d;}
  GetAttributeString(k,d){return this.attrs[k]??d;}
  SetAttributeInt(k,v){this.attrs[k]=v;}
  SetAttributeString(k,v){this.attrs[k]=v;}
  FindChildTraverse(id){return this.children.find(c=>c.id===id) || this.children.map(c=>c.FindChildTraverse(id)).find(Boolean);}
  FindChildrenWithClassTraverse(c){return this.children.flatMap(p=>[...(p.BHasClass(c)?[p]:[]),...p.FindChildrenWithClassTraverse(c)]);}
  GetChildCount(){return this.children.length;}
  GetChild(i){return this.children[i];}
  SetImage(src){this.src=src;}
  ScrollParentToMakePanelFit(){this.scrolled=true;}
}
const hud = new Panel('HUD','CitadelHud');
const shop = new Panel('CitadelHudHeroShop','CitadelHudHeroShop',hud,['gShopOpen']);
const quick = new Panel('CitadelHudQuickbuy','CitadelHudQuickbuy',hud);
const lower = new Panel('LowerLeft','Panel',hud);
const bag = new Panel('ModIconsContainer','Panel',new Panel('ModPurchasedPanelUniversal','CitadelModsPurchasedPanel',lower));
const wallet = new Panel('gold_and_ap_container','Panel',hud);
const gold = new Panel('hudCurGoldLabel','Label',new Panel('CurrentGoldAmount','Panel',wallet));
for (const [,id] of xml.matchAll(/id="(RS\w+|ShopModsFiltered|ShopModsSelectedBuild|ShopModsRecommended)"/g)) new Panel(id,'Panel',shop);
const catalog = shop.FindChildTraverse('ShopModsFiltered');
const card = new Panel('','CitadelShopMod',catalog,['mod_view','ModTier1','isWeapon']);
new Panel('','Label',card,['modName']).text='Close Quarters';
new Panel('ItemCost','Label',card).text='800';
new Panel('ModIconImage','Image',card).src='s2r://panorama/images/items/weapon/close_quarters_psd.vtex';
const tabs={EShopTab_Weapon:'showingWeapon',EShopTab_Vitality:'showingArmor',EShopTab_Spirit:'showingTech',EShopTab_AllItems:'showingAllItems',EShopTab_Build:'showingFavorites'};
let now=0, timers=[], requests=[], logs=[], reject=false;
function run(source, context) {
  const $={
    CreatePanel:(type,parent,id)=>new Panel(id,type,parent),
    RegisterEventHandler:(name,panel,fn)=>{panel[name]=fn;},
    GetContextPanel:()=>context, Language:()=>'russian', Msg:m=>logs.push(m),
    Localize:key=>key==='#upgrade_close_range'?'Close Quarters':key,
    Schedule:(seconds,fn)=>timers.push({at:now+seconds*1000,fn,context}),
    DispatchEvent:(name,...args)=>{
      if(name==='CitadelSelectShopTab') {
        assert.equal(context,shop);
        for(const c of Object.values(tabs)) shop.RemoveClass(c);
        shop.AddClass(tabs[args[0]]);
      } else if(name==='Activated') {
        assert.equal(context,quick);
        assert.deepEqual(args,[card,'mouse']);
        requests.push({open:shop.BHasClass('gShopOpen'),time:now});
        if(reject) throw Error('simulated dispatch rejection');
      } else assert.equal(name,'PlaySoundEffect','unexpected native event');
    }
  };
  vm.runInNewContext(inventoryScript + '\n' + source,{$,Date:{now:()=>now}});
}
function advance(ms) {
  const end=now+ms;
  while(true) {
    // A hidden shop receives no timers in this fixture. Its HUD sibling still runs.
    const next=timers.filter(t=>t.context!==shop || shop.BHasClass('gShopOpen')).sort((a,b)=>a.at-b.at)[0];
    if(!next || next.at>end) break;
    timers.splice(timers.indexOf(next),1);
    now=Math.max(now,next.at);
    next.fn();
  }
  now=end;
}
function pending(){return JSON.parse(hud.GetAttributeString('rs_reserved_item','null'));}
function roll() {
  shop.AddClass('gShopOpen');
  shop.ActivateRandomTab();
  shop.RandomShopRollTier(1);
  shop.RandomShopRollTier(4);
  advance(1250);
  assert.equal(pending().token,'upgrade_close_range');
  assert.equal(pending().tier,1);
}
function closeShop() {shop.RemoveClass('gShopOpen');}
function equip(css='closeRange',category='isWeapon',tier=1) {
  const slot = new Panel('','CitadelModIcon',bag,['hasAbility',category,'isTier'+tier]);
  new Panel('modIconContainer','Panel',slot,[css]);
  return slot;
}
function confirmed() {
  shop.AddClass('gShopOpen');
  advance(1150);
  assert.equal(pending(),null);
}
gold.text='200';
run(shopScript,shop);
run(workerScript,quick);
roll();
quick.AddClass('InShopZone');
advance(800);
assert.match(shop.FindChildTraverse('RSPurchaseStatus').text,/600/);
assert.equal(requests.length,0);
quick.RemoveClass('InShopZone');
closeShop();
gold.text='800';
advance(1000);
assert.equal(requests.length,0);
quick.AddClass('InShopZone');
advance(400);
assert.equal(requests.length,1);
assert.equal(requests[0].open,false);
run(workerScript,quick);
advance(3500);
assert.equal(requests.length,1);
assert.equal(hud.attrs.rs_buy_status,'unconfirmed');
card.AddClass('usedAsComponent');
shop.AddClass('gShopOpen');
advance(1200);
assert(pending(),'a catalog component is not an inventory receipt');
card.RemoveClass('usedAsComponent');card.AddClass('owned');
advance(1200);
assert(pending(),'an owned card without an equipped slot is not a receipt');
card.RemoveClass('owned');closeShop();
equip('techPower','isTech');
advance(500);
assert.notEqual(hud.attrs.rs_equipped_serial,pending().serial);
equip();
advance(500);
assert.equal(hud.attrs.rs_equipped_serial,pending().serial);
confirmed();
assert.equal(requests.length,1);
quick.RemoveClass('InShopZone');
gold.text='200';
roll(); closeShop();
quick.AddClass('InShopZone');
advance(500);
assert.equal(requests.length,1);
card.AddClass('canAffordMod'); advance(500); assert.equal(requests.length,1);
card.RemoveClass('canAffordMod'); quick.AddClass('inCombat'); gold.text='800'; advance(600);
assert.equal(requests.length,1);
quick.RemoveClass('inCombat');advance(400);
assert.equal(requests.length,2);
assert.equal(requests[1].open,false);
equip();advance(500);confirmed();
assert.equal(requests.length,2);
gold.text='0';quick.RemoveClass('InShopZone');roll(); closeShop();
wallet.AddClass('infiniteMoney');quick.AddClass('InShopZone');advance(400);
assert.equal(requests.length,3);
equip();advance(500);confirmed();wallet.RemoveClass('infiniteMoney');
// Extra Spirit and Golden Goose Egg share techPower, tier and category.
card.RemoveClass('isWeapon');card.AddClass('isTech');card.AddClass('isActiveItem');
card.FindChildrenWithClassTraverse('modName')[0].text='Golden Goose Egg';
card.FindChildTraverse('ModIconImage').src='s2r://panorama/images/items/spirit/goose_egg_psd.vtex';
quick.RemoveClass('InShopZone'); shop.ActivateRandomTab(); shop.RandomShopRollTier(1); advance(1000);
assert.equal(pending().token,'upgrade_goose_egg');assert.equal(pending().sharedSlotClass,false);
gold.text='800';closeShop();quick.AddClass('InShopZone');advance(500);
assert.equal(requests.length,4);
equip('techPower','isTech');advance(500);
assert.notEqual(hud.attrs.rs_equipped_serial,pending().serial);
shop.AddClass('gShopOpen');advance(800);assert(pending());
equip('techPower','isTech').AddClass('isActiveItem');advance(800);confirmed();
assert.equal(requests.length,4);
console.log('PASS: exact native card activation with shop timers frozen, real slot required, duplicate icon classes, unrelated item, range, funds, combat, HUD reload, infinite funds and suppression of duplicate purchases.');

const engine = vm.createContext({});
vm.runInContext(draftScript, engine);
function hand() { return JSON.parse(hud.GetAttributeString('rs_draft_hand', 'null')); }
function view(id) { return shop.FindChildTraverse(id); }
const codeField = view('RSSeed');
const first = { tier: 1, mask: 7, seed: 'FRIENDS', round: 12, rerolled: false };
for (let tier = 1; tier <= 4; tier++) {
  for (let mask = 1; mask <= 7; mask++) {
    for (let round = 1; round <= 20; round++) {
      const spec = { ...first, tier, mask, round };
      const a = Array.from(engine.ChaosDraftSharedHand(spec));
      const retry = { ...spec, rerolled: true };
      const b = Array.from(engine.ChaosDraftSharedHand(retry));
      assert.equal(new Set(a).size, 3);
      assert.equal(new Set(b).size, 3);
      assert(a.every(x => !b.includes(x)));
      for (const target of [spec, retry]) {
        const encoded = engine.ChaosDraftCode(target);
        const decoded = engine.ChaosDraftParse(encoded.toLowerCase());
        assert.deepEqual(Array.from(engine.ChaosDraftSharedHand(decoded)), target.rerolled ? b : a);
      }
    }
  }
}
quick.RemoveClass('InShopZone');
shop.ActivateRandomTab();
shop.RandomShopMode(true);
shop.RandomShopRollTier(1);
advance(1100);
assert.deepEqual(hand().tokens, ['upgrade_goose_egg']); // Only one eligible local item.
assert.equal(view('RSDraftCard1').visible, false);
assert.equal(hud.attrs.rs_reserved_item, 'null');
closeShop();
advance(500);
shop.AddClass('gShopOpen');
shop.ActivateRandomTab();
run(shopScript, shop);
advance(1100);
assert.deepEqual(hand().tokens, ['upgrade_goose_egg']);
shop.RandomShopReroll();
assert.equal(hand().rerolled, true);
shop.RandomShopReroll();
assert.deepEqual(hand().tokens, ['upgrade_goose_egg']);
card.AddClass('owned');
shop.RandomShopPick(0);
assert.equal(pending(), null);
card.RemoveClass('owned');
shop.RandomShopPick(0);
const pickedSerial = pending().serial;
shop.RandomShopPick(0);
shop.RandomShopMode(false);
assert.equal(hud.attrs.rs_roll_serial, pickedSerial);
assert.equal(pending().token, 'upgrade_goose_egg');
assert.equal(hand(), null);
closeShop();
quick.AddClass('InShopZone');
advance(600);
assert.equal(requests.length, 5);
assert.equal(requests[4].open, false);
equip('techPower','isTech').AddClass('isActiveItem');
advance(600);
confirmed();
quick.RemoveClass('InShopZone');

// Find a test seed for which the first deal contains the fixture's single native card.
let seedNo = 1;
while (!engine.ChaosDraftSharedHand({...first,seed:'F'+seedNo}).includes('upgrade_goose_egg')) seedNo++;
const spec = {...first, seed:'F'+seedNo};
const code = engine.ChaosDraftCode(spec);
codeField.text = '###';
shop.RandomShopRollTier(1);
advance(700);
assert.equal(hand(), null);
codeField.text = code;
shop.RandomShopJoin();
advance(900);
const original = hand();
assert.deepEqual(original.tokens, Array.from(engine.ChaosDraftSharedHand(spec)));
const egg = original.tokens.indexOf('upgrade_goose_egg');
assert.equal(view('RSDraftCard'+egg).enabled, true);
assert.equal(view('RSHandCode').text, code);
card.AddClass('owned');
advance(1400);
assert.equal(view('RSDraftCard'+egg).enabled, false);
assert.equal(view('RSSkip').visible, true);
assert.deepEqual(hand(), original);
shop.RandomShopPick(egg);
assert.equal(pending(), null);
shop.RandomShopReroll();
advance(200);
const after = hand();
assert.equal(after.rerolled, true);
assert(after.tokens.every(t => !original.tokens.includes(t)));
assert.equal(view('RSReroll').enabled, false);
run(shopScript, shop);
advance(500);
assert.deepEqual(hand(), after);
shop.RandomShopSkip();
assert.equal(hand(), null);
codeField.text = code+'R';
shop.RandomShopJoin();
advance(900);
assert.deepEqual(hand(), after);
shop.RandomShopSkip();
codeField.text = spec.seed;
shop.RandomShopRollTier(2);
advance(900);
assert.equal(hand().round, 13);
assert.equal(hand().tier, 2);
console.log('PASS: 1,120 share-code round trips, distinct hands, partial pool, one reroll, eligibility at click, restored hand, unavailable skip, selected card pinned until closed-shop inventory receipt.');

shop.RandomShopSkip();
card.RemoveClass('owned');
shop.RandomShopRoom(true);
view('RSRoomAddress').text='https://rooms.example.test';
shop.RandomShopConnectRoom();
const web=view('RSRoomBrowser');
const tag=new URL(web.url).searchParams.get('client');
let number=0;
let roomNo=0,roomHand;
do {
  const code=(roomNo++).toString(16).toUpperCase().padStart(10,'0');
  roomHand={seed:code,tier:1,mask:7,round:1,rerolled:false};
} while (!engine.ChaosDraftSharedHand(roomHand).includes('upgrade_goose_egg'));
const snapshot={code:roomHand.seed,host:true,players:2,version:1,round:0,tier:0,mask:7,rerolled:false,choice:null,done:false,ready:true,locked:false};
function echoRoom(overrides={}) {
  Object.assign(snapshot,overrides);
  web.HTMLTitle(web,'CSROOM1|'+JSON.stringify({tag,seq:++number,state:{...snapshot}}));
  advance(410);
}
function lastCommand() {return new URLSearchParams(new URL(web.url).hash.slice(1));}
echoRoom();
shop.RandomShopRollTier(1);
assert.equal(lastCommand().get('op'),'deal');
assert.equal(pending(),null);
echoRoom({round:1,tier:1,ready:false});
const chosen=hand().tokens.indexOf('upgrade_goose_egg');
shop.RandomShopPick(chosen);
assert.equal(lastCommand().get('op'),'pick');
assert.equal(pending(),null,'only server-accepted local intent can reserve');
echoRoom({choice:chosen,locked:true});
assert.equal(pending().team,snapshot.code+'.1');
closeShop(); quick.AddClass('InShopZone'); advance(700);
assert.equal(requests.length,6);
equip('techPower','isTech').AddClass('isActiveItem'); advance(400);
confirmed(); advance(500);
assert.equal(lastCommand().get('op'),'finish');
assert.equal(lastCommand().get('index'),String(chosen));
echoRoom({done:true,ready:true});
assert.equal(hand(),null);
echoRoom({round:2,choice:0,done:false,ready:false});
assert.equal(pending(),null,'remote state alone must never purchase');
console.log('PASS: compiled Panorama team handlers, server acknowledgement before reserving, closed-shop receipt and no purchase from unrequested server state.');
