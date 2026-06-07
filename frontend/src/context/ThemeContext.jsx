import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "light", setTheme: () => {}, toggleTheme: () => {} });

const STORAGE_KEY = "claros-theme"; // "light" | "dark"
const VALID = new Set(["light", "dark"]);

function readInitial() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored)) return stored;
  } catch (_e) { /* ignored */ }
  // Fall back to system preference
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch (_e) { /* ignored */ }
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitial);

  // Apply / remove `.dark` on <html>. Tailwind config is `darkMode: "class"`.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_e) { /* ignored */ }
  }, [theme]);

  const setTheme = useCallback((t) => {
    if (VALID.has(t)) setThemeState(t);
  }, []);
  const toggleTheme = useCallback(() => {
    setThemeState((cur) => (cur === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
