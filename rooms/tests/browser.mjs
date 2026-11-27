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
  const contexts=await Promise.all(Array.from({length:7},()=>browser.newContext()));
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  const [host,guest,...others]=pages;
  const extra=others.slice(0,4), seventh=others[4];
  const errors=[];
  pages.forEach(page=>page.on('pageerror',e=>errors.push(e.message)));
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
  await Promise.all(pages.map((page,i)=>page.goto(i===0 ? address+'/?client=host&seats=6&lang=en' : address)));
  let guestRequests=0;
  guest.on('request',r=>{if(new URL(r.url()).pathname==='/room')guestRequests++;});
  await host.locator('#create').click();
  const room=await wait(host,s=>s && s.players===1);
  const code=await host.locator('#invite').inputValue();
  assert.match(code,/^[0-9A-F]{10}$/);
  await contexts[0].grantPermissions(['clipboard-read','clipboard-write'],{origin:address});
  await host.getByRole('button',{name:'Copy code'}).click();
  assert.equal(await host.evaluate(()=>navigator.clipboard.readText()),code);
  async function join(page) {
    await page.locator('#code').fill(code.toLowerCase());
    await page.locator('#join').click();
  }
  await join(guest);
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
  await Promise.all(extra.map(join));
  await Promise.all(pages.slice(0,6).map(p=>wait(p,s=>s && s.players===6 && s.round===1)));
  assert.match(await host.locator('#roster').textContent(),/6\/6/);
  await join(seventh);
  await seventh.getByText('Все места заняты.').waitFor();
  await command(host,'reroll');
  await wait(host,s=>s && s.rerolled); await wait(guest,s=>s && s.rerolled);
  await command(guest,'pick',{index:2});
  await wait(guest,s=>s && s.choice===2);
  await guest.reload();
  await wait(guest,s=>s && !s.host && s.players===6 && s.choice===2);
  await Promise.all(extra.map(async p=>{
    await wait(p,s=>s && s.rerolled);
    await command(p,'skip');
    await wait(p,s=>s && s.done);
  }));
  await command(host,'pick',{index:0}); await wait(host,s=>s && s.choice===0);
  await command(host,'finish',{index:0}); await wait(host,s=>s && s.done && !s.ready);
  await command(guest,'finish',{index:2}); await wait(host,s=>s && s.finished===6 && s.ready);
  await command(host,'deal',{tier:4,mask:7});
  const again=await wait(guest,s=>s && s.round===2);
  assert.equal(again.code,room.code); assert.equal(again.tier,4); assert.deepEqual(errors,[]);
  await host.locator('#leave').click();
  await wait(guest,s=>s && s.host && s.players===5 && s.round===2);
  await join(seventh);
  await wait(seventh,s=>s && s.players===6 && s.round===2);
  await Promise.all(pages.slice(1).map(async p=>{
    await p.locator('#leave').click();
    await wait(p,s=>s===null);
  }));
  assert.deepEqual(errors,[]);
  console.log('PASS: six Chromium players, copy and join by code, seventh refused, shared deal/reroll, personal choices, reload, silent closed shop, round two, host succession and reuse of the free seat.');
} finally {
  if (browser) await browser.close();
  if(app) await app.close();
}
