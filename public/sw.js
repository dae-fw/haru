/* Haru service worker — app shell + last-seen data offline.
   Read-only offline: you can open the app and see your most recent
   Today / All / Capture screens. Edits still need a connection. */

const VERSION = "haru-v2";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;

const OFFLINE_HTML = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Haru — offline</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f2f4f5;color:#1c2327;
display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}
p{color:#5b666c;max-width:22rem;line-height:1.5}</style>
<div><h1>Offline</h1><p>Haru can't reach the network right now. Open it again once you're
back online — anything you changed while connected is safe.</p></div>`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.put("/__offline", new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "Haru", {
      body: d.body || "",
      tag: d.tag || "haru",
      renotify: true,
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(target).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never touch mutations
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let Supabase/Google pass through

  // auth + API + OAuth: always network, never cache
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/connect/")
  ) {
    return;
  }

  // static assets: cache-first (they're content-hashed)
  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // navigations + RSC payloads: network-first, fall back to the last good copy
  const isRSC =
    request.mode === "navigate" ||
    request.headers.get("RSC") === "1" ||
    url.searchParams.has("_rsc");
  if (isRSC) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const cache = await caches.open(PAGES);
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          const cache = await caches.open(PAGES);
          const hit =
            (await cache.match(request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/"));
          if (hit) return hit;
          const shell = await caches.open(SHELL);
          return (
            (await shell.match("/__offline")) ||
            new Response("offline", { status: 503 })
          );
        }
      })(),
    );
  }
});
