import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

/**
 * Single-button toggle between light and dark themes. Persists to
 * localStorage via ThemeContext and applies `.dark` class on <html>.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      data-testid="theme-toggle"
      data-theme={theme}
      className="relative h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted/60 transition-colors"
    >
      <Sun
        className={`h-4 w-4 text-foreground/70 transition-all ${isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
      />
      <Moon
        className={`absolute h-4 w-4 text-foreground/70 transition-all ${isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"}`}
      />
    </button>
  );
}
