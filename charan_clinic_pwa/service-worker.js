const CACHE = "charan-pwa-v1";
const ASSETS = [
  "/", "/index.html", "/dashboard.html", "/supervisor.html", "/frontoffice.html",
  "/patients.html", "/bookings.html", "/booking-status.html", "/pharmacy.html",
  "/lab.html", "/staff.html", "/settings.html",
  "/styles/styles.css", "/scripts/db.js", "/scripts/auth.js",
  "/scripts/utils.js", "/scripts/barcode.js", "/scripts/scanner.js",
  "/public/manifest.webmanifest"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE&&caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e=>{
  const { request } = e;
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(request, copy));
      return res;
    }).catch(()=>cached))
  );
});
