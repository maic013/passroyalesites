/* Pass Royale subscriber counter. The YouTube key remains server-side. */
(() => {
  "use strict";
  const GOAL = 100;
  const endpoint = "/api/channel";

  function getCard() {
    return document.getElementById("meta");
  }

  function setStatus(card, message) {
    const status = card.querySelector(".goal-heading .status");
    if (!status) return;
    // Keep the original YouTube symbol in the status pill.
    const textNode = [...status.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = " " + message;
    else status.appendChild(document.createTextNode(" " + message));
  }

  function paint(count, stale = false) {
    const card = getCard();
    if (!card || !Number.isSafeInteger(count) || count < 0) return;
    const percent = Math.min(100, count / GOAL * 100);
    const n = card.querySelector(".goal-numbers strong");
    const p = card.querySelector(".goal-numbers b");
    const bar = card.querySelector(".elixir");
    const fill = card.querySelector(".elixir-fill");
    const description = card.querySelector(".goal-bottom p");
    const note = card.querySelector(".fine");

    if (n) n.textContent = count.toLocaleString("pt-BR");
    if (p) {
      const small = p.querySelector("small");
      p.replaceChildren(document.createTextNode(Math.round(percent) + "% "));
      if (small) p.appendChild(small);
      else {
        const x = document.createElement("small");
        x.textContent = "DA META";
        p.appendChild(x);
      }
    }
    if (bar) bar.setAttribute("aria-valuenow", String(Math.min(GOAL, count)));
    if (fill) fill.style.width = percent + "%";
    if (description) description.textContent = "Nossa barra de elixir acompanha os inscritos reais do canal.";
    if (note) note.textContent = stale
      ? "Última contagem recebida do YouTube; atualização automática em breve."
      : "Contagem sincronizada com os dados públicos do YouTube.";
    setStatus(card, stale ? "CONTAGEM RECENTE" : "CONTADOR CONECTADO");
    card.dataset.youtubeSubscribers = String(count);
    card.dataset.youtubeStatus = stale ? "cached" : "connected";
  }

  async function refresh() {
    try {
      const response = await fetch(endpoint, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error ? detail.error + " (HTTP " + response.status + ")" : "HTTP " + response.status);
      }
      const json = await response.json();
      const count = Number(json.subscribers ?? json.subscriberCount ?? json.count);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("invalid_count");
      paint(count);
    } catch (error) {
      const card = getCard();
      const existing = Number(card?.dataset.youtubeSubscribers);
      if (card?.dataset.youtubeSubscribers && Number.isSafeInteger(existing)) {
        // A temporary request failure must never erase the last valid count.
        paint(existing, true);
      } else if (card) {
        setStatus(card, "YOUTUBE INDISPONÍVEL");
        card.dataset.youtubeStatus = "unavailable";
      }
      console.warn("[Pass Royale] Falha temporária no contador:", error.message);
    }
  }

  function setBrandFavicon() {
    // Preserve the Pass Royale v2.8 WebP favicon selected by the site.
    if (document.querySelector('link[rel="icon"][type="image/webp"]')) return;
    const images = [...document.querySelectorAll("header img, nav img")];
    const source = images.find(img => img.naturalWidth > 0 && img.naturalWidth < 1500);
    if (!source) return; // SVG brand favicon from the server remains the fallback.
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const context = canvas.getContext("2d");
      if (!context) return;
      const scale = Math.min(60 / source.naturalWidth, 60 / source.naturalHeight);
      const width = source.naturalWidth * scale;
      const height = source.naturalHeight * scale;
      context.drawImage(source, (64 - width) / 2, (64 - height) / 2, width, height);
      const icon = document.querySelector('link[rel="icon"]') || document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/png";
      icon.href = canvas.toDataURL("image/png");
      if (!icon.isConnected) document.head.appendChild(icon);
    } catch { /* Keep the static fallback icon. */ }
  }

  function init() {
    const card = getCard();
    const preloaded = card?.dataset.youtubeSubscribers;
    if (preloaded && /^\d+$/.test(preloaded)) paint(Number(preloaded));
    setBrandFavicon();
    refresh();
    setInterval(refresh, 60000);
    addEventListener("load", setBrandFavicon, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
