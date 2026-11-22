import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { localService } from './local.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ROOM_PLAYWRIGHT || 'playwright');
const app=process.env.ROOM_TEST_ORIGIN ? null : await localService();
const address=process.env.ROOM_TEST_ORIGIN || app.address;
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.ROOM_BROWSER || undefined});
  const a=await browser.newContext(), b=await browser.newContext();
  const host=await a.newPage(), guest=await b.newPage();
  const errors=[];
  [host,guest].forEach(page=>page.on('pageerror',e=>errors.push(e.message)));
  async function wait(page, predicate) {
    const end=Date.now()+30000;
    while (Date.now()<end) {
      const title=await page.title();
      if (title.startsWith('CSROOM1|')) {
        const state=JSON.parse(title.slice(8)).state;
        if (predicate(state)) return state;
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw Error('Room state timed out: '+String(predicate));
  }
  async function command(page, op, extra={}) {
    const s=JSON.parse((await page.title()).slice(8)).state;
    const hash=new URLSearchParams({op,code:s.code,round:s.round,r:s.rerolled?'1':'0',...extra,n:Date.now()});
    await page.evaluate(h=>{location.hash=h},hash.toString());
  }
  await host.goto(address+'/?client=host');
  let guestRequests=0;
  guest.on('request',r=>{if(new URL(r.url()).pathname==='/room')guestRequests++;});
  await host.locator('#create').click();
  const room=await wait(host,s=>s && s.players===1);
  const invite=await host.locator('#invite').inputValue();
  await guest.goto(invite.replace('/#','/?client=guest#'));
  await wait(guest,s=>s && !s.host && s.players===2);
  await wait(host,s=>s && s.ready);
  await guest.evaluate(()=>{location.hash='view=0';});
  await guest.waitForTimeout(500);
  const idleRequests=guestRequests;
  await command(host,'deal',{tier:2,mask:5});
  await guest.waitForTimeout(5500);
  assert.equal(guestRequests,idleRequests,'closed shop should make no room requests');
  await guest.evaluate(()=>{location.hash='view=1';});
  await wait(guest,s=>s && s.round===1 && s.tier===2 && s.mask===5);
  await wait(host,s=>s && s.round===1);
  await command(host,'reroll');
  await wait(host,s=>s && s.rerolled); await wait(guest,s=>s && s.rerolled);
  await command(guest,'pick',{index:2});
  await wait(guest,s=>s && s.choice===2);
  await guest.reload();
  await wait(guest,s=>s && !s.host && s.choice===2);
  await command(host,'pick',{index:0}); await wait(host,s=>s && s.choice===0);
  await command(host,'finish',{index:0}); await wait(host,s=>s && s.done && !s.ready);
  await command(guest,'finish',{index:2}); await wait(host,s=>s && s.ready);
  await command(host,'deal',{tier:4,mask:7});
  const again=await wait(guest,s=>s && s.round===2);
  assert.equal(again.code,room.code); assert.equal(again.tier,4); assert.deepEqual(errors,[]);
  await host.locator('#leave').click(); await wait(guest,s=>s===null);
  console.log('PASS: two isolated Chromium players, one invite, shared deal/reroll, separate choices, guest reload, finish gate, round two and closing.');
} finally {
  if (browser) await browser.close();
  if(app) await app.close();
}
