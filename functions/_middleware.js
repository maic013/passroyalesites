import { onRequestGet as getChannelData } from "./api/channel.js";
// Cloudflare Pages middleware for the standalone, self-contained React site.
// The exported index.html still contains an offline-preview fetch stub which
// intercepts /api/channel and always returns HTTP 503. Because the original
// HTML is ~18MB, disable ONLY that stale stub before its inline bundle runs.
// The real /api/channel remains available through functions/api/channel.js.
const restoreLiveYouTubeFetch = `
(function () {
  const original = window.fetch.bind(window);
  let handled = false;
  Object.defineProperty(window, "fetch", {
    configurable: true,
    enumerable: true,
    get() { return original; },
    set(candidate) {
      // The offline preview assigns this function once while bootstrapping.
      // Ignore that one assignment and restore a normal writable fetch.
      const isOfflineStub = !handled && typeof candidate === "function" &&
        Function.prototype.toString.call(candidate).includes("/api/channel");
      handled = true;
      Object.defineProperty(window, "fetch", {
        configurable: true, enumerable: true, writable: true,
        value: isOfflineStub ? original : candidate
      });
    }
  });
})();
`;

export async function onRequest(context) {
  const response = await context.next();
  const pathname = new URL(context.request.url).pathname;
  if (context.request.method !== "GET" ||
      (pathname !== "/" && pathname !== "/index.html") ||
      !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }

  // Seed the React goal card with real data while the normal client refresh loads.
  // Store the count only (never the YouTube API key) in the delivered HTML.
  let initialCount = null;
  try {
    const cacheKey = new Request(new URL("/__passroyale_public_subscribers_v28", context.request.url));
    let cached = await caches.default.match(cacheKey);
    if (!cached) {
      const api = await getChannelData(context);
      if (api.ok) {
        cached = new Response(await api.text(), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
        });
        context.waitUntil(caches.default.put(cacheKey, cached.clone()));
      }
    }
    if (cached?.ok) {
      const data = await cached.json();
      const value = Number(data.subscribers);
      if (Number.isSafeInteger(value) && value >= 0) initialCount = value;
    }
  } catch (error) {
    console.warn("[Pass Royale] Initial count unavailable:", String(error));
  }

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        const seed = Number.isSafeInteger(initialCount)
          ? '<script>window.__PASS_ROYALE_COUNT__=' + initialCount + ';</script>'
          : '';
        element.append(
          seed + '<script>' + restoreLiveYouTubeFetch + '</script>' +
          '<script src="/passroyale-live.js" defer></script>',
          { html: true }
        );
      }
    })
    .transform(response);
}
