// admin-analytics.js
// Live wiring for global analytics plus nineum ownership panel
import { secp256k1 } from "https://esm.sh/ethereum-cryptography/secp256k1";
import { keccak256 } from "https://esm.sh/ethereum-cryptography/keccak.js";
import { utf8ToBytes, hexToBytes } from "https://esm.sh/ethereum-cryptography/utils.js";

const ENVIRONMENTS = {
  prod: { host: "https://base.thefledge.com" },
  stage: { host: "http://localhost" },
  local: { host: "http://localhost" }
};

const buildEndpoints = (host) => ({
  sanora: `${host}/7243`,
  dolores: `${host}/3007`,
  covenant: `${host}/3011`,
  fount: `${host}/3006`
});

const state = {
  host: ENVIRONMENTS.prod.host,
  endpoints: buildEndpoints(ENVIRONMENTS.prod.host),
  store: {},
  profile: {},
  uuid: "",
  sanoraUuid: "",
  keys: null,
  fountUuid: "",
  nineum: []
};

const loadStoredState = () => {
  try {
    const raw = localStorage.getItem("fledge-userflow");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.host = parsed.host || state.host;
    state.endpoints = buildEndpoints(state.host);
    state.store = parsed.store || {};
    state.profile = parsed.profile || {};
    state.uuid = parsed.uuid || "";
    state.sanoraUuid = parsed.sanoraUuid || "";
    state.keys = parsed.keys || null;
    state.fountUuid = parsed.fountUuid || "";
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

const sign = async (message, privHex) => {
  const msgHash = keccak256(utf8ToBytes(message));
  const sig = secp256k1.sign(msgHash, hexToBytes(privHex));
  return sig.toCompactHex();
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
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

const fetchGlobalProducts = async () => {
  const data = await fetchJSON(`${state.endpoints.sanora}/products/base`);
  return normalizeSanoraProducts(data);
};

const fetchFeed = async () => {
  try {
    const data = await fetchJSON(`${state.endpoints.dolores}/canimus/feeds`);
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

const renderKPIs = (products) => {
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
    bar.innerHTML = `<div class="w-full bg-gradient-to-t ${classes[idx] || classes[0]} rounded-t-sm" style="height:${height}%;"></div>`;
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
  const grouped = aggregateStores(products);
  const rows = grouped
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

const renderMiniStores = (products) => {
  const wrap = document.getElementById("mini-store-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!products.length) {
    wrap.innerHTML = `<div class="text-slate-400 text-sm">No mini-stores yet.</div>`;
    return;
  }
  const stores = aggregateStores(products).slice(0, 9);
  stores.forEach((s) => {
    const card = document.createElement("div");
    card.className = "p-4 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors";
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="size-8 rounded bg-gradient-to-br from-primary to-accent-orange flex items-center justify-center text-white font-bold text-xs">${s.id
            .slice(0, 2)
            .toUpperCase()}</div>
          <div class="flex flex-col">
            <span class="text-white text-sm font-semibold">${s.id}</span>
            <span class="text-xs text-slate-400">${s.products} products</span>
          </div>
        </div>
        <span class="text-xs font-mono text-slate-400">$${s.volume.toFixed(2)}</span>
      </div>
      <div class="text-xs text-slate-400 truncate">Top item: ${s.sampleTitle}</div>
    `;
    wrap.appendChild(card);
  });
};

const renderInventory = (products) => {
  const body = document.getElementById("global-inventory-body");
  if (!body) return;
  body.innerHTML = "";
  if (!products.length) {
    body.innerHTML = `<tr><td class="p-4 text-slate-500" colspan="4">No inventory.</td></tr>`;
    return;
  }
  products.slice(0, 50).forEach((p) => {
    const tr = document.createElement("tr");
    tr.className = "group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";
    const vis = p.visibility || (p.isPublic ? "global" : "store");
    tr.innerHTML = `
      <td class="px-4 py-3 text-white">${p.title || "(untitled)"}</td>
      <td class="px-4 py-3 hidden sm:table-cell font-mono text-slate-400 text-xs">${p.storeId || "global"}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
          vis === "global" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-500/10 text-slate-200"
        }">${vis === "global" ? "Global" : "Store"}</span>
      </td>
      <td class="px-4 py-3 text-right text-white font-semibold">$${(parseFloat(p.price || 0) || 0).toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });
};

const renderUsers = (products) => {
  const body = document.getElementById("users-body");
  if (!body) return;
  body.innerHTML = "";
  if (!products.length) {
    body.innerHTML = `<tr><td class="p-4 text-slate-500" colspan="3">No users found.</td></tr>`;
    return;
  }
  const rows = aggregateStores(products)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 20);
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";
    tr.innerHTML = `
      <td class="px-4 py-3 flex items-center gap-2">
        <div class="size-8 rounded bg-gradient-to-br from-primary to-accent-orange flex items-center justify-center text-white font-bold text-xs">${row.id
          .slice(0, 2)
          .toUpperCase()}</div>
        <div class="flex flex-col">
          <span class="text-white text-sm font-semibold">${row.id}</span>
          <span class="text-xs text-slate-400">${row.products} products</span>
        </div>
      </td>
      <td class="px-4 py-3 text-slate-300">${row.products}</td>
      <td class="px-4 py-3 text-right text-white font-semibold">$${row.volume.toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });
};

const renderSecurity = () => {
  setText("sec-uuid", state.uuid || "-");
  setText("sec-pubkey", state.keys?.pubKey || "-");
  setText("sec-privkey", state.keys?.privateKey ? "Loaded locally" : "-");
  const { hasGalactic, hasAdmin } = computePermissions(state.nineum);
  const badge = document.getElementById("sec-nuneum-badge");
  const status = hasGalactic ? "Galactic" : hasAdmin ? "Admin" : "Limited";
  if (badge) {
    badge.textContent = status;
    badge.className = `inline-flex items-center px-2 py-1 rounded text-[11px] ${
      hasGalactic
        ? "bg-emerald-500/20 text-emerald-200"
        : hasAdmin
        ? "bg-blue-500/20 text-blue-200"
        : "bg-slate-700 text-slate-200"
    }`;
  }
  setText("sec-nuneum-status", `Nineum: ${status}`);
  setText("sec-fount-user", `Fount user: ${state.fountUuid || "unknown"}`);
};

const aggregateStores = (products) => {
  const grouped = products.reduce((acc, p) => {
    const id = p.storeId || "global";
    if (!acc[id]) acc[id] = { id, products: 0, volume: 0, sampleTitle: p.title || "-" };
    acc[id].products += 1;
    acc[id].volume += parseFloat(p.price || 0) || 0;
    if (p.title) acc[id].sampleTitle = p.title;
    return acc;
  }, {});
  return Object.values(grouped);
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
  ["service-health", "service-health-footer"].forEach((id) => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.innerHTML = "";
    services.forEach((s) => {
      const row = document.createElement("div");
      row.className =
        "flex items-center justify-between p-3 rounded-lg border " +
        (s.status === "up"
          ? "border-green-500/20 bg-green-500/5"
          : s.status === "unknown"
          ? "border-slate-500/20 bg-slate-800/40"
          : "border-red-500/20 bg-red-500/5");
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-sm ${s.status === "up" ? "text-green-300" : s.status === "unknown" ? "text-slate-300" : "text-red-300"}">${
        s.status === "up" ? "check_circle" : s.status === "unknown" ? "help" : "error"
      }</span>
          <span class="text-white text-sm font-semibold">${s.name}</span>
        </div>
        <span class="text-xs text-slate-300">${s.detail}</span>
      `;
      wrap.appendChild(row);
    });
  });
};

// Nineum helpers
const renderNineum = () => {
  setText("nineum-uuid", state.uuid || "-");
  const wrap = document.getElementById("nineum-list");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!state.nineum.length) {
    wrap.innerHTML = `<p class="text-slate-500">No nineum yet.</p>`;
    setText("nineum-perm-badge", "Limited");
    setText("nineum-galactic", "No");
    setText("nineum-admin", "No");
    return;
  }
  const { hasGalactic, hasAdmin } = computePermissions(state.nineum);
  setText("nineum-perm-badge", hasGalactic ? "Galactic" : hasAdmin ? "Admin" : "Limited");
  setText("nineum-galactic", hasGalactic ? "Yes" : "No");
  setText("nineum-admin", hasAdmin ? "Yes" : "No");
  state.nineum.forEach((n) => {
    const d = document.createElement("div");
    d.textContent = n;
    wrap.appendChild(d);
  });
};

