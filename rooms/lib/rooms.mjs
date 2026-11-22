import { createHash, randomBytes } from 'node:crypto';

const TTL = 4 * 60 * 60 * 1000;
const prefix = 'chaos:{rooms-v1}:';
const codePattern = /^[0-9A-F]{10}$/;
const hash = text => createHash('sha256').update(text).digest('hex');
const memberKey = id => prefix + 'player:' + id;
const roomKey = code => prefix + 'room:' + code;
const fail = (status, code) => { throw Object.assign(new Error(code), {status}); };

// Room and membership expire together. A retried create returns the original room.
const create = `
local existing = redis.call('GET', KEYS[1])
if existing then return existing end
if not redis.call('SET', KEYS[2], ARGV[2], 'NX', 'PX', ARGV[3]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
return 1`;

// Check the exact version read by the caller. Competing picks and rerolls cannot both win.
const update = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if ARGV[2] == 'leave' then
  redis.call('DEL', unpack(KEYS))
  return 1
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 0 end
if ARGV[2] == 'join' then
  local member = redis.call('GET', KEYS[2])
  if member and member ~= ARGV[4] then return -1 end
  redis.call('SET', KEYS[2], ARGV[4], 'PX', ttl)
end
redis.call('SET', KEYS[1], ARGV[3], 'PX', ttl)
return 1`;

const limit = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return n`;
const player = id => ({id, choice:null, done:false});
const member = (room,id) => room.players.find(p => p.id === id);

function snapshot(room, id) {
  const me = room && member(room,id);
  if (!me) return null;
  return {code:room.code, host:me === room.players[0], players:room.players.length,
    version:room.version, round:room.round, tier:room.tier, mask:room.mask, rerolled:room.rerolled,
    choice:me.choice, done:me.done, locked:room.players.some(p => p.choice !== null || p.done),
    ready:room.players.length === 2 && (!room.round || room.players.every(p => p.done))};
}

function change(room, id, data) {
  const me = member(room,id);
  if (data.op === 'join') {
    if (me) return false;
    if (room.players.length >= 2) fail(409,'full');
    room.players.push(player(id));
    return true;
  }
  if (!me) fail(404,'no_room');
  if (data.op === 'leave') return true;
  if (room.round !== data.round || room.rerolled !== data.rerolled) fail(409,'stale');
  switch (data.op) {
    case 'deal':
      if (room.players[0] !== me) fail(403,'host_only');
      if (!snapshot(room,id).ready) fail(409,'waiting');
      if (!Number.isInteger(data.tier) || data.tier < 1 || data.tier > 4 ||
          !Number.isInteger(data.mask) || data.mask < 1 || data.mask > 7) fail(400,'invalid');
      room.round++; room.tier=data.tier; room.mask=data.mask; room.rerolled=false;
      for (const p of room.players) { p.choice=null; p.done=false; }
      break;
    case 'reroll':
      if (room.players[0] !== me) fail(403,'host_only');
      if (!room.round || room.rerolled || snapshot(room,id).locked) fail(409,'locked');
      room.rerolled=true;
      break;
    case 'pick':
      if (!room.round || !Number.isInteger(data.index) || data.index < 0 || data.index > 2 ||
          me.done || (me.choice !== null && me.choice !== data.index)) fail(409,'locked');
      if (me.choice === data.index) return false;
      me.choice=data.index;
      break;
    case 'finish':
    case 'pass':
      if (!room.round || me.choice === null || me.choice !== data.index) fail(409,'stale');
      if (me.done) return false;
      me.done=true;
      break;
    case 'skip':
      if (!room.round || me.choice !== null) fail(409,'locked');
      if (me.done) return false;
      me.done=true;
      break;
    default: fail(400,'invalid');
  }
  return true;
}

export function rooms(command) {
  return async function run(key, data, ip) {
    if (typeof key !== 'string' || !/^[a-f0-9]{48}$/.test(key)) fail(401,'auth');
    if (!data || !['create','join','state','leave','deal','reroll','pick','finish','pass','skip'].includes(data.op)) fail(400,'invalid');
    const id=hash(key), pointer=memberKey(id);
    if (data.op === 'state' && !data.code) {
      const code=await command(['GET',pointer]);
      if (!code) return null;
      data={...data,code};
    }
    if (data.op !== 'create' && (typeof data.code !== 'string' || !codePattern.test(data.code))) fail(400,'invalid');
    if (data.op === 'create' || data.op === 'join') {
      if (await command(['EVAL',limit,1,prefix+'attempt:'+hash(ip)]) > 24) fail(429,'slow_down');
    }
    for (let attempt=0; attempt<5; attempt++) {
      if (data.op === 'create') {
        const code=randomBytes(5).toString('hex').toUpperCase();
        const room={code,players:[player(id)],version:1,round:0,tier:0,mask:7,rerolled:false};
        const result=await command(['EVAL',create,2,pointer,roomKey(code),code,JSON.stringify(room),TTL]);
        if (result === 1) return snapshot(room,id);
        if (result === 0) continue;
        const existing=JSON.parse(await command(['GET',roomKey(result)]));
        if (existing && member(existing,id)) return snapshot(existing,id);
        continue;
      }
      const target=roomKey(data.code);
      const raw=await command(['GET',target]);
      const room=JSON.parse(raw);
      if (data.op === 'state') return snapshot(room,id);
      if (!room && data.op === 'leave') return null;
      if (!room) fail(404,'no_room');
      if (!change(room,id,data)) return snapshot(room,id);
      room.version++;
      const keys=[target];
      if (data.op === 'join') keys.push(pointer);
      if (data.op === 'leave') keys.push(...room.players.map(p => memberKey(p.id)));
      const result=await command(['EVAL',update,keys.length,...keys,raw,data.op,JSON.stringify(room),room.code]);
      if (result === -1) fail(409,'already_in_room');
      if (result === 1) return data.op === 'leave' ? null : snapshot(room,id);
    }
    fail(409,'stale');
  };
}
