import {rooms} from '../lib/rooms.mjs';

async function upstash(command) {
  const url=process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('storage unavailable');
  const response=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(command),signal:AbortSignal.timeout(3500)});
  if (!response.ok) throw new Error('storage unavailable');
  const body=await response.json();
  if (body.error) throw new Error('storage command failed');
  return body.result;
}

export function handler(command) {
  const run=rooms(command);
  return async function room(req,res) {
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Content-Type','application/json');
    const send=(status,body)=>{res.statusCode=status; res.end(JSON.stringify(body));};
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); return send(405,{error:'method'}); }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(415,{error:'invalid'});
    const origin=req.headers.origin;
    if (origin && !['https://'+req.headers.host,'http://'+req.headers.host].includes(origin)) return send(403,{error:'origin'});
    try {
      if (Number(req.headers['content-length']) > 2048) return send(413,{error:'invalid'});
      let body=req.body;
      if (body === undefined) {
        const chunks=[]; let size=0;
        for await (const chunk of req) {
          size+=chunk.length;
          if (size>2048) return send(413,{error:'invalid'});
          chunks.push(Buffer.from(chunk));
        }
        body=Buffer.concat(chunks).toString();
      }
      if (typeof body==='string') body=JSON.parse(body);
      if (Buffer.byteLength(JSON.stringify(body) || '')>2048) return send(413,{error:'invalid'});
      const ip=String(req.headers['x-vercel-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim();
      return send(200,{state:await run(req.headers['x-room-player'],body,ip)});
    } catch(e) {
      if (e instanceof SyntaxError) return send(400,{error:'invalid'});
      return send(e.status || 503,{error:e.status ? e.message : 'offline'});
    }
  };
}
export default handler(upstash);