const computePermissions = (list = []) => {
  let hasGalactic = false;
  let hasAdmin = false;
  list.forEach((n) => {
    if (typeof n !== "string" || n.length < 16) return;
    const perm = n.substring(14, 16).toLowerCase();
    if (perm === "ff") hasGalactic = true;
    if (perm === "fe" || perm === "ff") hasAdmin = true;
  });
  return { hasGalactic, hasAdmin };
};

const refreshNineum = async () => {
  if (!state.uuid || !state.keys?.privateKey) {
    alert("Login/mint first to load nineum.");
    return;
  }
  await ensureFountUser();
  const targetUuid = state.fountUuid || state.uuid;
  const ts = Date.now().toString();
  const message = ts + targetUuid;
  const signature = await sign(message, state.keys.privateKey);
  const nineum = await fetchJSON(
    `${state.endpoints.fount}/user/${targetUuid}/nineum?timestamp=${ts}&signature=${signature}`
  );
  state.nineum = nineum.nineum || [];
  renderNineum();
};

const claimGalactic = async () => {
  if (!state.uuid || !state.keys?.privateKey) {
    alert("Login/mint first.");
    return;
  }
  await ensureFountUser();
  const targetUuid = state.fountUuid || state.uuid;
  const galaxy = document.getElementById("galaxy-input")?.value?.trim() || "";
  if (!galaxy) {
    alert("Enter a galaxy code.");
    return;
  }
  const ts = Date.now().toString();
  const message = ts + targetUuid + galaxy;
  const signature = await sign(message, state.keys.privateKey);
  await fetchJSON(`${state.endpoints.fount}/user/${targetUuid}/nineum/galactic`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp: ts, galaxy, signature })
  });
  alert("Galactic nineum claimed. Refreshing.");
  await refreshNineum();
};

