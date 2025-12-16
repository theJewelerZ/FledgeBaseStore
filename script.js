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
  prof: `${host}/3012`,
  aretha: `${host}/7277`,
  covenant: `${host}/3011`
});

const state = {
  env: "prod",
  host: ENVIRONMENTS.prod.host,
  endpoints: buildEndpoints(ENVIRONMENTS.prod.host),
  keys: null,
  uuid: "",
  hash: "",
  emojicode: "",
  sanoraUuid: "",
  addieUuid: "",
  fountUuid: "",
  covenantUuid: "",
  arethaUuid: "",
  profile: {},
  store: {},
  bdo: {},
  products: [],
  globalProducts: []
};

const SEED_PRODUCTS = [
  {
    title: "BizBuz Digital Card",
    description: "Privacy-first digital business card with QR and vCard export.",
    price: "0",
    photoUrl: "https://dummyimage.com/600x400/111827/ffffff&text=BizBuz",
    visibility: "global"
  },
  {
    title: "LinkityLink",
    description: "Link-in-bio style hub powered by Allyabase.",
    price: "0",
    photoUrl: "https://dummyimage.com/600x400/0f172a/ffffff&text=LinkityLink",
    visibility: "global"
  },
  {
    title: "nineandfour",
    description: "Dev tools suite for teams.",
    price: "0",
    photoUrl: "https://dummyimage.com/600x400/1f2937/ffffff&text=nineandfour",
    visibility: "global"
  }
];

const sessionless = {
  async generateKeys() {
    const priv = secp256k1.utils.randomPrivateKey();
    const pub = secp256k1.getPublicKey(priv);
    return { privateKey: bytesToHex(priv), pubKey: bytesToHex(pub) };
  },
  async sign(message, privateKey) {
    const privBytes = typeof privateKey === "string" ? hexToBytes(privateKey) : privateKey;
    const messageHash = keccak256(utf8ToBytes(message));
    const sig = secp256k1.sign(messageHash, privBytes);
    return sig.toCompactHex();
  }
};

const log = (msg) => {
  const el = document.getElementById("log");
  const t = new Date().toLocaleTimeString();
  if (el) el.textContent = `[${t}] ${msg}\n` + el.textContent;
  console.log(msg);
};

const showToast = (message, type = "info") => {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.style.pointerEvents = "auto";
  toast.style.padding = "10px 12px";
  toast.style.borderRadius = "10px";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "700";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,0.25)";
  toast.style.border = "1px solid rgba(255,255,255,0.1)";
  toast.style.color = "#fff";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "8px";
  if (type === "error") {
    toast.style.background = "rgba(239,68,68,0.9)";
  } else if (type === "success") {
    toast.style.background = "rgba(34,197,94,0.9)";
  } else {
    toast.style.background = "rgba(15,23,42,0.9)";
  }
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => toast.remove(), 250);
  }, 2800);
};

const setInput = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
};

const getInputValue = (id) => {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
};

const bindCopyButtons = () => {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.dataset.copy;
      const src = targetId ? document.getElementById(targetId) : null;
      const text = src?.textContent?.trim();
      if (!text) {
        showToast("Nothing to copy", "error");
        return;
      }
      try {
        await navigator.clipboard?.writeText(text);
        const label = btn.getAttribute("aria-label") || "Value";
        showToast(`${label.replace("Copy ", "")} copied`, "success");
      } catch (err) {
        showToast("Copy failed", "error");
      }
    });
  });
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
        emojicode: state.emojicode,
        sanoraUuid: state.sanoraUuid,
        addieUuid: state.addieUuid,
        fountUuid: state.fountUuid,
        covenantUuid: state.covenantUuid,
        arethaUuid: state.arethaUuid,
        profile: state.profile,
        store: state.store
      })
    );
  } catch (err) {
    console.warn("Persist failed", err);
  }
};

