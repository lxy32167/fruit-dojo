const CACHE='fruit-dojo-v7';
const CORE=['./','./index.html','./styles.css','./game.js','./icon.svg','./manifest.webmanifest','./assets/background.webp','./assets/splats.webp','./assets/slice.wav','./assets/bomb.wav','./assets/combo.wav','./assets/launch.wav','./assets/swipe1.wav','./assets/swipe2.wav','./assets/swipe3.wav','./assets/crunch.wav','./assets/juicy.wav'];
CORE.push('./assets/fruits/atlas.webp','./assets/fruits/atlas.json');
CORE.push(...['start','miss','life','critical','pome1','pome2','pome3','pomeBurst','dragon'].map(name=>`./assets/${name}.wav`));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fruit-dojo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));});
