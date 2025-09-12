"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";
const KEY = "erpTheme";
const CLASS_LIGHT = "theme-light";
const CLASS_DARK = "theme-dark";

function apply(mode: Mode) {
  const el = document.documentElement;
  el.classList.remove(CLASS_LIGHT, CLASS_DARK);
  el.classList.add(mode === "light" ? CLASS_LIGHT : CLASS_DARK);
  el.style.colorScheme = mode; // better form controls/scrollbars
}

export default function ThemeToggle() {
  // Render with a neutral label first to avoid hydration mismatch
  const [mode, setMode] = useState<Mode>("light"); // will be corrected on mount
  const [ready, setReady] = useState(false);

  // Boot once on client
  useEffect(() => {
    let init: Mode = "light";
    try {
      const saved = localStorage.getItem(KEY) as Mode | null;
      if (saved === "light" || saved === "dark") {
        init = saved;
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        init = "dark";
      }
    } catch {}
    setMode(init);
    apply(init);
    setReady(true);
  }, []);

  // Cross-tab + cross-iframe sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setMode(e.newValue as Mode);
        apply(e.newValue as Mode);
      }
    };
    const onMessage = (e: MessageEvent) => {
      const m = e?.data;
      if (m && m.type === "erp-theme" && (m.mode === "light" || m.mode === "dark")) {
        setMode(m.mode);
        apply(m.mode);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const toggle = () => {
    const next: Mode = mode === "light" ? "dark" : "light";
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    apply(next);
    // tell shell/iframes if they’re listening (your theme.js does)
    try {
      window.postMessage({ type: "erp-theme", mode: next }, "*");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle theme"
      className="px-3 py-2 rounded border border-[color:var(--line)]"
    >
      {/* avoid hydration mismatch: show neutral label until client decides */}
      {!ready ? "Theme" : mode === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
