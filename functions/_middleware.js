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

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(
          '<script>' + restoreLiveYouTubeFetch + '</script>' +
          '<script src="/passroyale-live.js" defer></script>',
          { html: true }
        );
      }
    })
    .transform(response);
}
