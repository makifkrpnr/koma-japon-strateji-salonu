'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('./public/js/game-core.js');

const PUBLIC = path.join(__dirname,'public');
const PORT = Number(process.env.PORT)||8080;
const rooms = new Map();
const clients = new Set();
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};

function serve(req,res){
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(url.pathname==='/health'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({ok:true,rooms:rooms.size,clients:clients.size,game:'KOMA'}));return;
  }
  const rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  const full=path.normalize(path.join(PUBLIC,rel));
  if(!full.startsWith(PUBLIC)){res.writeHead(403);res.end('Forbidden');return;}
  fs.stat(full,(err,st)=>{
    if(err||!st.isFile()){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Bulunamadı');return;}
    const ext=path.extname(full);
    const type=MIME[ext]||'application/octet-stream';
    const range=req.headers.range;
    if(range&&(ext==='.mp3'||ext==='.wav')){
      const match=/bytes=(\d+)-(\d*)/.exec(range);
      const start=match?Number(match[1]):0;
      const end=match&&match[2]?Math.min(Number(match[2]),st.size-1):st.size-1;
      if(start>=st.size||end<start){res.writeHead(416,{'content-range':`bytes */${st.size}`});res.end();return;}
      res.writeHead(206,{'content-type':type,'content-length':end-start+1,'content-range':`bytes ${start}-${end}/${st.size}`,'accept-ranges':'bytes','cache-control':'public, max-age=86400'});
      fs.createReadStream(full,{start,end}).pipe(res);return;
    }
    res.writeHead(200,{'content-type':type,'content-length':st.size,'accept-ranges':(ext==='.mp3'||ext==='.wav')?'bytes':'none','cache-control':ext==='.html'?'no-cache':'public, max-age=3600'});
    fs.createReadStream(full).pipe(res);
  });
}
const server=http.createServer(serve);

// Küçük, bağımlılıksız WebSocket katmanı (yalnız metin JSON mesajları).
function frame(text,opcode=1){
  const payload=Buffer.from(text);let head;
  if(payload.length<126){head=Buffer.alloc(2);head[1]=payload.length;}
  else if(payload.length<65536){head=Buffer.alloc(4);head[1]=126;head.writeUInt16BE(payload.length,2);}
  else{head=Buffer.alloc(10);head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2);}
  head[0]=0x80|opcode;return Buffer.concat([head,payload]);
}
function send(client,obj){if(!client.closed)try{client.socket.write(frame(JSON.stringify(obj)));}catch(_){}}
function ack(client,id,payload){if(id!==undefined&&id!==null)send(client,{type:'ack',id,payload});}
function emit(client,event,payload){send(client,{type:'event',event,payload});}
function broadcastRoom(room,event,payload){for(const c of clients)if(c.room===room.code)emit(c,event,payload);}
function parseFrames(client,chunk){
  client.buffer=Buffer.concat([client.buffer,chunk]);
  while(client.buffer.length>=2){
    const b0=client.buffer[0],b1=client.buffer[1],opcode=b0&0x0f,masked=!!(b1&0x80);let len=b1&0x7f,off=2;
    if(len===126){if(client.buffer.length<4)return;len=client.buffer.readUInt16BE(2);off=4;}
    else if(len===127){if(client.buffer.length<10)return;const big=client.buffer.readBigUInt64BE(2);if(big>BigInt(1e7)){client.socket.destroy();return;}len=Number(big);off=10;}
    const need=off+(masked?4:0)+len;if(client.buffer.length<need)return;
    let mask;if(masked){mask=client.buffer.subarray(off,off+4);off+=4;}
    const data=Buffer.from(client.buffer.subarray(off,off+len));client.buffer=client.buffer.subarray(need);
    if(masked)for(let i=0;i<data.length;i++)data[i]^=mask[i%4];
    if(opcode===8){client.socket.end(frame('',8));return;}
    if(opcode===9){client.socket.write(frame(data.toString(),10));continue;}
    if(opcode!==1)continue;
    try{const msg=JSON.parse(data.toString('utf8'));handleMessage(client,msg);}catch(_){emit(client,'room:error','Geçersiz ağ mesajı.');}
  }
}

function token(){return crypto.randomBytes(18).toString('hex');}
function code(){let c;do{c=String(Math.floor(100000+Math.random()*900000));}while(rooms.has(c));return c;}
function safeName(n){return String(n||'Oyuncu').replace(/[<>]/g,'').trim().slice(0,20)||'Oyuncu';}
function publicRoom(r){return {code:r.code,game:r.game,status:r.status,players:r.players.map(p=>p?{name:p.name,connected:p.connected}:null),state:r.state,createdAt:r.createdAt,updatedAt:r.updatedAt};}
function seatFor(r,t){return r.players.findIndex(p=>p&&p.token===t);}
function touch(r){r.updatedAt=Date.now();}
function roomUpdate(r){broadcastRoom(r,'room:update',publicRoom(r));}
function roomFrom(data){return rooms.get(String(data?.code||''));}
function fail(client,id,error){ack(client,id,{ok:false,error});}

