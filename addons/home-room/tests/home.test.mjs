import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {homeRoom} from '../service/home.mjs';
import {server} from '../service/server.mjs';

const host = 'a'.repeat(48), guest = 'b'.repeat(48), stranger = 'c'.repeat(48);
test('separate invitations reserve the host and allow a guest to arrive first', () => {
  const room = homeRoom(), run = room.action;
  assert.notEqual(room.ownerCode, room.guestCode);
  const enter = (key,code) => run(key, {op:'join',code});
  assert.throws(() => run(stranger, {op:'create'}), /invite_only/);
  assert.throws(() => enter(null,room.ownerCode), /auth/);
  assert.throws(() => enter(stranger,'bad-code'), /no_room/);
  assert.equal(run(stranger,{op:'state'}), null);
  assert.equal(enter(guest,room.guestCode).players, 1);
  assert.throws(() => enter(guest,room.ownerCode), /already_in_room/);
  assert.equal(enter(host,room.ownerCode).host, true);
  assert.throws(() => enter(stranger,room.ownerCode), /claimed/);
  assert.throws(() => enter(stranger,room.guestCode), /full/);
  assert.equal(enter(host,room.ownerCode).ready, true);
  assert.equal(run(guest,{op:'state'}).host, false);
  assert.equal(run(guest,{op:'state'}).players, 2);
  const deal = {op:'deal',code:room.guestCode,tier:1,mask:7,round:0,rerolled:false};
  assert.throws(() => run(guest,deal), /host_only/);
  assert.equal(run(host,deal).round,1);
  run(guest, {op:'leave',code:room.guestCode});
  assert.equal(run(host,{op:'state'}),null);
  assert.throws(() => enter(host,room.ownerCode),/no_room/);
  assert.throws(() => enter(guest,room.guestCode),/no_room/);
});

test('host arrives first, room expires and old links cannot restore it', () => {
  let now=0;
  const room=homeRoom({clock:()=>now});
  assert.equal(room.action(host,{op:'join',code:room.ownerCode}).players,1);
  assert.equal(room.action(guest,{op:'join',code:room.guestCode}).ready,true);
  now=4*3600000;
  assert.equal(room.action(guest,{op:'state'}),null);
  assert.throws(()=>room.action(host,{op:'join',code:room.ownerCode}),/no_room/);
});

test('public HTTP returns only the instance marker, and rejects foreign origins', async () => {
  const room=homeRoom(), app=server({action:room.action,healthId:'test-instance'});
  app.listen(0,'127.0.0.1');
  await once(app,'listening');
  const url='http://127.0.0.1:'+app.address().port;
  try {
    assert.equal(await (await fetch(url+'/health')).text(),'test-instance');
    for (const path of ['/','/room.js','/room.css']) {
      const response=await fetch(url+path);
      assert.equal(response.status,200);
      const body=await response.text();
      assert.ok(!body.includes(room.ownerCode) && !body.includes(room.guestCode));
    }
    const headers={'Content-Type':'application/json','X-Room-Player':host, Origin:'https://elsewhere.test'};
    const options={method:'POST',headers,body:JSON.stringify({op:'join',code:room.ownerCode})};
    assert.equal((await fetch(url+'/room',options)).status,403);
    headers.Origin=url;
    assert.equal((await (await fetch(url+'/room',options)).json()).state.host,true);
  } finally {
    app.closeAllConnections();
    await new Promise(resolve=>app.close(resolve));
  }
});