const restoreState = () => {
  try {
    const data = localStorage.getItem("fledge-userflow");
    if (!data) return;
    const parsed = JSON.parse(data);
    state.env = parsed.env || state.env;
    state.host = parsed.host || state.host;
    state.endpoints = buildEndpoints(state.host);
    state.keys = parsed.keys || null;
    state.uuid = parsed.uuid || "";
    state.hash = parsed.hash || "";
    state.emojicode = parsed.emojicode || "";
    state.sanoraUuid = parsed.sanoraUuid || "";
    state.addieUuid = parsed.addieUuid || "";
    state.fountUuid = parsed.fountUuid || "";
    state.covenantUuid = parsed.covenantUuid || "";
    state.arethaUuid = parsed.arethaUuid || "";
    state.profile = parsed.profile || {};
    state.store = parsed.store || {};

    const envSelect = document.getElementById("env-select");
    if (envSelect) envSelect.value = state.env;
    if (state.keys) {
      setInput("pubkey-display", state.keys.pubKey);
      setInput("privkey-display", state.keys.privateKey);
      setInput("login-priv", state.keys.privateKey);
    }
    if (state.uuid) setInput("login-uuid", state.uuid);
    if (state.hash) setInput("hash-input", state.hash);
    if (state.profile) setProfileForm(state.profile);
    if (state.store) setStoreForm(state.store);
    updateSessionView();
  } catch (err) {
    console.warn("Restore failed", err);
  }
};

const updateSessionView = () => {
  setText("session-uuid", state.uuid || "-");
  setText("session-emoji", state.emojicode || "-");
  setText("session-hash", state.hash || "-");
  const mintBtn = document.getElementById("btn-mint");
  if (mintBtn) mintBtn.disabled = !state.keys;
  const visit = document.getElementById("btn-visit-store");
  if (visit) visit.disabled = !resolveStoreLink(state.store);
};

const randHash = () => `hash-${Math.random().toString(16).slice(2, 8)}`;

const ensureKeys = () => {
  if (!state.keys || !state.keys.privateKey || !state.keys.pubKey) {
    throw new Error("Generate or load keys first.");
  }
};

const fetchJSON = async (url, options) => {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || res.statusText;
    throw new Error(`${res.status}: ${msg}`);
  }
  log(`HTTP ${res.status} ${url} ${text ? "-> " + text.slice(0, 120) : ""}`);
  return body;
};

const continuebeeCreate = async (hash) => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.keys.pubKey + hash;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const payload = { timestamp, pubKey: state.keys.pubKey, hash, signature };
  return await fetchJSON(`${state.endpoints.continuebee}/user/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};

const continuebeeVerify = async (uuid, hash) => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + uuid + hash;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  return await fetchJSON(
    `${state.endpoints.continuebee}/user/${uuid}?timestamp=${timestamp}&hash=${encodeURIComponent(hash)}&signature=${signature}`
  );
};

const bdoCreate = async (hash) => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.keys.pubKey + hash;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const payload = { timestamp, pubKey: state.keys.pubKey, hash, bdo: {}, public: true, signature };
  return await fetchJSON(`${state.endpoints.bdo}/user/create`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};

const bdoFetch = async (uuid, hash) => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + uuid + hash;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  return await fetchJSON(
    `${state.endpoints.bdo}/user/${uuid}/bdo?timestamp=${timestamp}&hash=${encodeURIComponent(hash)}&signature=${signature}`
  );
};

const bdoUpdate = async (uuid, hash, bdoData) => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + uuid + hash;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const payload = {
    timestamp,
    hash,
    bdo: bdoData,
    public: true,
    pubKey: state.keys.pubKey,
    signature
  };
  return await fetchJSON(`${state.endpoints.bdo}/user/${uuid}/bdo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};

