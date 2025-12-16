const ENVIRONMENTS = {
  prod: { host: "https://base.thefledge.com" },
  stage: { host: "http://localhost" },
  local: { host: "http://localhost" }
};

const buildEndpoints = (host) => ({
  sanora: `${host}/7243`,
  dolores: `${host}/3007`,
  covenant: `${host}/3011`
});

const dashboardState = {
  host: ENVIRONMENTS.prod.host,
  endpoints: buildEndpoints(ENVIRONMENTS.prod.host),
  store: {},
  profile: {}
};

const loadStoredState = () => {
  try {
    const raw = localStorage.getItem("fledge-userflow");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    dashboardState.host = parsed.host || dashboardState.host;
    dashboardState.endpoints = buildEndpoints(dashboardState.host);
    dashboardState.store = parsed.store || {};
    dashboardState.profile = parsed.profile || {};
    dashboardState.uuid = parsed.uuid || "";
    dashboardState.sanoraUuid = parsed.sanoraUuid || "";
  } catch (err) {
    console.warn("Failed to load stored state", err);
  }
};

const fetchJSON = async (url, options) => {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || res.statusText;
    throw new Error(`${res.status}: ${msg}`);
  }
  return body;
};

const normalizeSanoraProducts = (data) => {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.value)
    ? data.value
    : Array.isArray(data?.products)
    ? data.products
    : Array.isArray(data?.data)
    ? data.data
    : [];
  const expanded = [];
  arr.forEach((item) => {
    if (!item) return;
    if (Array.isArray(item)) {
      expanded.push(...item);
      return;
    }
    if (typeof item === "object") {
      const keys = Object.keys(item);
      if (keys.length && !item.title && !item.description) {
        keys.forEach((key) => {
          const val = item[key];
          if (val && typeof val === "object") {
            expanded.push({ ...val, productId: val.productId || val.id || key, title: val.title || key });
          }
        });
        return;
      }
    }
    expanded.push(item);
  });
  return expanded.map((p) => {
    const vis = p.visibility || (p.isPublic ? "global" : "store") || "global";
    return {
      ...p,
      title: p.title || p.name || "",
      visibility: vis,
      isPublic: vis === "global",
      storeId: p.storeId || "",
      price: p.price || p.amount || 0
    };
  });
};

const deriveStoreId = () =>
  dashboardState.store?.referralCode ||
  dashboardState.store?.referralId ||
  dashboardState.sanoraUuid ||
  dashboardState.uuid ||
  "";

const buildStoreLink = () => {
  const code = deriveStoreId();
  if (!code) return "";
  const origin = (window?.location?.origin || dashboardState.host || "").replace(/\/$/, "");
  return `${origin}/store.html?storeId=${encodeURIComponent(code)}`;
};

const fetchGlobalProducts = async () => {
  const data = await fetchJSON(`${dashboardState.endpoints.sanora}/products/base`);
  return normalizeSanoraProducts(data);
};

const fetchStoreProducts = async () => {
  const storeId = deriveStoreId();
  if (!storeId) return [];
  const data = await fetchJSON(`${dashboardState.endpoints.sanora}/products/${encodeURIComponent(storeId)}`);
  return normalizeSanoraProducts(data);
};

const fetchFeed = async () => {
  try {
    const data = await fetchJSON(`${dashboardState.endpoints.dolores}/canimus/feeds`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.feeds)) return data.feeds;
    return [];
  } catch (err) {
    return { error: err.message };
  }
};

