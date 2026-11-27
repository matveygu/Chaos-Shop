import test from 'node:test';
import assert from 'node:assert/strict';
import {localService} from './local.mjs';
import {rooms} from '../lib/rooms.mjs';

test('two function instances share state, enforce roles and resolve concurrent writes',async()=>{
  const app=await localService();
  try {
    let calls=0;
    const a=rooms(cmd=>{calls++;return app.command(cmd);}), b=rooms(app.command);
    const host='a'.repeat(48),guest='b'.repeat(48),third='c'.repeat(48);
    const results=await Promise.all([a(host,{op:'create'},'a'),b(host,{op:'create'},'a')]);
    const code=results[0].code;
    assert.equal(results[1].code,code);
    const data=(op,args={})=>({op,code,round:0,rerolled:false,...args});
    const stored=JSON.parse(await app.command(['GET','chaos:{rooms-v1}:room:'+code]));
    delete stored.capacity; // Existing production rooms predate this field.
    await app.command(['SET','chaos:{rooms-v1}:room:'+code,JSON.stringify(stored),'KEEPTTL']);
    const guests=await Promise.allSettled([b(guest,data('join'),'b'),b(third,data('join'),'c')]);
    assert.equal(guests.filter(r=>r.status==='fulfilled').length,1);
    const admitted=guests[0].status==='fulfilled'?guest:third;
    await assert.rejects(()=>b(admitted,data('deal',{tier:1,mask:7})),/host_only/);
    const first=await a(host,data('deal',{tier:1,mask:7}));
    assert.equal(first.round,1);
    calls=0; assert.equal((await a(host,data('state'))).round,1); assert.equal(calls,1);
    assert.equal(await b('d'.repeat(48),data('state')),null);
    const res=await Promise.allSettled([a(host,data('reroll',{round:1})),b(admitted,data('pick',{round:1,index:0}))]);
    assert.equal(res.filter(r=>r.status==='fulfilled').length,1);
    const now=await b(admitted,data('state'));
    const current=(op,index)=>data(op,{round:1,rerolled:now.rerolled,index});
    await Promise.all([a(host,current('pick',2)),b(admitted,current('pick',0))]);
    await Promise.all([a(host,current('finish',2)),b(admitted,current('finish',0))]);
    assert.equal((await b(admitted,data('state'))).ready,true);
    const ttl=await app.command(['PTTL','chaos:{rooms-v1}:room:'+code]);
    assert.ok(ttl>0 && ttl<=4*3600000);
    assert.equal(await a(host,data('leave')),null);
    assert.equal(await b(admitted,{op:'state'}),null);
    assert.equal(await app.command(['EXISTS','chaos:{rooms-v1}:room:'+code]),0);
  } finally {await app.close();}
});

test('six seats, concurrent joins and finishes, host succession and reuse of freed seats',async()=>{
  const app=await localService();
  try {
    const run=rooms(app.command), keys=Array.from('1234567',c=>c.repeat(48));
    const [host,...guests]=keys;
    const {code}=await run(host,{op:'create',seats:6},'test');
    const act=(who,op,fields={})=>run(who,{op,code,seats:6,round:0,rerolled:false,...fields},'test');
    await assert.rejects(()=>act(host,'deal',{tier:1,mask:7}),/waiting/);
    await assert.rejects(()=>act(guests[0],'join',{seats:2}),/update_mod/);
    const joined=await Promise.allSettled(guests.map(p=>act(p,'join')));
    const members=guests.filter((_,i)=>joined[i].status==='fulfilled');
    const rejected=joined.findIndex(r=>r.status==='rejected');
    assert.equal(members.length,5);
    assert.equal(joined[rejected].reason.message,'full');
    assert.equal((await act(host,'state')).capacity,6);
    assert.equal((await act(members[0],'join')).players,6);
    assert.equal((await act(host,'deal',{tier:2,mask:5})).round,1);
    const active=(p,op,index)=>act(p,op,{index,round:1});
    await Promise.all(members.map((p,i)=>active(p,'pick',i%3)));
    await Promise.all(members.map((p,i)=>active(p,'finish',i%3)));
    assert.equal((await act(host,'state')).finished,5);
    await assert.rejects(()=>act(host,'deal',{tier:1,mask:7,round:1}),/waiting/);
    await active(host,'skip');
    assert.equal((await act(host,'state')).ready,true);
    await act(members[0],'leave');
    assert.equal(await act(members[0],'leave'),null);
    assert.equal(await run(members[0],{op:'state'}),null);
    const newcomer=await act(guests[rejected],'join');
    assert.equal(newcomer.round,1);
    assert.equal(newcomer.finished,5);
    assert.equal(newcomer.ready,false);
    await active(guests[rejected],'skip');
    await act(host,'leave');
    const remaining=[...members.slice(1),guests[rejected]];
    const views=await Promise.all(remaining.map(p=>act(p,'state')));
    assert.ok(views.every(s=>s.players===5 && s.ready));
    const hosts=remaining.filter((_,i)=>views[i].host);
    assert.equal(hosts.length,1);
    assert.equal((await act(hosts[0],'deal',{tier:1,mask:7,round:1})).round,2);
    await Promise.all(remaining.map(p=>act(p,'leave')));
    assert.equal(await app.command(['EXISTS','chaos:{rooms-v1}:room:'+code]),0);
    for (const p of keys) assert.equal(await run(p,{op:'state'}),null);
  } finally {await app.close();}
});
