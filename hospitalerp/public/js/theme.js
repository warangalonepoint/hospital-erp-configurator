// public/js/theme.js
(function () {
  const THEME_KEY = "erpTheme";
  const CLASSES = ["theme-light", "theme-dark"];

  function applyTheme(mode) {
    const el = document.documentElement;
    CLASSES.forEach(c => el.classList.remove(c));
    el.classList.add(mode === "light" ? "theme-light" : "theme-dark");
    // helps form controls & scrollbars on some browsers
    el.style.colorScheme = mode === "light" ? "light" : "dark";
  }

  function getInitialTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    // fallback to system
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function setTheme(mode, { broadcast = true } = {}) {
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
    applyTheme(mode);

    if (broadcast) {
      // notify iframes
      try {
        const frames = document.querySelectorAll("iframe");
        frames.forEach(f => {
          try { f.contentWindow?.postMessage({ type: "erp-theme", mode }, "*"); } catch {}
        });
      } catch {}
      // storage event will sync other tabs/windows automatically
    }
  }

  function toggle() {
    const curr = document.documentElement.classList.contains("theme-light") ? "light" : "dark";
    setTheme(curr === "light" ? "dark" : "light");
  }

  // ---- boot ASAP (no flash) ----
  const boot = getInitialTheme();
  applyTheme(boot);

  // ---- cross-context listeners ----
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) {
      applyTheme(e.newValue);
    }
  });

  window.addEventListener("message", (e) => {
    const m = e?.data;
    if (m && m.type === "erp-theme" && (m.mode === "light" || m.mode === "dark")) {
      setTheme(m.mode, { broadcast: false });
    }
  });

  // expose helpers
  window.theme = {
    get: () => (document.documentElement.classList.contains("theme-light") ? "light" : "dark"),
    set: (m) => setTheme(m),
    toggle,
  };
})();
