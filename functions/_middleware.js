// Preserve the large standalone site and inject the subscriber/fav-icon fixes at the edge.
export async function onRequest(context) {
  const response = await context.next();
  const pathname = new URL(context.request.url).pathname;
  if (context.request.method !== "GET" || (pathname !== "/" && pathname !== "/index.html") ||
      !response.headers.get("content-type")?.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append('<link rel="icon" type="image/svg+xml" href="/passroyale-favicon.svg"><script src="/passroyale-live.js" defer></script>', { html: true });
      }
    })
    .transform(response);
}
