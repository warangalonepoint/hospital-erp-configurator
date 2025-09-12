"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  // Load initial mode
  useEffect(() => {
    const saved = localStorage.getItem("erpTheme");
    if (saved === "dark" || saved === "light") {
      setMode(saved);
      document.documentElement.classList.remove("theme-light", "theme-dark");
      document.documentElement.classList.add(`theme-${saved}`);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const init = prefersDark ? "dark" : "light";
      setMode(init);
      document.documentElement.classList.add(`theme-${init}`);
    }
  }, []);

  // Toggle
  const toggle = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    localStorage.setItem("erpTheme", next);
    document.documentElement.classList.remove("theme-light", "theme-dark");
    document.documentElement.classList.add(`theme-${next}`);
  };

  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      className="px-3 py-2 rounded border border-[color:var(--line)]"
    >
      {mode === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