const bdoDelete = async (uuid, hash) => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + uuid + hash;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const payload = { timestamp, uuid, hash, signature };
  return await fetchJSON(`${state.endpoints.bdo}/user/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};

const sanoraCreateUser = async () => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.keys.pubKey;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const user = await fetchJSON(`${state.endpoints.sanora}/user/create`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, pubKey: state.keys.pubKey, signature })
  });
  state.sanoraUuid = user.uuid || user.userUUID || state.sanoraUuid;
  return user;
};

const addieCreateUser = async () => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.keys.pubKey;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const user = await fetchJSON(`${state.endpoints.addie}/user/create`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, pubKey: state.keys.pubKey, signature })
  });
  state.addieUuid = user.uuid || user.userUUID || state.addieUuid;
  saveState();
  return user;
};

const fountCreateUser = async () => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.keys.pubKey;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const user = await fetchJSON(`${state.endpoints.fount}/user/create`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, pubKey: state.keys.pubKey, signature })
  });
  state.fountUuid = user.uuid || user.userUUID || state.fountUuid;
  saveState();
  return user;
};

const covenantCreateUser = async () => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.keys.pubKey;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const user = await fetchJSON(`${state.endpoints.covenant}/user/create`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, pubKey: state.keys.pubKey, signature })
  });
  state.covenantUuid = user.uuid || user.userUUID || state.covenantUuid;
  saveState();
  return user;
};

const arethaCreateUser = async () => {
  ensureKeys();
  const timestamp = Date.now().toString();
  const message = timestamp + state.keys.pubKey;
  const signature = await sessionless.sign(message, state.keys.privateKey);
  const user = await fetchJSON(`${state.endpoints.aretha}/user/create`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, pubKey: state.keys.pubKey, signature })
  });
  state.arethaUuid = user.uuid || user.userUUID || state.arethaUuid;
  saveState();
  return user;
};

const sanoraUpsertProduct = async ({ title, description, price, photoUrl, visibility }) => {
  ensureKeys();
  const sanoraUuid = state.sanoraUuid || state.uuid;
  if (!sanoraUuid) throw new Error("Need UUID for Sanora");
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
    visibility: visibility || (isPublic ? "global" : "store"),
    storeId: state.store?.referralCode || state.sanoraUuid || state.uuid
  };
  return await fetchJSON(`${state.endpoints.sanora}/user/${sanoraUuid}/product/${encodeURIComponent(title)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};

const sanoraListMyProducts = async () => {
  ensureKeys();
  const sanoraUuid = state.sanoraUuid || state.uuid;
  if (!sanoraUuid) throw new Error("Need UUID for Sanora");
  return await fetchJSON(`${state.endpoints.sanora}/products/${sanoraUuid}`);
};

const sanoraListGlobal = async () => {
  return await fetchJSON(`${state.endpoints.sanora}/products/base`);
};

const setProfileForm = (profile = {}) => {
  setInput("profile-name", profile.displayName || profile.name || "");
  setInput("profile-email", profile.email || "");
  const bio = document.getElementById("profile-bio");
  if (bio) bio.value = profile.bio || "";
};

const getProfileForm = () => ({
  displayName: getInputValue("profile-name"),
  email: getInputValue("profile-email"),
  bio: document.getElementById("profile-bio")?.value.trim() || ""
});

const deriveStoreId = () => state.store?.referralCode || state.sanoraUuid || state.uuid || state.emojicode || "";

const buildStoreLink = () => {
  const code = deriveStoreId();
  if (!code) return "";
  const origin = (window?.location?.origin || state.host || "").replace(/\/$/, "");
  return `${origin}/store.html?storeId=${encodeURIComponent(code)}`;
};

const resolveStoreLink = (store = {}) => {
  if (store?.referralLink) return store.referralLink;
  return buildStoreLink();
};

const setStoreForm = (store = {}) => {
  setInput("store-name", store.name || "");
  const pubEl = document.getElementById("store-public");
  if (pubEl) pubEl.value = (store.isPublic ?? true).toString();
  setText("store-link", resolveStoreLink(store) || "-");
  setText("store-code", store.referralCode || deriveStoreId() || "-");
  const visitBtn = document.getElementById("btn-visit-store");
  const heroVisit = document.getElementById("btn-hero-visit");
  const link = resolveStoreLink(store);
  if (visitBtn) {
    visitBtn.disabled = !link;
    visitBtn.dataset.href = link || "";
  }
  if (heroVisit) {
    heroVisit.disabled = !link;
    heroVisit.dataset.href = link || "";
  }
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

const renderProductList = (targetId, items) => {
  const ul = document.getElementById(targetId);
  if (!ul) return;
  ul.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No products.";
    ul.appendChild(li);
    return;
  }
  items.forEach((p) => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    const vis = p.visibility || (p.isPublic ? "global" : "store");
    left.innerHTML = `<span class="title">${p.title || "(untitled)"}</span>
      <div class="meta">${p.price || 0} USD · ${vis}</div>
      <div class="meta">storeId: ${p.storeId || "-"} | productId: ${p.productId || p.id || "-"}</div>`;
    li.appendChild(left);
    ul.appendChild(li);
  });
};

