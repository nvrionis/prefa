/* Πρέφα — service worker
   ΑΛΛΑΞΕ ΤΟ VERSION σε κάθε ανέβασμα νέας έκδοσης. Αυτό και μόνο αρκεί:
   το παλιό cache σβήνεται και οι παίκτες παίρνουν ειδοποίηση για ανανέωση. */
const VERSION = "v2";
const CORE = "prefa-core-" + VERSION;
const FONTS = "prefa-fonts-" + VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CORE).then((c) =>
      // ένα αρχείο που λείπει δεν πρέπει να ρίξει όλη την εγκατάσταση
      Promise.all(ASSETS.map((u) => c.add(u).catch(() => null)))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CORE && k !== FONTS).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// η σελίδα ζητά να περάσει αμέσως η νέα έκδοση
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

function fromNetworkFirst(req, cacheName, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () =>
      caches.match(req).then((r) => resolve(r || caches.match("./index.html")));
    const timer = setTimeout(() => { if (!done) fallback(); }, timeout);
    fetch(req)
      .then((res) => {
        done = true; clearTimeout(timer);
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
        resolve(res);
      })
      .catch(() => { done = true; clearTimeout(timer); fallback(); });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // πλοήγηση: πρώτα δίκτυο, ώστε να έρχονται οι ενημερώσεις· αλλιώς από το cache
  if (req.mode === "navigate") {
    e.respondWith(fromNetworkFirst(req, CORE, 3500));
    return;
  }

  // γραμματοσειρές Google: από το cache και ανανέωση στο παρασκήνιο
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(FONTS).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // δικά μας αρχεία: από το cache, με σιωπηλή ανανέωση
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CORE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
