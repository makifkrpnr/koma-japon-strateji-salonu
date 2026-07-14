const CACHE='koma-v1.1.0';
const ASSETS=['/','/index.html','/styles.css','/js/game-core.js','/js/app.js','/manifest.json','/assets/icon-192.png','/assets/icon-512.png','/assets/audio/traditional-japanese-theme.mp3'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.startsWith('/socket.io/')) return;
  const audioPath='/assets/audio/traditional-japanese-theme.mp3';
  if(u.pathname===audioPath&&e.request.headers.has('range')){
    e.respondWith(caches.match(audioPath).then(async cached=>{
      if(!cached)return fetch(e.request);
      const buffer=await cached.arrayBuffer();
      const range=e.request.headers.get('range')||'bytes=0-';
      const match=/bytes=(\d+)-(\d*)/.exec(range);
      const start=match?Number(match[1]):0;
      const end=match&&match[2]?Number(match[2]):buffer.byteLength-1;
      const chunk=buffer.slice(start,end+1);
      return new Response(chunk,{status:206,headers:{'Content-Type':'audio/mpeg','Content-Length':String(chunk.byteLength),'Content-Range':`bytes ${start}-${end}/${buffer.byteLength}`,'Accept-Ranges':'bytes'}});
    }));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok&&r.status===200){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});}
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html'))));
});