const renderProductGrid = (targetId, items) => {
  const container = document.getElementById(targetId);
  if (!container) return;
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "No products yet. Save one to see it here.";
    container.appendChild(empty);
    return;
  }
  items.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    if (p.photoUrl) {
      const img = document.createElement("img");
      img.src = p.photoUrl;
      img.alt = p.title || "product";
      card.appendChild(img);
    }
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = p.title || "(untitled)";
    card.appendChild(title);

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.textContent = p.description || "No description yet.";
    card.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "meta";
    const price = document.createElement("span");
    price.className = "pill";
    price.textContent = `${p.price || 0} USD`;
    meta.appendChild(price);
    const vis = document.createElement("span");
    vis.className = "pill";
    const visVal = p.visibility || (p.isPublic ? "global" : "store");
    vis.textContent = visVal === "private" ? "Private" : visVal === "global" ? "Global" : "Store only";
    meta.appendChild(vis);
    const store = document.createElement("span");
    store.className = "pill";
    store.textContent = `Store: ${p.storeId || "-"}`;
    meta.appendChild(store);
    card.appendChild(meta);

    container.appendChild(card);
  });
};

const handleLoadMyProducts = async () => {
  try {
    const products = await sanoraListMyProducts();
    state.products = normalizeSanoraProducts(products);
    renderProductGrid("product-grid", state.products);
    showToast("My products refreshed", "success");
    log("Loaded my products");
  } catch (err) {
    showToast("Load my products failed", "error");
    log(`Load my products failed: ${err.message}`);
  }
};

const handleLoadGlobal = async () => {
  try {
    const products = await sanoraListGlobal();
    state.globalProducts = normalizeSanoraProducts(products).filter((p) => {
      const vis = p.visibility || (p.isPublic ? "global" : "store");
      return vis === "global";
    });
    renderProductGrid("global-grid", state.globalProducts);
    showToast("Global products refreshed", "success");
    log("Loaded global products");
  } catch (err) {
    showToast("Load global failed", "error");
    log(`Load global failed: ${err.message}`);
  }
};

const handleSaveProduct = async () => {
  try {
    if (!state.uuid) throw new Error("Mint or login first");
    const title = getInputValue("product-title");
    const description = document.getElementById("product-description")?.value || "";
    const price = getInputValue("product-price") || "0";
    const photoUrl = getInputValue("product-photo");
    const visibility = document.getElementById("product-public")?.value || "global";
    if (!title || !description) {
      showToast("Title and description required", "error");
      throw new Error("Title and description required");
    }
    if (isNaN(parseFloat(price))) {
      showToast("Price must be a number", "error");
      throw new Error("Price must be a number");
    }
    await sanoraUpsertProduct({ title, description, price, photoUrl, visibility });
    await handleLoadMyProducts();
    await handleLoadGlobal();
    showToast("Product saved", "success");
    log("Product saved");
  } catch (err) {
    showToast(err.message || "Save failed", "error");
    log(`Save product failed: ${err.message}`);
  }
};

