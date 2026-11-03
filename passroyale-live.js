/* Pass Royale live subscribers / site favicon integration. No API key is exposed. */
(() => {
  "use strict";
  const GOAL = 100;
  const ENDPOINT = "/api/channel";
  const normalize = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  function textElements(root) {
    return [...root.querySelectorAll("body *")].filter(el =>
      el.children.length === 0 && el.textContent?.trim());
  }
  function setLeaf(root, match, update) {
    for (const el of textElements(root)) {
      if (match(normalize(el.textContent), el)) update(el);
    }
  }
  function findMissionCard() {
    const label = textElements(document).find(el => normalize(el.textContent).includes("rumo aos 100"));
    if (!label) return null;
    let node = label;
    for (let i = 0; i < 8 && node?.parentElement; i++, node = node.parentElement) {
      const content = normalize(node.textContent);
      if (content.includes("100 inscritos") && (content.includes("barra de elixir") || content.includes("meta"))) {
        return node;
      }
    }
    return label.closest("section, article") || label.parentElement?.parentElement;
  }

  function updateCount(count) {
    const card = findMissionCard();
    if (!card) return;
    const pct = Math.min(100, Math.max(0, count / GOAL * 100));
    let countUpdated = false;
    setLeaf(card, s => /^([—–-]|\d[\d.,]*)\s*\/\s*100\s*inscritos$/.test(s), el => {
      el.textContent = count.toLocaleString("pt-BR") + " /100 inscritos";
      countUpdated = true;
    });
    // Some versions wrap the number in its own element.
    if (!countUpdated) {
      setLeaf(card, s => /^([—–-]|\d[\d.,]*)\s*$/.test(s), el => {
        if (countUpdated) return;
        const parent = normalize(el.parentElement?.textContent);
        if (parent.includes("/100 inscritos")) { el.textContent = count.toLocaleString("pt-BR"); countUpdated = true; }
      });
    }
    setLeaf(card, s => /^(?:[—–-]+|\d+(?:[.,]\d+)?)\s*%\s*(?:da meta)?$/.test(s), el => {
      el.textContent = pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "% da meta";
    });
    setLeaf(card, s => s.includes("conexao aguardando") || s.includes("aguardando conexao") ||
      s.includes("esperando os dados do canal") || s.includes("conexao com o youtube estiver ativa"), el => {
      if (normalize(el.textContent).includes("barra de elixir")) {
        el.textContent = "Nossa barra de elixir acompanha os inscritos do canal.";
      } else if (normalize(el.textContent).includes("contagem")) {
        el.textContent = "Contagem atualizada com os dados do YouTube.";
      } else {
        el.textContent = "● YouTube conectado";
      }
    });

    const progress = card.querySelector('[role="progressbar"]');
    if (progress) {
      progress.setAttribute("aria-valuenow", String(count));
      progress.setAttribute("aria-valuemax", String(GOAL));
      progress.style.setProperty("--progress", pct + "%");
    }
    const candidates = [...card.querySelectorAll("*")].filter(el => {
      const cls = String(el.className || "") + " " + String(el.id || "");
      return /(?:elixir|progress|fill|barra)/i.test(cls) && el.children.length === 0 &&
        !el.textContent?.trim();
    });
    for (const el of candidates) {
      if (el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height < 32) {
        el.style.width = pct + "%";
      }
    }
    card.dataset.youtubeSubscribers = String(count);
  }

  async function updateSubscribers() {
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const info = await response.json();
      const count = Number(info.subscribers ?? info.subscriberCount ?? info.count);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid subscribers count");
      updateCount(count);
    } catch (error) {
      console.warn("[Pass Royale] Inscritos indisponíveis:", error.message);
    }
  }

  // Use the real brand logo already rendered in the site's navigation as the tab icon.
  function setBrandFavicon() {
    const images = [...document.querySelectorAll("header img, nav img, img")];
    const image = images.find(img => {
      const s = normalize([img.alt, img.id, img.className].join(" "));
      return (s.includes("pass royale") || s.includes("logo")) && img.naturalWidth > 0;
    }) || images.find(img => img.closest("header, nav") && img.naturalWidth > 0 &&
      img.naturalWidth < 1000);
    if (!image) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = Math.min(60 / image.naturalWidth, 60 / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      ctx.drawImage(image, (64 - w)/2, (64 - h)/2, w, h);
      const link = document.querySelector('link[rel="icon"]') || document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");
      if (!link.isConnected) document.head.appendChild(link);
    } catch (e) { /* Keep SVG fallback when image cannot be drawn. */ }
  }

  function init() {
    setBrandFavicon();
    updateSubscribers();
    setInterval(updateSubscribers, 60000);
    addEventListener("load", setBrandFavicon, { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
