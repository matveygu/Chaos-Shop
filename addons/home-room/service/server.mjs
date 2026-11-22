import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createTlsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const lifetime = 4 * 60 * 60 * 1000;
const files = new Map([['/', ['index.html', 'text/html']], ['/room.js', ['room.js', 'application/javascript']], ['/room.css', ['room.css', 'text/css']]]);
const fail = (status, code) => { throw Object.assign(new Error(code), {status}); };
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

export function roomService({clock = Date.now, maxRooms = 1024} = {}) {
  const rooms = new Map(), membership = new Map(), limits = new Map();
  function close(room) {
    rooms.delete(room.code);
    for (const player of room.players) membership.delete(player.key);
  }
  function cleanup(now) {
    for (const room of rooms.values()) if (room.expires <= now) close(room);
    for (const [ip, window] of limits) if (window.until <= now) limits.delete(ip);
  }
  function player(key) { return {key, choice: null, done: false}; }
  function snapshot(room, me) {
    return {code:room.code, host:me === room.players[0], players:room.players.length, version:room.version,
      round:room.round, tier:room.tier, mask:room.mask, rerolled:room.rerolled,
      choice:me.choice, done:me.done, locked:room.players.some(p => p.choice !== null || p.done),
      ready:room.players.length === 2 && (!room.round || room.players.every(p => p.done))};
  }
  return function execute(key, data, ip = 'local') {
    if (!/^[a-f0-9]{48}$/.test(key || '')) fail(401, 'auth');
    if (!data || typeof data !== 'object') fail(400, 'invalid');
    const now = clock();
    cleanup(now);
    let room = membership.get(key);
    if (data.op === 'create' || data.op === 'join') {
      if (room && (data.op === 'create' || data.code === room.code)) return snapshot(room, room.players.find(p => p.key === key));
      if (room) fail(409, 'already_in_room');
      let limit = limits.get(ip);
      if (!limit) { limit = {count:0, until:now+60000}; limits.set(ip, limit); }
      if (++limit.count > 90) fail(429,'slow_down');
      const member = player(key);
      if (data.op === 'create') {
        if (rooms.size >= maxRooms) fail(503,'busy');
        let code;
        do { code = randomBytes(5).toString('hex').toUpperCase(); } while (rooms.has(code));
        room = {code, expires:now+lifetime, players:[member], version:1, round:0, tier:0, mask:7, rerolled:false};
        rooms.set(code, room);
      } else {
        room = rooms.get(data.code);
        if (!room) fail(404,'no_room');
        if (room.players.length >= 2) fail(409,'full');
        room.players.push(member);
        room.version++;
      }
      membership.set(key, room);
      return snapshot(room, member);
    }
    if (!room) return data.op === 'state' || data.op === 'leave' ? null : fail(404,'no_room');
    const me = room.players.find(p => p.key === key);
    if (data.op === 'state') return snapshot(room, me);
    if (data.code !== room.code) fail(409,'stale');
    if (data.op === 'leave') { close(room); return null; }
    if (room.round !== data.round || data.rerolled !== room.rerolled) fail(409,'stale');
    switch (data.op) {
      case 'deal':
        if (me !== room.players[0]) fail(403,'host_only');
        if (!snapshot(room,me).ready) fail(409,'waiting');
        if (!integer(data.tier,1,4) || !integer(data.mask,1,7)) fail(400,'invalid');
        room.round++; room.tier=data.tier; room.mask=data.mask; room.rerolled=false;
        for (const p of room.players) { p.choice=null; p.done=false; }
        break;
      case 'reroll':
        if (me !== room.players[0]) fail(403,'host_only');
        if (!room.round || room.rerolled || snapshot(room,me).locked) fail(409,'locked');
        room.rerolled=true; break;
      case 'pick':
        if (!room.round || !integer(data.index,0,2) || me.done || (me.choice !== null && me.choice !== data.index)) fail(409,'locked');
        if (me.choice === data.index) return snapshot(room,me);
        me.choice=data.index; break;
      case 'pass':
      case 'finish':
        if (!room.round || me.choice === null || me.choice !== data.index) fail(409,'stale');
        if (me.done) return snapshot(room,me);
        me.done=true; break;
      case 'skip':
        if (!room.round || me.choice !== null) fail(409,'locked');
        if (me.done) return snapshot(room,me);
        me.done=true; break;
      default: fail(400,'invalid');
    }
    room.version++;
    return snapshot(room,me);
  };
}

export function server(options = {}) {
  const action = options.action || roomService(options);
  const listener = async (req, res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    try {
      const route = new URL(req.url,'http://localhost').pathname;
      if (req.method === 'GET' && route === '/health' && options.healthId) {
        res.setHeader('Content-Type','text/plain');
        res.end(options.healthId);
        return;
      }
      if (req.method === 'GET' && files.has(route)) {
        const [file,mime] = files.get(route);
        res.setHeader('Content-Type',mime+'; charset=utf-8');
        res.setHeader('Content-Security-Policy',"default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
        res.end(readFileSync(new URL('./public/'+file,import.meta.url))); return;
      }
      if (route !== '/room' || req.method !== 'POST') fail(404,'not_found');
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) fail(415,'invalid');
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) fail(403,'origin');
      let buffer='', bytes=0;
      for await (const chunk of req) { bytes+=chunk.length; if (bytes>2048) fail(413,'invalid'); buffer+=chunk; }
      let body;
      try { body=JSON.parse(buffer); } catch { fail(400,'invalid'); }
      const state=action(req.headers['x-room-player'],body,req.socket.remoteAddress);
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({state}));
    } catch (e) {
      res.writeHead(e.status || 500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:e.status ? e.message : 'server_error'}));
    }
  };
  return options.tls ? createTlsServer(options.tls,listener) : createServer(listener);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const tls = process.env.ROOM_TLS_CERT && process.env.ROOM_TLS_KEY ? {
    cert:readFileSync(process.env.ROOM_TLS_CERT),key:readFileSync(process.env.ROOM_TLS_KEY)} : undefined;
  const host=process.env.ROOM_HOST || '127.0.0.1', port=Number(process.env.ROOM_PORT || 8787);
  server({tls}).listen(port,host,()=>console.log('Chaos Shop rooms listening on '+(tls?'https':'http')+'://'+host+':'+port));
}