const handleGenerateKeys = async () => {
  const keys = await sessionless.generateKeys();
  state.keys = keys;
  setInput("pubkey-display", keys.pubKey);
  setInput("privkey-display", keys.privateKey);
  setInput("login-priv", keys.privateKey);
  updateSessionView();
  saveState();
  showToast("Generated sessionless keypair", "success");
  log("Generated Sessionless keypair");
};

const handleMint = async () => {
  try {
    ensureKeys();
    const hash = getInputValue("hash-input") || randHash();
    state.hash = hash;
    setInput("hash-input", hash);

    // Collect profile and store data up front
    const profile = getProfileForm();
    if (!profile.displayName) {
      showToast("Add a display name before minting", "error");
      throw new Error("Profile name required");
    }
    const referralCode = state.store.referralCode || Math.random().toString(16).slice(2, 8);
    const isPublicStore = (document.getElementById("store-public")?.value || "true") === "true";
    const store = {
      name: getInputValue("store-name") || "My Fledge Store",
      isPublic: isPublicStore,
      referralCode,
      referralLink: buildStoreLink()
    };

    // Create UUIDs across services
    const cont = await continuebeeCreate(hash);
    const bdoResp = await bdoCreate(hash);
    const sanoraUser = await sanoraCreateUser();
    const addieUser = await addieCreateUser().catch((err) => {
      log(`Addie user creation skipped: ${err.message}`);
      return null;
    });
    const fountUser = await fountCreateUser().catch((err) => {
      log(`Fount user creation skipped: ${err.message}`);
      return null;
    });
    const covenantUser = await covenantCreateUser().catch((err) => {
      log(`Covenant create skipped: ${err.message}`);
      return null;
    });
    const arethaUser = await arethaCreateUser().catch((err) => {
      log(`Aretha create skipped: ${err.message}`);
      return null;
    });
    state.uuid = bdoResp.uuid || cont.userUUID || cont.uuid || "";
    state.sanoraUuid = sanoraUser.uuid || sanoraUser.userUUID || state.uuid;
    state.emojicode = bdoResp.emojiShortcode || state.emojicode;
    state.addieUuid = addieUser?.uuid || addieUser?.userUUID || state.addieUuid;
    state.fountUuid = fountUser?.uuid || fountUser?.userUUID || state.fountUuid;
    state.covenantUuid = covenantUser?.uuid || covenantUser?.userUUID || state.covenantUuid;
    state.arethaUuid = arethaUser?.uuid || arethaUser?.userUUID || state.arethaUuid;
    setInput("login-uuid", state.uuid);

    // Save full profile+store to BDO in one shot
    const combinedBdo = {
      profile,
      store,
      ids: {
        uuid: state.uuid,
        sanoraUuid: state.sanoraUuid,
        addieUuid: state.addieUuid,
        fountUuid: state.fountUuid,
        covenantUuid: state.covenantUuid,
        arethaUuid: state.arethaUuid,
        emojicode: state.emojicode
      }
    };
    const updated = await bdoUpdate(state.uuid, state.hash, combinedBdo);
    state.bdo = updated.bdo || combinedBdo;
    state.profile = state.bdo.profile || profile;
    state.store = state.bdo.store || store;
    setProfileForm(state.profile);
    setStoreForm(state.store);

    await handleLoadMyProducts();
    await handleLoadGlobal();
    updateSessionView();
    saveState();
    showToast("Minted user and saved profile/store", "success");
    log(`Minted user ${state.uuid}`);
  } catch (err) {
    showToast(err.message || "Mint failed", "error");
    log(`Mint failed: ${err.message}`);
  }
};