function handleMessage(client,msg){
  const event=msg.event,data=msg.data||{},id=msg.id;
  if(event==='room:create'){
    const c=code(),t=token(),game=data.game==='hasami'?'hasami':'shogi';
    const r={code:c,game,status:'lobby',players:[{name:safeName(data.name),token:t,connected:true},null],state:null,createdAt:Date.now(),updatedAt:Date.now()};
    rooms.set(c,r);client.room=c;client.token=t;ack(client,id,{ok:true,token:t,room:publicRoom(r)});roomUpdate(r);return;
  }
  if(event==='room:join'){
    const r=roomFrom(data);if(!r)return fail(client,id,'Oda bulunamadı veya süresi doldu.');
    if(r.players[1]&&r.players[1].connected)return fail(client,id,'Bu oda dolu.');
    if(r.status!=='lobby'&&!r.players[1])return fail(client,id,'Başlamış oyuna yeni oyuncu alınmıyor.');
    const t=token();r.players[1]={name:safeName(data.name),token:t,connected:true};client.room=r.code;client.token=t;touch(r);ack(client,id,{ok:true,token:t,room:publicRoom(r)});roomUpdate(r);return;
  }
  if(event==='room:resume'){
    const r=roomFrom(data);if(!r)return fail(client,id,'Oda bulunamadı.');const seat=seatFor(r,data.token);if(seat<0)return fail(client,id,'Oturum anahtarı geçersiz.');
    r.players[seat].connected=true;client.room=r.code;client.token=data.token;touch(r);ack(client,id,{ok:true,seat,room:publicRoom(r)});roomUpdate(r);if(r.state)emit(client,'game:update',{state:r.state,room:publicRoom(r),event:null});return;
  }
  const r=roomFrom(data);if(!r)return fail(client,id,'Oda bulunamadı veya süresi doldu.');const seat=seatFor(r,data.token);if(seat<0)return fail(client,id,'Oyuncu doğrulanamadı.');
  if(event==='room:start'){
    if(seat!==0)return fail(client,id,'Oyunu yalnız oda sahibi başlatabilir.');if(!r.players[1])return fail(client,id,'İkinci oyuncu henüz katılmadı.');
    r.state=r.game==='shogi'?Core.createShogiState():Core.createHasamiState();r.status='playing';touch(r);ack(client,id,{ok:true});broadcastRoom(r,'game:update',{state:r.state,room:publicRoom(r),event:{type:'start'}});return;
  }
  if(event==='game:action'){
    if(r.status!=='playing'||!r.state)return fail(client,id,'Oyun başlamadı.');if(r.state.turn!==seat)return fail(client,id,'Sıra sende değil.');
    const result=Core.applyAction(r.state,data.action);if(!result.ok)return fail(client,id,result.error);
    r.state=result.state;if(r.state.winner!==null||r.state.draw)r.status='finished';touch(r);ack(client,id,{ok:true});broadcastRoom(r,'game:update',{state:r.state,room:publicRoom(r),event:result.event});return;
  }
  if(event==='game:resign'){
    if(!r.state)return fail(client,id,'Oyun başlamadı.');r.state.winner=Core.opponent(seat);r.state.reason=`${r.players[seat].name} teslim oldu`;r.status='finished';touch(r);ack(client,id,{ok:true});broadcastRoom(r,'game:update',{state:r.state,room:publicRoom(r),event:{type:'resign',player:seat}});return;
  }
  if(event==='room:rematch'){
    if(!r.players[0]||!r.players[1])return fail(client,id,'Rakip odada değil.');r.state=r.game==='shogi'?Core.createShogiState({firstPlayer:r.state?.turn??0}):Core.createHasamiState({firstPlayer:r.state?.turn??0});r.status='playing';touch(r);ack(client,id,{ok:true});broadcastRoom(r,'game:update',{state:r.state,room:publicRoom(r),event:{type:'rematch'}});return;
  }
  if(event==='room:leave'){
    r.players[seat].connected=false;touch(r);client.room=null;client.token=null;ack(client,id,{ok:true});roomUpdate(r);return;
  }
  fail(client,id,'Bilinmeyen işlem.');
}

server.on('upgrade',(req,socket)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname!=='/ws'){socket.destroy();return;}
  const key=req.headers['sec-websocket-key'];if(!key){socket.destroy();return;}
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const client={socket,buffer:Buffer.alloc(0),room:null,token:null,closed:false};clients.add(client);
  socket.on('data',chunk=>parseFrames(client,chunk));
  const close=()=>{if(client.closed)return;client.closed=true;clients.delete(client);const r=rooms.get(client.room);if(r){const seat=seatFor(r,client.token);if(seat>=0){r.players[seat].connected=false;touch(r);roomUpdate(r);}}};
  socket.on('close',close);socket.on('error',close);
});

setInterval(()=>{const now=Date.now();for(const [c,r] of rooms)if(now-r.updatedAt>1000*60*90)rooms.delete(c);},1000*60*10).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`KOMA çalışıyor: http://0.0.0.0:${PORT}`));
