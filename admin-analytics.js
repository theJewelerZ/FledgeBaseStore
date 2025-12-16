// admin-analytics.js
// Live wiring for global analytics using the same services as admin.js

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

const analyticsState = {
  host: ENVIRONMENTS.prod.host,
  endpoints: buildEndpoints(ENVIRONMENTS.prod.host),
  store: {},
  profile: {},
  uuid: "",
  sanoraUuid: ""
};

const loadStoredState = () => {
  try {
    const raw = localStorage.getItem("fledge-userflow");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    analyticsState.host = parsed.host || analyticsState.host;
    analyticsState.endpoints = buildEndpoints(analyticsState.host);
    analyticsState.store = parsed.store || {};
    analyticsState.profile = parsed.profile || {};
    analyticsState.uuid = parsed.uuid || "";
    analyticsState.sanoraUuid = parsed.sanoraUuid || "";
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
  analyticsState.store?.referralCode ||
  analyticsState.store?.referralId ||
  analyticsState.sanoraUuid ||
  analyticsState.uuid ||
  "";

const fetchGlobalProducts = async () => {
  const data = await fetchJSON(`${analyticsState.endpoints.sanora}/products/base`);
  return normalizeSanoraProducts(data);
};

const fetchFeed = async () => {
  try {
    const data = await fetchJSON(`${analyticsState.endpoints.dolores}/canimus/feeds`);
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
    return { name, status: res.ok ? "up" : "down", detail: `HTTP ${res.status}` };
  } catch (err) {
    return { name, status: "down", detail: err.message };
  }
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const renderKPIs = (products) => {
  // Basic aggregates from product price field
  const total = products.reduce((sum, p) => sum + (parseFloat(p.price || 0) || 0), 0);
  const storeCount = new Set(products.map((p) => p.storeId || "global")).size || 0;
  setText("kpi-revenue", `$${total.toFixed(2)}`);
  setText("kpi-stores", `${storeCount}`);
  setText("kpi-sessions", `${products.length}`);
  setText("kpi-gmv", `${products.length} items`);
};

const renderBars = (products) => {
  const container = document.getElementById("bar-revenue");
  if (!container) return;
  const classes = [
    "from-primary/20 to-primary/80",
    "from-primary/20 to-primary/80",
    "from-primary/20 to-primary/80",
    "from-primary/20 to-primary/80",
    "from-primary/20 to-primary/80",
    "from-primary/20 to-primary/80",
    "from-primary/20 to-primary/80",
    "from-accent-orange/20 to-accent-orange/60"
  ];
  container.innerHTML = "";
  const slice = products.slice(0, 8);
  const maxPrice = Math.max(...slice.map((p) => parseFloat(p.price || 0) || 0), 1);
  slice.forEach((p, idx) => {
    const price = parseFloat(p.price || 0) || 0;
    const height = Math.max(5, Math.min(100, (price / maxPrice) * 100));
    const bar = document.createElement("div");
    bar.className = `relative flex-1 group`;
    bar.innerHTML = `
      <div class="w-full bg-gradient-to-t ${classes[idx] || classes[0]} rounded-t-sm" style="height:${height}%;"></div>
    `;
    container.appendChild(bar);
  });
};

const renderTopStores = (products) => {
  const body = document.getElementById("top-stores-body");
  if (!body) return;
  body.innerHTML = "";
  if (!products.length) {
    body.innerHTML = `<tr><td class="p-4 text-slate-500" colspan="4">No stores yet.</td></tr>`;
    return;
  }
  const grouped = products.reduce((acc, p) => {
    const id = p.storeId || "global";
    acc[id] = acc[id] || { id, products: 0, volume: 0 };
    acc[id].products += 1;
    acc[id].volume += parseFloat(p.price || 0) || 0;
    return acc;
  }, {});
  const rows = Object.values(grouped)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10);
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "group hover:bg-white/5 transition-colors";
    tr.innerHTML = `
      <td class="p-4 flex items-center gap-3">
        <div class="size-8 rounded bg-gradient-to-br from-primary to-accent-orange flex items-center justify-center text-white font-bold text-xs">${row.id.slice(0, 1).toUpperCase()}</div>
        <span class="font-medium text-white">${row.id}</span>
      </td>
      <td class="p-4 hidden sm:table-cell font-mono text-slate-400 text-xs">${row.id}</td>
      <td class="p-4 text-right font-semibold text-white">$${row.volume.toFixed(2)}</td>
      <td class="p-4 text-right">
        <span class="inline-flex items-center rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-400">Live</span>
      </td>
    `;
    body.appendChild(tr);
  });
};

const renderFeed = (feed) => {
  const container = document.getElementById("live-feed");
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
  feed.slice(0, 8).forEach((item) => {
    const title = item.title || item.event || "Event";
    const desc = item.description || item.detail || "";
    const ts = item.timestamp || item.ts || "";
    const node = document.createElement("div");
    node.className = "flex gap-3";
    node.innerHTML = `
      <div class="mt-1">
        <div class="size-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
          <span class="material-symbols-outlined text-primary text-sm">bolt</span>
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

const renderServiceHealth = (services) => {
  const wrap = document.getElementById("service-health");
  if (!wrap) return;
  wrap.innerHTML = "";
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
    wrap.appendChild(row);
  });
};

const refreshAnalytics = async () => {
  try {
    const [products, feed, sanoraStatus, covenantStatus, doloresStatus] = await Promise.all([
      fetchGlobalProducts().catch((err) => {
        console.warn("Products", err);
        return [];
      }),
      fetchFeed(),
      checkService("Sanora", `${analyticsState.endpoints.sanora}/products/base`),
      checkService("Covenant", `${analyticsState.endpoints.covenant}/health`),
      checkService("Dolores", `${analyticsState.endpoints.dolores}/canimus/feeds`)
    ]);

    const services = [sanoraStatus, covenantStatus, doloresStatus];
    renderKPIs(products);
    renderBars(products);
    renderTopStores(products);
    renderFeed(feed);
    renderServiceHealth(services);
  } catch (err) {
    console.error("Analytics refresh failed", err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadStoredState();
  refreshAnalytics();
  const buttons = document.querySelectorAll("button");
  buttons.forEach((b) => {
    if (b.textContent && b.textContent.toLowerCase().includes("export")) return;
    b.addEventListener("click", refreshAnalytics);
  });
});