const handleLogin = async () => {
  try {
    const uuid = getInputValue("login-uuid") || state.uuid;
    const priv = getInputValue("login-priv") || state.keys?.privateKey;
    const hash = getInputValue("hash-input") || state.hash;
    if (!uuid || !priv || !hash) throw new Error("UUID, hash, and private key required");
    const privBytes = hexToBytes(priv);
    const pubKey = bytesToHex(secp256k1.getPublicKey(privBytes));
    state.keys = { pubKey, privateKey: priv };
    state.uuid = uuid;
    state.hash = hash;
    await continuebeeVerify(uuid, hash);
    const sanoraUser = await sanoraCreateUser();
    state.sanoraUuid = sanoraUser.uuid || sanoraUser.userUUID || state.sanoraUuid || uuid;
    const addieUser = await addieCreateUser().catch((err) => {
      log(`Addie user creation skipped: ${err.message}`);
      return null;
    });
    state.addieUuid = addieUser?.uuid || addieUser?.userUUID || state.addieUuid;
    const fountUser = await fountCreateUser().catch((err) => {
      log(`Fount user creation skipped: ${err.message}`);
      return null;
    });
    state.fountUuid = fountUser?.uuid || fountUser?.userUUID || state.fountUuid;
    const covenantUser = await covenantCreateUser().catch((err) => {
      log(`Covenant create skipped: ${err.message}`);
      return null;
    });
    const arethaUser = await arethaCreateUser().catch((err) => {
      log(`Aretha create skipped: ${err.message}`);
      return null;
    });
    state.covenantUuid = covenantUser?.uuid || covenantUser?.userUUID || state.covenantUuid;
    state.arethaUuid = arethaUser?.uuid || arethaUser?.userUUID || state.arethaUuid;
    await handleProfileLoad();
    await handleStoreLoad();
    await handleLoadMyProducts();
    await handleLoadGlobal();
    updateSessionView();
    saveState();
    showToast("Logged in and synced data", "success");
    log(`Logged in as ${uuid}`);
  } catch (err) {
    showToast(err.message || "Login failed", "error");
    log(`Login failed: ${err.message}`);
  }
};

const handleLogout = () => {
  state.uuid = "";
  state.hash = "";
  state.emojicode = "";
  state.keys = null;
  state.profile = {};
  state.store = {};
  setInput("hash-input", "");
  setInput("login-uuid", "");
  setInput("login-priv", "");
  setInput("pubkey-display", "");
  setInput("privkey-display", "");
  setStoreForm({});
  setProfileForm({});
  updateSessionView();
  saveState();
  log("Logged out");
};

const handleProfileLoad = async () => {
  if (!state.uuid || !state.hash) return;
  try {
    const resp = await bdoFetch(state.uuid, state.hash);
    state.bdo = resp.bdo || {};
    state.profile = state.bdo.profile || {};
    state.store = state.bdo.store || state.store;
    setProfileForm(state.profile);
    setStoreForm(state.store);
    saveState();
    log("Loaded profile from BDO");
  } catch (err) {
    log(`Load profile failed: ${err.message}`);
  }
};

const handleProfileSave = async () => {
  try {
    if (!state.uuid || !state.hash) throw new Error("Mint or login first");
    const base = state.bdo || (await bdoFetch(state.uuid, state.hash)).bdo || {};
    const nextProfile = getProfileForm();
    if (!nextProfile.displayName) {
      showToast("Profile name required", "error");
      throw new Error("Profile name required");
    }
    if (nextProfile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextProfile.email)) {
      showToast("Enter a valid email", "error");
      throw new Error("Email invalid");
    }
    const next = {
      ...base,
      profile: nextProfile,
      ids: {
        uuid: state.uuid,
        sanoraUuid: state.sanoraUuid,
        addieUuid: state.addieUuid,
        fountUuid: state.fountUuid,
        covenantUuid: state.covenantUuid,
        arethaUuid: state.arethaUuid,
        emojicode: state.emojicode
      }
    };
    const resp = await bdoUpdate(state.uuid, state.hash, next);
    state.bdo = resp.bdo || next;
    state.profile = state.bdo.profile || {};
    saveState();
    showToast("Profile saved", "success");
    log("Saved profile to BDO");
  } catch (err) {
    showToast(err.message || "Save profile failed", "error");
    log(`Save profile failed: ${err.message}`);
  }
};

