import { secp256k1 } from "https://esm.sh/ethereum-cryptography/secp256k1";
import { keccak256 } from "https://esm.sh/ethereum-cryptography/keccak.js";
import { utf8ToBytes, bytesToHex, hexToBytes } from "https://esm.sh/ethereum-cryptography/utils.js";

const ENVIRONMENTS = {
  prod: { host: "https://base.thefledge.com" },
  stage: { host: "http://localhost" },
  local: { host: "http://localhost" }
};

const buildEndpoints = (host) => ({
  continuebee: `${host}/2999`,
  bdo: `${host}/3003`,
  sanora: `${host}/7243`,
  addie: `${host}/3005`,
  fount: `${host}/3006`,
  prof: `${host}/3012`
});

const state = {
  env: "prod",
  host: ENVIRONMENTS.prod.host,
  endpoints: buildEndpoints(ENVIRONMENTS.prod.host),
  keys: null,
  uuid: "",
  hash: "",
  sanoraUuid: "",
  addieUuid: "",
  fountUuid: "",
  store: {},
  products: [],
  globalProducts: []
};

const showToast = (message, type = "info") => {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "pointer-events-auto px-3 py-2 rounded-lg text-sm font-semibold shadow-lg border";
  toast.style.color = "#fff";
  toast.style.background =
    type === "error" ? "rgba(239,68,68,0.9)" : type === "success" ? "rgba(34,197,94,0.9)" : "rgba(15,23,42,0.9)";
  toast.style.borderColor = "rgba(255,255,255,0.12)";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-4px)";
    setTimeout(() => toast.remove(), 220);
  }, 2600);
};

const ensureKeys = () => {
  if (!state.keys?.privateKey || !state.keys?.pubKey) throw new Error("Login with your key first.");
};

const saveState = () => {
  try {
    localStorage.setItem(
      "fledge-userflow",
      JSON.stringify({
        env: state.env,
        host: state.host,
        keys: state.keys,
        uuid: state.uuid,
        hash: state.hash,
        sanoraUuid: state.sanoraUuid,
        addieUuid: state.addieUuid,
        fountUuid: state.fountUuid,
        store: state.store
      })
    );
  } catch (err) {
    console.warn("Persist failed", err);
  }
};

const restoreState = () => {
  try {
    const raw = localStorage.getItem("fledge-userflow");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.env = parsed.env || state.env;
    state.host = parsed.host || state.host;
    state.endpoints = buildEndpoints(state.host);
    state.keys = parsed.keys || null;
    state.uuid = parsed.uuid || "";
    state.hash = parsed.hash || "";
    state.sanoraUuid = parsed.sanoraUuid || parsed.uuid || "";
    state.addieUuid = parsed.addieUuid || "";
    state.fountUuid = parsed.fountUuid || "";
    state.store = parsed.store || state.store;
  } catch (err) {
    console.warn("Restore failed", err);
  }
};

const sessionless = {
  async sign(message, privateKey) {
    const privBytes = typeof privateKey === "string" ? hexToBytes(privateKey) : privateKey;
    const messageHash = keccak256(utf8ToBytes(message));
    const sig = secp256k1.sign(messageHash, privBytes);
    return sig.toCompactHex();
  }
};

const fetchJSON = async (url, options) => {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (err) {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }
  return body;
};

const bdoFetch = async () => {
  if (!state.uuid || !state.hash) return null;
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.uuid + state.hash;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const resp = await fetchJSON(
    `${state.endpoints.bdo}/user/${state.uuid}/bdo?timestamp=${timestamp}&hash=${encodeURIComponent(
      state.hash
    )}&signature=${signature}`
  );
  state.store = resp?.bdo?.store || state.store;
  return resp?.bdo || null;
};

const sanoraListMyProducts = async () => {
  ensureKeys();
  const sanoraUuid = state.sanoraUuid || state.uuid;
  if (!sanoraUuid) throw new Error("Missing Sanora UUID");
  return await fetchJSON(`${state.endpoints.sanora}/products/${sanoraUuid}`);
};

const sanoraListGlobal = async () => {
  return await fetchJSON(`${state.endpoints.sanora}/products/base`);
};

