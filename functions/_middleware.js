import { onRequestGet as channelEndpoint } from "./api/channel.js";

// Render the subscriber goal with live data at the Cloudflare edge. This keeps
// the counter useful even when visitors' browsers cannot call the API directly.
export async function onRequest(context) {
  const response = await context.next();
  const pathname = new URL(context.request.url).pathname;
  if (context.request.method !== "GET" ||
      (pathname !== "/" && pathname !== "/index.html") ||
      !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }

  const rewriter = new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(
          '<link rel="icon" type="image/svg+xml" href="/passroyale-favicon.svg"><script src="/passroyale-live.js" defer></script>',
          { html: true }
        );
      }
    });

  try {
    // Reuse exactly the same secured server function as GET /api/channel.
    const channel = await channelEndpoint(context);
    if (channel.ok) {
      const info = await channel.json();
      const count = Number(info.subscribers);
      if (Number.isSafeInteger(count) && count >= 0) {
        const percentage = Math.min(100, Math.round((count / 100) * 100));
        rewriter
          .on("#meta", {
            element(el) {
              el.setAttribute("data-youtube-subscribers", String(count));
              el.setAttribute("data-youtube-status", "connected");
            }
          })
          .on("#meta .goal-numbers strong", {
            element(el) { el.setInnerContent(count.toLocaleString("pt-BR")); }
          })
          .on("#meta .goal-numbers b", {
            element(el) {
              el.setInnerContent(percentage + '% <small>DA META</small>', { html: true });
            }
          })
          .on("#meta .status", {
            element(el) {
              // Retain the existing YouTube SVG icon.
              el.setInnerContent(
                '<svg class="youtube-mark" width="16" height="16" viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="6" fill="#ff0033"></rect><path d="M11 5.5L19 10l-8 4.5z" fill="white"></path></svg> CONTADOR CONECTADO',
                { html: true }
              );
            }
          })
          .on("#meta .elixir", {
            element(el) { el.setAttribute("aria-valuenow", String(Math.min(100, count))); }
          })
          .on("#meta .elixir-fill", {
            element(el) { el.setAttribute("style", "width: " + percentage + "%;"); }
          })
          .on("#meta .goal-bottom p", {
            element(el) { el.setInnerContent("Nossa barra de elixir acompanha os inscritos reais do canal."); }
          })
          .on("#meta .fine", {
            element(el) { el.setInnerContent("Contagem sincronizada com os dados públicos do YouTube."); }
          });
      }
    }
  } catch (error) {
    console.warn("[Pass Royale] Edge subscriber hydration unavailable:", String(error));
  }
  return rewriter.transform(response);
}
