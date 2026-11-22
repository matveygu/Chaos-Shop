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