const handleStoreSave = async () => {
  try {
    if (!state.uuid || !state.hash) throw new Error("Mint or login first");
    const base = state.bdo || (await bdoFetch(state.uuid, state.hash)).bdo || {};
    const referralCode = state.store.referralCode || Math.random().toString(16).slice(2, 8);
    const isPublic = (document.getElementById("store-public")?.value || "true") === "true";
    const store = {
      name: getInputValue("store-name") || "My Fledge Store",
      isPublic,
      referralCode,
      referralLink: buildStoreLink()
    };
    if (!store.name) {
      showToast("Store name required", "error");
      throw new Error("Store name required");
    }
    const next = {
      ...base,
      store,
      ids: {
        ...(base.ids || {}),
        uuid: state.uuid,
        sanoraUuid: state.sanoraUuid,
        addieUuid: state.addieUuid,
        fountUuid: state.fountUuid,
        covenantUuid: state.covenantUuid,
        arethaUuid: state.arethaUuid,
        emojicode: state.emojicode
      }
    };
    const resp = await bdoUpdate(state.uuid, state.hash, next);
    state.bdo = resp.bdo || next;
    state.store = state.bdo.store || store;
    setStoreForm(state.store);
    updateSessionView();
    saveState();
    showToast("Store saved", "success");
    log("Saved store");
  } catch (err) {
    showToast(err.message || "Save store failed", "error");
    log(`Save store failed: ${err.message}`);
  }
};

const handleStoreLoad = async () => {
  try {
    if (!state.uuid || !state.hash) return;
    const resp = await bdoFetch(state.uuid, state.hash);
    state.bdo = resp.bdo || {};
    state.store = state.bdo.store || {};
    state.profile = state.bdo.profile || state.profile;
    setStoreForm(state.store);
    saveState();
    log("Loaded store");
  } catch (err) {
    log(`Load store failed: ${err.message}`);
  }
};

const handleSeedProducts = async () => {
  try {
    if (!state.uuid) throw new Error("Mint or login first");
    for (const p of SEED_PRODUCTS) {
      await sanoraUpsertProduct(p);
    }
    log("Seeded starter products");
  } catch (err) {
    log(`Seed failed: ${err.message}`);
  }
};

const handleExportIdentity = () => {
  try {
    if (!state.uuid || !state.hash || !state.keys) throw new Error("Need identity to export");
    const bundle = {
      uuid: state.uuid,
      hash: state.hash,
      sanoraUuid: state.sanoraUuid,
      keys: state.keys
    };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fledge-identity.json";
  a.click();
  URL.revokeObjectURL(url);
  log("Identity exported");
    showToast("Key bundle downloaded", "success");
  } catch (err) {
    showToast(err.message || "Export failed", "error");
    log(`Export failed: ${err.message}`);
  }
};

