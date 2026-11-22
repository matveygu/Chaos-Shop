import {spawn, execFile} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {mkdtemp, readFile, writeFile, unlink, rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {promisify} from 'node:util';
import {setTimeout as sleep} from 'node:timers/promises';
import {handler} from '../api/room.mjs';

export async function localService() {
  const work = await mkdtemp(join(tmpdir(),'chaos-test-'));
  const temp = createServer();
  temp.listen(0,'127.0.0.1'); await once(temp,'listening');
  const port = temp.address().port;
  await new Promise(resolve=>temp.close(resolve));
  const file = join(work,'redis.conf');
  await writeFile(file,'bind 127.0.0.1\nport '+port+'\nsave ""\nappendonly no\n');
  const proc = spawn(process.env.ROOM_REDIS_SERVER || 'redis-server',['redis.conf'],
    {cwd:work,windowsHide:true,stdio:'ignore'});
  const ended = new Promise(resolve=>{proc.once('exit',resolve); proc.once('error',resolve);});
  const cli=promisify(execFile);
  async function command(args) {
    const result=await cli(process.env.ROOM_REDIS_CLI || 'redis-cli',
      ['-h','127.0.0.1','-p',String(port),'--json',...args.map(String)],{windowsHide:true,timeout:5000});
    return JSON.parse(result.stdout);
  }
  const headers={'/':['index.html','text/html'],'/room.js':['room.js','text/javascript'],'/room.css':['room.css','text/css']};
  const room=handler(command);
  const app=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/room') return room(req,res);
    if(!Object.hasOwn(headers,path)) {res.writeHead(404).end(); return;}
    const [name,mime]=headers[path];
    res.setHeader('Content-Type',mime+'; charset=utf-8');
    res.end(await readFile(new URL('../public/'+name,import.meta.url)));
  });
  async function close() {
    if(app.listening) {app.closeAllConnections(); await new Promise(resolve=>app.close(resolve));}
    if(proc.exitCode===null) proc.kill();
    await ended; await unlink(file); await rmdir(work);
  }
  try {
    let ready=false;
    for(let i=0;i<50;i++) {
      try {if(await command(['PING'])==='PONG') {ready=true;break;}} catch {}
      if(proc.exitCode!==null) break;
      await sleep(100);
    }
    if(!ready) throw new Error('Local Redis did not start. Set ROOM_REDIS_SERVER and ROOM_REDIS_CLI.');
    app.listen(0,'127.0.0.1'); await once(app,'listening');
    return {address:'http://127.0.0.1:'+app.address().port,command,close};
  } catch(e) {await close();throw e;}
}