const sanoraUpsertProduct = async ({ title, description, price, photoUrl, visibility }) => {
  ensureKeys();
  const sanoraUuid = state.sanoraUuid || state.uuid;
  const timestamp = Date.now().toString();
  const message = timestamp + sanoraUuid + title + description + price;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const isPublic = visibility === "global";
  const payload = {
    title,
    description,
    price,
    timestamp,
    signature,
    photoUrl,
    isPublic,
    visibility,
    storeId: deriveStoreId()
  };
  return await fetchJSON(`${state.endpoints.sanora}/user/${sanoraUuid}/product/${encodeURIComponent(title)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
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
      storeId: p.storeId || ""
    };
  });
};

const deriveStoreId = () => state.store?.referralCode || state.sanoraUuid || state.uuid || state.hash || "";

const buildStoreLink = () => {
  const code = deriveStoreId();
  if (!code) return "";
  const origin = (window?.location?.origin || state.host || "").replace(/\/$/, "");
  return `${origin}/store.html?storeId=${encodeURIComponent(code)}`;
};

const updateIdentityUI = () => {
  document.getElementById("mini-store-id")?.textContent = deriveStoreId() || "-";
  document.getElementById("mini-uuid")?.textContent = state.uuid || "-";
  document.getElementById("mini-sanora")?.textContent = state.sanoraUuid || "-";
  document.getElementById("mini-addie")?.textContent = state.addieUuid || "-";
  const link = buildStoreLink();
  document.getElementById("mini-store-link")?.textContent = link || "-";
};

const renderProducts = (items) => {
  const body = document.getElementById("mini-products-body");
  if (!body) return;
  body.innerHTML = "";
  if (!items || !items.length) {
    body.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="3">No products yet. Add one to see it here.</td></tr>`;
    return;
  }
  items.forEach((p) => {
    const row = document.createElement("tr");
    row.className = "hover:bg-white/5 transition-colors";
    row.innerHTML = `
      <td class="px-6 py-3 text-white font-semibold">${p.title || "(untitled)"}</td>
      <td class="px-6 py-3">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${p.visibility === "global" ? "border-primary text-primary bg-primary/10" : p.visibility === "store" ? "border-amber-400 text-amber-300 bg-amber-400/10" : "border-slate-500 text-slate-200 bg-slate-700/40"}">
          ${p.visibility || "store"}
        </span>
      </td>
      <td class="px-6 py-3 text-right text-white font-bold">$${Number(p.price || 0).toFixed(2)}</td>
    `;
    body.appendChild(row);
  });
};

const updateStats = () => {
  const total = state.products.length;
  const globals = state.globalProducts.filter((p) => (p.visibility || "").toLowerCase() === "global").length;
  const value = state.products.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
  document.getElementById("mini-stat-products")?.textContent = total.toString();
  document.getElementById("mini-stat-global")?.textContent = globals.toString();
  document.getElementById("mini-stat-value")?.textContent = `$${value.toFixed(2)}`;
};

const loadProducts = async () => {
  const tbody = document.getElementById("mini-products-body");
  if (tbody) tbody.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="3">Loading...</td></tr>`;
  const products = normalizeSanoraProducts(await sanoraListMyProducts());
  state.products = products;
  const globals = normalizeSanoraProducts(await sanoraListGlobal()).filter((p) => {
    const vis = (p.visibility || (p.isPublic ? "global" : "store")).toLowerCase();
    return vis === "global";
  });
  state.globalProducts = globals;
  renderProducts(products);
  updateStats();
  showToast("Store products refreshed", "success");
};

const handleQuickAdd = async () => {
  try {
    ensureKeys();
    const title = document.getElementById("mini-add-title")?.value.trim();
    const description = document.getElementById("mini-add-desc")?.value.trim();
    const price = document.getElementById("mini-add-price")?.value.trim() || "0";
    const photoUrl = document.getElementById("mini-add-photo")?.value.trim();
    const visibility = document.getElementById("mini-add-vis")?.value || "global";
    if (!title || !description) throw new Error("Title and description required");
    if (isNaN(parseFloat(price))) throw new Error("Price must be numeric");
    await sanoraUpsertProduct({ title, description, price, photoUrl, visibility });
    showToast("Product published", "success");
    document.getElementById("mini-add-title").value = "";
    document.getElementById("mini-add-desc").value = "";
    document.getElementById("mini-add-price").value = "";
    document.getElementById("mini-add-photo").value = "";
    await loadProducts();
  } catch (err) {
    showToast(err.message || "Save failed", "error");
  }
};

const handleLoginWithKey = async () => {
  try {
    const existingPriv = state.keys?.privateKey;
    const priv = existingPriv || prompt("Paste your sessionless private key");
    if (!priv) throw new Error("Private key required");
    const uuid = state.uuid || prompt("Enter your UUID");
    const hash = state.hash || prompt("Enter your hash (used for BDO)");
    if (!uuid || !hash) throw new Error("UUID and hash required");
    const privBytes = hexToBytes(priv);
    const pubKey = bytesToHex(secp256k1.getPublicKey(privBytes));
    state.keys = { privateKey: priv, pubKey };
    state.uuid = uuid;
    state.hash = hash;
    // Touch Sanora to ensure the user exists
    await sanoraListMyProducts().catch(() => {});
    await bdoFetch().catch(() => {});
    saveState();
    updateIdentityUI();
    showToast("Key loaded", "success");
  } catch (err) {
    showToast(err.message || "Login failed", "error");
  }
};

const handleCopyLink = async () => {
  const link = buildStoreLink();
  if (!link) return;
  await navigator.clipboard?.writeText(link);
  showToast("Store link copied", "success");
};

const handleRefreshAll = async () => {
  await bdoFetch().catch(() => {});
  updateIdentityUI();
  await loadProducts().catch((err) => {
    console.error(err);
    showToast("Product load failed", "error");
  });
};

window.addEventListener("DOMContentLoaded", () => {
  restoreState();
  updateIdentityUI();
  document.getElementById("mini-copy-link")?.addEventListener("click", handleCopyLink);
  document.getElementById("mini-refresh")?.addEventListener("click", handleRefreshAll);
  document.getElementById("mini-refresh-products")?.addEventListener("click", handleRefreshAll);
  document.getElementById("mini-add-save")?.addEventListener("click", handleQuickAdd);
  document.getElementById("mini-login-key")?.addEventListener("click", handleLoginWithKey);
  handleRefreshAll();
});
