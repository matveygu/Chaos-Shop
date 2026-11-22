import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {lifetime, roomService, server} from './server.mjs';

function reject(status, message) {
  throw Object.assign(new Error(message), {status});
}

// The host seat exists before either browser connects. Invitations can be opened in either order.
export function homeRoom(options) {
  const execute = roomService({...options, maxRooms:1});
  const reservedKey = randomBytes(24).toString('hex');
  const guestCode = execute(reservedKey, {op:'create'}).code;
  let ownerCode;
  do { ownerCode = randomBytes(5).toString('hex').toUpperCase(); } while (ownerCode === guestCode);
  let ownerKey;

  function action(key, data, ip) {
    if (typeof key !== 'string' || !/^[a-f0-9]{48}$/.test(key) || key === reservedKey) reject(401, 'auth');
    if (!data || typeof data !== 'object') reject(400, 'invalid');
    if (data.op === 'create') reject(403, 'invite_only');
    if (data.op === 'join' && data.code === ownerCode) {
      if (ownerKey && ownerKey !== key) reject(409, 'claimed');
      if (!ownerKey && execute(key, {op:'state'})) reject(409, 'already_in_room');
      const room = execute(reservedKey, {op:'state'});
      if (!room) reject(404, 'no_room');
      ownerKey = key;
      return room;
    }
    const client = key === ownerKey ? reservedKey : key;
    const leaving = data.op === 'leave' && execute(client,{op:'state'});
    const snapshot = execute(client, data, ip);
    if (leaving && !snapshot) options?.onClose?.();
    if (snapshot && !ownerKey) return {...snapshot, players:1, ready:false};
    return snapshot;
  }
  return {ownerCode, guestCode, action};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // Let both browsers observe the closed state before the launcher releases the tunnel.
  const closed = () => setTimeout(() => console.log('CLOSED'), 3000).unref();
  const home = homeRoom({onClose:closed});
  setTimeout(closed, lifetime).unref();
  const healthId = randomBytes(16).toString('hex');
  const app = server({action:home.action, healthId});
  app.listen(0,'127.0.0.1', () => {
    console.log(['READY', app.address().port, home.ownerCode, home.guestCode, healthId].join(' '));
  });
}
