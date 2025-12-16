// Simple dropdown navigation for quick page switching across the UX mock pages.
(function () {
  const pages = [
    { name: "Landing", href: "index.html" },
    { name: "Login", href: "login.html" },
    { name: "Console", href: "console.html" },
    { name: "Storefront", href: "store.html" },
    { name: "Checkout", href: "checkout.html" },
    { name: "Admin Dashboard", href: "admin-dashboard.html" },
    { name: "Admin Analytics", href: "admin-analytics.html" }
  ];

  const createNav = () => {
    const wrap = document.createElement("div");
    wrap.style.position = "fixed";
    wrap.style.top = "12px";
    wrap.style.left = "50%";
    wrap.style.transform = "translateX(-45%)";
    wrap.style.zIndex = "9999";
    wrap.style.fontFamily = "Inter, system-ui, -apple-system, sans-serif";

    const btn = document.createElement("button");
    btn.textContent = "Navigate ▾";
    btn.style.background = "linear-gradient(135deg, #7f13ec, #f97316)";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "9999px";
    btn.style.padding = "8px 14px";
    btn.style.fontWeight = "700";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";

    const list = document.createElement("div");
    list.style.position = "absolute";
    list.style.top = "42px";
    list.style.right = "0";
    list.style.background = "rgba(17, 17, 24, 0.95)";
    list.style.border = "1px solid rgba(255,255,255,0.08)";
    list.style.borderRadius = "12px";
    list.style.padding = "8px 0";
    list.style.minWidth = "200px";
    list.style.boxShadow = "0 12px 32px rgba(0,0,0,0.35)";
    list.style.display = "none";

    pages.forEach((p) => {
      const item = document.createElement("a");
      item.textContent = p.name;
      item.href = p.href;
      item.style.display = "block";
      item.style.padding = "10px 14px";
      item.style.color = "#e2e8f0";
      item.style.textDecoration = "none";
      item.style.fontSize = "14px";
      item.style.fontWeight = "600";
      item.onmouseenter = () => (item.style.background = "rgba(127,19,236,0.12)");
      item.onmouseleave = () => (item.style.background = "transparent");
      list.appendChild(item);
    });

    const toggle = () => {
      list.style.display = list.style.display === "none" ? "block" : "none";
    };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });
    document.addEventListener("click", () => {
      list.style.display = "none";
    });

    wrap.appendChild(btn);
    wrap.appendChild(list);
    document.body.appendChild(wrap);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createNav);
  } else {
    createNav();
  }
})();
