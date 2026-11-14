const CACHE='fruit-dojo-v4';
const CORE=['./','./index.html','./styles.css','./game.js','./icon.svg','./manifest.webmanifest','./assets/background.webp','./assets/splats.webp','./assets/slice.wav','./assets/bomb.wav','./assets/combo.wav','./assets/launch.wav'];
CORE.push(...['watermelon','orange','apple','kiwi','lemon','peach'].flatMap(name=>['','-half1','-half2'].map(part=>`./assets/fruits/${name}${part}.webp`)));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fruit-dojo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));});
