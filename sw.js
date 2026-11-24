/* My English — ოფლაინ ქეში
   index.html და data.js ყოველთვის ქსელიდან მოდის (ახალი მასალა მაშინვე ჩანს),
   ქსელის გარეშე — ქეშიდან. ხატულები და მანიფესტი ქეშიდან.
   ⚠️ ფაილების სიის ცვლილებისას V ვერსია გაზარდე. */
const V = "myeng-v1";
const CORE = [
  "./",
  "./index.html",
  "./data.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isFresh = req => {
  const p = new URL(req.url).pathname;
  return req.mode === "navigate" || req.destination === "document" ||
         p.endsWith("/index.html") || p.endsWith("/data.js") || p.endsWith("/");
};

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (isFresh(req)) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(V).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(V).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => new Response("", { status: 504, statusText: "offline" })))
  );
});