const handleImportIdentity = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      state.uuid = data.uuid || "";
      state.hash = data.hash || "";
      state.sanoraUuid = data.sanoraUuid || "";
      state.keys = data.keys || null;
      if (state.keys) {
        setInput("pubkey-display", state.keys.pubKey);
        setInput("privkey-display", state.keys.privateKey);
        setInput("login-priv", state.keys.privateKey);
      }
      if (state.uuid) setInput("login-uuid", state.uuid);
      if (state.hash) setInput("hash-input", state.hash);
      updateSessionView();
      saveState();
      log("Identity imported");
    } catch (err) {
      log(`Import failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
};

const handleFetchBDO = async () => {
  try {
    if (!state.uuid || !state.hash) throw new Error("Mint or login first");
    const resp = await bdoFetch(state.uuid, state.hash);
    state.bdo = resp.bdo || {};
    const editor = document.getElementById("bdo-editor");
    if (editor) editor.value = JSON.stringify(state.bdo, null, 2);
    log("Fetched BDO");
  } catch (err) {
    log(`Fetch BDO failed: ${err.message}`);
  }
};

const handleUpdateBDO = async () => {
  try {
    if (!state.uuid || !state.hash) throw new Error("Mint or login first");
    const editor = document.getElementById("bdo-editor");
    let parsed = {};
    if (editor && editor.value.trim()) parsed = JSON.parse(editor.value);
    const resp = await bdoUpdate(state.uuid, state.hash, parsed);
    state.bdo = resp.bdo || parsed;
    state.profile = state.bdo.profile || state.profile;
    state.store = state.bdo.store || state.store;
    setProfileForm(state.profile);
    setStoreForm(state.store);
    saveState();
    log("Updated BDO");
  } catch (err) {
    log(`Update BDO failed: ${err.message}`);
  }
};

const handleDeleteUser = async () => {
  try {
    if (!state.uuid || !state.hash) throw new Error("Mint or login first");
    await bdoDelete(state.uuid, state.hash);
    handleLogout();
    log("Delete requested");
  } catch (err) {
    log(`Delete failed: ${err.message}`);
  }
};

const wireEvents = () => {
  document.getElementById("btn-gen-keys")?.addEventListener("click", handleGenerateKeys);
  document.getElementById("btn-mint")?.addEventListener("click", handleMint);
  document.getElementById("btn-login")?.addEventListener("click", handleLogin);
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("btn-save-profile")?.addEventListener("click", handleProfileSave);
  document.getElementById("btn-save-store")?.addEventListener("click", handleStoreSave);
  document.getElementById("btn-seed-products")?.addEventListener("click", handleSeedProducts);
  document.getElementById("btn-save-product")?.addEventListener("click", handleSaveProduct);
  document.getElementById("btn-load-my-products")?.addEventListener("click", handleLoadMyProducts);
  document.getElementById("btn-load-global")?.addEventListener("click", handleLoadGlobal);
  document.getElementById("btn-export-id")?.addEventListener("click", handleExportIdentity);
  document.getElementById("btn-import-id")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleImportIdentity(file);
  });
  document.getElementById("btn-copy-store")?.addEventListener("click", async () => {
    const link = resolveStoreLink(state.store);
    if (!link) return log("Save store first");
    await navigator.clipboard?.writeText(link);
    showToast("Store link copied", "success");
    log("Store link copied");
  });
  document.getElementById("btn-visit-store")?.addEventListener("click", () => {
    const link = resolveStoreLink(state.store);
    if (!link) return log("Save store first");
    window.open(link, "_blank");
  });
  document.getElementById("btn-hero-create")?.addEventListener("click", () => {
    const el = document.getElementById("quickstart");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("btn-hero-visit")?.addEventListener("click", () => {
    const link = resolveStoreLink(state.store);
    if (!link) return log("Save store first");
    window.open(link, "_blank");
  });
  document.getElementById("btn-random-hash")?.addEventListener("click", () => {
    const h = randHash();
    setInput("hash-input", h);
  });
  document.getElementById("btn-fetch-bdo")?.addEventListener("click", handleFetchBDO);
  document.getElementById("btn-update-bdo")?.addEventListener("click", handleUpdateBDO);
  document.getElementById("btn-delete-user")?.addEventListener("click", handleDeleteUser);
  const envSelect = document.getElementById("env-select");
  if (envSelect) {
    envSelect.addEventListener("change", (e) => {
      const env = e.target.value;
      const cfg = ENVIRONMENTS[env] || ENVIRONMENTS.prod;
      state.env = env;
      state.host = cfg.host;
      state.endpoints = buildEndpoints(cfg.host);
      saveState();
      log(`Switched env to ${env} (${cfg.host})`);
    });
  }
};

window.addEventListener("DOMContentLoaded", () => {
  if (!getInputValue("hash-input")) setInput("hash-input", randHash());
  restoreState();
  bindCopyButtons();
  wireEvents();
  handleLoadMyProducts().catch(() => {});
  handleLoadGlobal().catch(() => {});
  log(`Ready with host ${state.host}`);
});
