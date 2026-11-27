'use strict';
const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const tag = params.get('client') || 'browser';
const seats = !params.has('client') || params.get('seats') === '6' ? 6 : 2;
const en = params.get('lang') === 'en';
const t = (ru, eng) => en ? eng : ru;
document.documentElement.lang = en ? 'en' : 'ru';
if (en) {
  for (const [id,str] of Object.entries({create:'Create room',join:'Join',copy:'Copy code',leave:'Leave'})) el(id).textContent=str;
  el('code').placeholder='Room code';
  for (const id of ['code','invite']) el(id).setAttribute('aria-label','Room code');
}
const storageKey = 'chaos-team-v1:' + tag;
let knownCode='';
function identity() {
  const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b=>b.toString(16).padStart(2,'0')).join('');
  try {
    for (let i=localStorage.length-1;i>=0;i--) {
      const k=localStorage.key(i);
      if (k && k.startsWith('chaos-team-v1:') && Number((localStorage.getItem(k)||'').split('|')[0]) < Date.now()-4*3600000) localStorage.removeItem(k);
    }
    const parts=(localStorage.getItem(storageKey)||'').split('|');
    let key=parts[1];
    if (!/^[0-9a-f]{48}$/.test(key||'')) key=fresh();
    else if (/^[0-9A-F]{10}$/.test(parts[2]||'')) knownCode=parts[2];
    localStorage.setItem(storageKey,[Date.now(),key,knownCode].join('|')); return key;
  } catch { return fresh(); }
}
const key = identity();
let state=null, serial=0, tail=Promise.resolve(), error='', busy=0, lastHash='';
let pendingInvite='', nextJoin=0, retryDelay=2000, joinError='';
let timer, openShop=true, unchanged=0, failures=0;
const messages={
  no_room:t('Комната закрыта или код неверен.','Room closed or code incorrect.'), full:t('Все места заняты.','Room is full.'),
  update_mod:t('Обнови Chaos Shop, чтобы войти в эту комнату.','Update Chaos Shop to join this room.'),
  stale:t('Расклад обновился. Проверь карточки.','Hand changed. Check the cards.'), locked:t('Выбор уже зафиксирован.','Choice is already locked.'),
  offline:t('Нет связи с сервисом. Повторяю подключение…','Service unreachable. Reconnecting…'), waiting:t('Начать можно вдвоём. Отправь другу код комнаты.','Two players can start. Share the room code with a friend.'),
  slow_down:t('Слишком много попыток. Подожди минуту.','Too many attempts. Wait a minute.')
};
function draw() {
  el('room').hidden=!state; el('lobby').hidden=!!state;
  for (const id of ['create','join','leave']) el(id).disabled=!!busy;
  let hint=t('Создай комнату или введи код друга.','Create a room or enter your friend’s code.');
  if (state) {
    el('roster').textContent=(state.host?t('Ведущий','Host'):t('Участник','Guest'))+' · '+state.players+'/'+(state.capacity || 2);
    el('invite').value=state.code;
    hint=state.players<2 ? messages.waiting :
      state.ready ? (state.host?t('Выбери категории и тир в магазине.','Choose categories and tier in the shop.'):t('Ведущий выбирает тир.','Host is choosing a tier.')) :
      state.done?t('Ждём остальных игроков.','Waiting for the other players.'):
      state.choice!==null?t('Предмет закреплён до покупки.','Item pinned until purchased.'):t('Выберите по одной карте.','Each player picks one card.');
    if (state.round && Number.isInteger(state.finished)) hint+=' '+t('Готовы','Ready')+' '+state.finished+'/'+state.players+'.';
  }
  el('status').textContent=error||(!state && joinError)||hint;
}
function notify() {
  document.title='CSROOM1|'+JSON.stringify({tag,seq:++serial,state});
}
async function post(body) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try {
    if (body.op==='create' || body.op==='join') body={...body,seats};
    if (body.op==='state' && knownCode) body={...body,code:knownCode};
    const res=await fetch('/room',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Player':key},body:JSON.stringify(body),signal:controller.signal});
    if ([502,503,504,530].includes(res.status)) throw new TypeError('Service unreachable');
    const result=await res.json();
    if (!res.ok) throw new Error(result.error);
    const changed=JSON.stringify(state)!==JSON.stringify(result.state);
    state=result.state; const code=state?.code || '';
    if (knownCode!==code) {
      knownCode=code;
      try { localStorage.setItem(storageKey,[Date.now(),key,code].join('|')); } catch {}
    }
    failures=0; unchanged=changed || body.op!=='state' ? 0 : Math.min(unchanged+1,10);
    if (changed || serial===0) notify();
  } finally { clearTimeout(timer); }
}
function enqueue(body) {
  busy++; draw();
  const exec=async()=>{
    try { await post(body); error=''; if (state) { pendingInvite=''; joinError=''; retryDelay=2000; } }
    catch (e) { failures=Math.min(failures+1,5); error=messages[e.message] || (e.name==='TypeError'||e.name==='AbortError'?messages.offline:t('Действие не выполнено.','Action was declined.'));
      if (body.op==='join') {
        joinError=error;
        if (e.name==='TypeError' || e.name==='AbortError' || e.message==='slow_down') {
          nextJoin=Date.now()+(e.message==='slow_down'?60000:retryDelay);
          retryDelay=Math.min(retryDelay*2,15000);
        } else { pendingInvite=''; }
      } else if (body.op!=='state') { try { await post({op:'state'}); } catch {} }
    } finally { busy--; draw(); schedule(); }
  };
  tail=tail.then(exec,exec); return tail;
}
function join(value) {
  const code=value.trim().toUpperCase();
  if (!/^[0-9A-F]{10}$/.test(code)) { error=messages.no_room; draw(); return; }
  pendingInvite=code; joinError=''; nextJoin=0; retryDelay=2000;
  return enqueue({op:'join',code});
}
function fromGame() {
  if (lastHash===location.hash) return;
  lastHash=location.hash;
  const hash=new URLSearchParams(location.hash.slice(1));
  if (hash.has('view')) { openShop=hash.get('view')==='1'; schedule(openShop); return; }
  if (hash.has('join') && !state) { el('code').value=hash.get('join'); join(el('code').value); return; }
  if (!hash.has('op') || !state || hash.get('code')!==state.code) return;
  const op=hash.get('op');
  if (!['deal','reroll','pick','finish','pass','skip','leave'].includes(op)) return;
  enqueue({op,code:state.code,round:Number(hash.get('round')),rerolled:hash.get('r')==='1',
    tier:Number(hash.get('tier')),mask:Number(hash.get('mask')),index:Number(hash.get('index'))});
}
el('create').onclick=()=>enqueue({op:'create'});
el('join').onclick=()=>join(el('code').value);
el('code').onkeydown=e=>{if(e.key==='Enter') join(el('code').value);};
el('copy').onclick=async()=>{
  const field=el('invite'); field.select();
  try { await navigator.clipboard.writeText(field.value); }
  catch { if (!document.execCommand('copy')) { el('status').textContent=t('Нажми Ctrl+C.','Press Ctrl+C.'); return; } }
  el('status').textContent=t('Код скопирован.','Code copied.');
};
el('leave').onclick=()=>state && enqueue({op:'leave',code:state.code});
addEventListener('hashchange',fromGame);
function schedule(immediate=false) {
  clearTimeout(timer);
  if (busy || document.hidden || !openShop || (!state && !knownCode && !pendingInvite)) return;
  const base=state?.players===1 ? 5000 : 2500;
  let delay=Math.min(15000,base*(1+Math.floor(unchanged/2)));
  if (failures) delay=Math.min(60000,2000*2**failures);
  if (immediate) delay=0;
  if (pendingInvite) delay=Math.max(100,nextJoin-Date.now());
  timer=setTimeout(()=>enqueue(pendingInvite ? {op:'join',code:pendingInvite} : {op:'state'}),delay);
}
document.addEventListener('visibilitychange',()=>schedule(!document.hidden));
window.addEventListener('online',()=>schedule(true));
async function start() {
  if (knownCode) await enqueue({op:'state'}); else { draw(); notify(); }
  fromGame(); schedule();
}
start();