const checkService = async (name, url) => {
  try {
    const res = await fetch(url);
    const ok = res.ok;
    return { name, status: ok ? "up" : "down", detail: `HTTP ${res.status}` };
  } catch (err) {
    return { name, status: "down", detail: err.message };
  }
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const renderStats = ({ globalProducts, storeProducts, services }) => {
  setText("stat-host", `Host: ${dashboardState.host}`);
  setText("stat-global-products", globalProducts.length.toString());
  const visCounts = globalProducts.reduce(
    (acc, p) => {
      acc[p.visibility || "global"] = (acc[p.visibility || "global"] || 0) + 1;
      return acc;
    },
    {}
  );
  setText(
    "stat-global-visibility",
    `Global ${visCounts.global || 0} · Store ${visCounts.store || 0} · Private ${visCounts.private || 0}`
  );

  const storeId = deriveStoreId();
  setText("stat-store-products", storeProducts.length ? storeProducts.length.toString() : "0");
  setText("stat-store-id", storeId || "No store detected");
  const btnOpen = document.getElementById("btn-open-store");
  if (btnOpen) {
    const link = buildStoreLink();
    btnOpen.disabled = !link;
    if (link) btnOpen.onclick = () => window.open(link, "_blank");
  }

  const upCount = services.filter((s) => s.status === "up").length;
  setText("stat-services-up", `${upCount}/${services.length} up`);
  setText(
    "stat-services-note",
    services.map((s) => `${s.name}: ${s.status === "up" ? "ok" : "down"}`).join(" · ")
  );
  const pill = document.getElementById("service-health-pill");
  if (pill) {
    const healthy = upCount === services.length;
    pill.className =
      "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold border " +
      (healthy
        ? "bg-green-500/10 border-green-500/20 text-green-200"
        : "bg-yellow-500/10 border-yellow-500/20 text-yellow-200");
    pill.innerHTML = `<span class="size-1.5 rounded-full ${
      healthy ? "bg-green-400" : "bg-yellow-400"
    } animate-pulse"></span> ${healthy ? "Healthy" : "Degraded"}`;
  }

  const now = new Date().toLocaleString();
  setText("stat-last-sync", now);
  setText("stat-sync-note", `Synced ${globalProducts.length} global products`);
};

const renderVisibilityBars = (globalProducts, storeProducts) => {
  const container = document.getElementById("visibility-bars");
  if (!container) return;
  const totals = { global: 0, store: 0, private: 0 };
  [...globalProducts, ...storeProducts].forEach((p) => {
    const vis = p.visibility || (p.isPublic ? "global" : "store");
    totals[vis] = (totals[vis] || 0) + 1;
  });
  const totalCount = Object.values(totals).reduce((a, b) => a + b, 0);
  setText("visibility-total", `${totalCount} total`);
  container.innerHTML = "";
  const entries = [
    { key: "global", color: "from-primary/20 to-primary/80" },
    { key: "store", color: "from-secondary-orange/20 to-secondary-orange/70" },
    { key: "private", color: "from-slate-500/20 to-slate-300/70" }
  ];
  entries.forEach((entry) => {
    const count = totals[entry.key] || 0;
    const height = totalCount ? Math.max(8, (count / totalCount) * 100) : 8;
    const bar = document.createElement("div");
    bar.className = `flex-1 bg-gradient-to-t ${entry.color} rounded-t relative`;
    bar.style.height = `${height}%`;
    bar.innerHTML = `<div class="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-white bg-surface-darker px-2 py-1 rounded opacity-80">${count} ${entry.key}</div>`;
    container.appendChild(bar);
  });
};

const renderProductsTable = (products) => {
  const body = document.getElementById("global-products-body");
  if (!body) return;
  body.innerHTML = "";
  if (!products.length) {
    body.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="4">No products returned from Sanora.</td></tr>`;
    return;
  }
  products.slice(0, 12).forEach((p) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-white/5 transition-colors";
    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-white">${p.title || "(untitled)"}</td>
      <td class="px-6 py-4 font-mono text-xs">${p.storeId || "-"}</td>
      <td class="px-6 py-4 text-right text-white font-semibold">${p.price || 0}</td>
      <td class="px-6 py-4 text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          p.visibility === "global"
            ? "bg-green-500/10 text-green-300 border border-green-500/20"
            : p.visibility === "store"
            ? "bg-orange-500/10 text-orange-300 border border-orange-500/20"
            : "bg-slate-600/40 text-slate-200 border border-slate-500/40"
        }">${p.visibility || "-"}</span>
      </td>
    `;
    body.appendChild(tr);
  });
};

const renderFeed = (feed) => {
  const container = document.getElementById("activity-feed");
  if (!container) return;
  container.innerHTML = "";
  if (!feed || (Array.isArray(feed) && feed.length === 0)) {
    container.innerHTML = `<p class="text-slate-400 text-sm">No live feed returned from Dolores.</p>`;
    return;
  }
  if (feed.error) {
    container.innerHTML = `<p class="text-red-300 text-sm">Feed error: ${feed.error}</p>`;
    return;
  }
  feed.slice(0, 10).forEach((item) => {
    const title = item.title || item.event || "Event";
    const desc = item.description || item.detail || "";
    const ts = item.timestamp || item.ts || "";
    const node = document.createElement("div");
    node.className = "flex gap-3";
    node.innerHTML = `
      <div class="mt-1">
        <div class="size-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
          <span class="material-symbols-outlined text-primary text-sm">feed</span>
        </div>
      </div>
      <div class="flex flex-col">
        <p class="text-sm text-white font-semibold">${title}</p>
        <p class="text-xs text-slate-400">${desc}</p>
        <p class="text-[10px] text-slate-500">${ts}</p>
      </div>
    `;
    container.appendChild(node);
  });
};