const grantAdminNineum = async () => {
  if (!state.uuid || !state.keys?.privateKey) {
    alert("Login/mint first.");
    return;
  }
  await ensureFountUser();
  const targetUuid = state.fountUuid || state.uuid;
  const { hasGalactic } = computePermissions(state.nineum);
  if (!hasGalactic) {
    alert("Galactic nineum required to grant admin.");
    return;
  }
  const toUuid = document.getElementById("grant-admin-uuid")?.value?.trim();
  if (!toUuid) {
    alert("Enter destination UUID.");
    return;
  }
  const ts = Date.now().toString();
  const message = ts + targetUuid;
  const signature = await sign(message, state.keys.privateKey);
  await fetchJSON(`${state.endpoints.fount}/user/${targetUuid}/nineum/admin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp: ts, toUserUUID: toUuid, signature })
  });
  alert("Admin nineum granted.");
  await refreshNineum();
};

const ensureFountUser = async () => {
  if (state.fountUuid) return state.fountUuid;
  if (!state.keys?.pubKey || !state.keys?.privateKey) throw new Error("Keys required to create Fount user.");
  const ts = Date.now().toString();
  const message = ts + state.keys.pubKey;
  const signature = await sign(message, state.keys.privateKey);
  const user = await fetchJSON(`${state.endpoints.fount}/user/create`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp: ts, pubKey: state.keys.pubKey, signature })
  });
  state.fountUuid = user.uuid || user.userUUID || state.fountUuid;
  return state.fountUuid;
};

const refreshAnalytics = async () => {
  try {
    const [products, feed, sanoraStatus, doloresStatus] = await Promise.all([
      fetchGlobalProducts().catch((err) => {
        console.warn("Products", err);
        return [];
      }),
      fetchFeed(),
      checkService("Sanora", `${state.endpoints.sanora}/products/base`),
      checkService("Dolores", `${state.endpoints.dolores}/canimus/feeds`)
    ]);

    // Covenant health endpoint is blocked by CORS from Vercel; mark as unknown without calling it.
    const covenantStatus = { name: "Covenant", status: "unknown", detail: "Health check disabled (CORS)" };
    const services = [sanoraStatus, covenantStatus, doloresStatus];
    renderKPIs(products);
    renderBars(products);
    renderTopStores(products);
    renderMiniStores(products);
    renderInventory(products);
    renderUsers(products);
    renderFeed(feed);
    renderServiceHealth(services);
    renderSecurity();
  } catch (err) {
    console.error("Analytics refresh failed", err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadStoredState();
  renderNineum();
  renderSecurity();
  refreshAnalytics();
  document.getElementById("btn-refresh-nineum")?.addEventListener("click", refreshNineum);
  document.getElementById("btn-claim-galactic")?.addEventListener("click", claimGalactic);
  document.getElementById("btn-grant-admin")?.addEventListener("click", grantAdminNineum);
});
