import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { server } from '../service/server.mjs';
import { homeRoom } from '../service/home.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ROOM_PLAYWRIGHT || 'playwright');
const remote=process.env.ROOM_TEST_ORIGIN;
const home=remote ? {ownerCode:process.env.ROOM_TEST_OWNER,guestCode:process.env.ROOM_TEST_GUEST} : homeRoom();
const app=remote ? null : server({action:home.action});
if (app) { app.listen(0,'127.0.0.1'); await once(app,'listening'); }
const address=remote || 'http://127.0.0.1:'+app.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.ROOM_BROWSER || undefined});
  const a=await browser.newContext(), b=await browser.newContext();
  const host=await a.newPage(), guest=await b.newPage();
  const errors=[];
  [host,guest].forEach(page=>page.on('pageerror',e=>errors.push(e.message)));
  const network=[];
  if (remote) for (const page of [host,guest]) {
    page.on('requestfailed',req=>network.push([new URL(req.url()).pathname,req.failure()?.errorText]));
    page.on('response',async res=>{
      const path=new URL(res.url()).pathname;
      if (res.status()>=400 || res.request().resourceType()==='document') {
        let reason='';
        if (path==='/room' && res.status()>=400) { try { reason=(await res.json()).error; } catch {} }
        network.push([path,res.status(),res.headers()['content-type'],reason]);
      }
    });
  }
  async function wait(page, predicate) {
    const end=Date.now()+(remote ? 30000 : 10000);
    while (Date.now()<end) {
      const title=await page.title();
      if (title.startsWith('CSROOM1|')) {
        const state=JSON.parse(title.slice(8)).state;
        if (predicate(state)) return state;
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const pageStatus=await page.locator('#status').allTextContents();
    const title=await page.title();
    throw Error('Room state timed out: '+String(predicate)+'; '+JSON.stringify({
      title:title.startsWith('CSROOM1|')?'bridge running':title.slice(0,60),pageStatus,errors,network:network.slice(-12)
    }));
  }
  async function command(page, op, extra={}) {
    const s=JSON.parse((await page.title()).slice(8)).state;
    const hash=new URLSearchParams({op,code:s.code,round:s.round,r:s.rerolled?'1':'0',...extra,n:Date.now()});
    await page.evaluate(h=>{location.hash=h},hash.toString());
  }
  let droppedFirstJoin=false;
  if (!remote) await guest.route('**/room',async route=>{
    if (!droppedFirstJoin && route.request().postDataJSON()?.op==='join') {
      droppedFirstJoin=true;
      await route.abort('connectionreset');
    } else await route.continue();
  });
  await guest.goto(address+'/?client=guest#join='+home.guestCode);
  await wait(guest,s=>s && !s.host && s.players===1 && !s.ready);
  if (!remote) assert.equal(droppedFirstJoin,true);
  await host.goto(address+'/?client=host#join='+home.ownerCode);
  const room=await wait(host,s=>s && s.host && s.players===2);
  const invite=await host.locator('#invite').inputValue();
  assert.equal(invite,address+'/#join='+home.guestCode);
  await wait(guest,s=>s && !s.host && s.players===2);
  await wait(host,s=>s && s.ready);
  await command(host,'deal',{tier:2,mask:5});
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
  if (app) { app.closeAllConnections(); await new Promise(resolve=>app.close(resolve)); }
}