const renderPerformance = (products) => {
  const container = document.getElementById("product-performance");
  if (!container) return;
  const totalLabel = document.getElementById("product-performance-total");
  container.innerHTML = "";
  if (!products.length) {
    container.innerHTML = `<p class="text-slate-400 text-sm">No products to chart yet.</p>`;
    if (totalLabel) totalLabel.textContent = "0 products";
    return;
  }
  const sorted = [...products].sort((a, b) => (parseFloat(b.price || 0) || 0) - (parseFloat(a.price || 0) || 0));
  const top = sorted.slice(0, 5);
  const maxPrice = Math.max(...top.map((p) => parseFloat(p.price || 0) || 0), 1);
  top.forEach((p) => {
    const price = parseFloat(p.price || 0) || 0;
    const width = Math.max(5, Math.min(100, (price / maxPrice) * 100));
    const row = document.createElement("div");
    row.innerHTML = `
      <div class="flex justify-between text-sm mb-1">
        <span class="text-white">${p.title || "(untitled)"}</span>
        <span class="text-slate-400">${price}</span>
      </div>
      <div class="w-full bg-slate-800 rounded-full h-2">
        <div class="bg-gradient-to-r from-primary to-purple-400 h-2 rounded-full" style="width:${width}%"></div>
      </div>
    `;
    container.appendChild(row);
  });
  if (totalLabel) totalLabel.textContent = `${products.length} products total`;
};

const renderBDOSnapshot = () => {
  setText("bdo-profile-name", dashboardState.profile?.displayName || dashboardState.profile?.name || "--");
  setText("bdo-profile-email", dashboardState.profile?.email || "--");
  setText("bdo-store-name", dashboardState.store?.name || "--");
  setText("bdo-store-code", dashboardState.store?.referralCode || deriveStoreId() || "--");
};

const renderServiceList = (services) => {
  const list = document.getElementById("service-list");
  if (!list) return;
  list.innerHTML = "";
  services.forEach((s) => {
    const row = document.createElement("div");
    row.className =
      "flex items-center justify-between p-3 rounded-lg border " +
      (s.status === "up" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5");
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-sm ${s.status === "up" ? "text-green-300" : "text-red-300"}">${
      s.status === "up" ? "check_circle" : "error"
    }</span>
        <span class="text-white text-sm font-semibold">${s.name}</span>
      </div>
      <span class="text-xs text-slate-300">${s.detail}</span>
    `;
    list.appendChild(row);
  });
};

const refreshDashboard = async () => {
  try {
    const [globalProducts, storeProducts, feed, sanoraStatus, covenantStatus, doloresStatus] = await Promise.all([
      fetchGlobalProducts().catch((err) => {
        console.warn("Global products", err);
        return [];
      }),
      fetchStoreProducts().catch((err) => {
        console.warn("Store products", err);
        return [];
      }),
      fetchFeed(),
      checkService("Sanora", `${dashboardState.endpoints.sanora}/products/base`),
      checkService("Covenant", `${dashboardState.endpoints.covenant}/health`),
      checkService("Dolores", `${dashboardState.endpoints.dolores}/canimus/feeds`)
    ]);

    const services = [sanoraStatus, covenantStatus, doloresStatus];
    renderStats({ globalProducts, storeProducts, services });
    renderVisibilityBars(globalProducts, storeProducts);
    renderProductsTable(globalProducts);
    renderFeed(feed);
    renderPerformance(globalProducts);
    renderBDOSnapshot();
    renderServiceList(services);
  } catch (err) {
    console.error("Dashboard refresh failed", err);
  }
};

const bindButtons = () => {
  const refreshers = ["btn-refresh-admin", "btn-refresh-products"];
  refreshers.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", refreshDashboard);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  loadStoredState();
  bindButtons();
  renderBDOSnapshot();
  refreshDashboard();
});
