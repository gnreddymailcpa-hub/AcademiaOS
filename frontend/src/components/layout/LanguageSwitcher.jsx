import React from "react";
import { Languages } from "lucide-react";
import { useLang } from "../../context/LanguageContext";

export default function LanguageSwitcher() {
  const { lang, setLanguage } = useLang();
  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center rounded-md border border-border bg-card text-xs"
      data-testid="language-toggle"
    >
      <Languages className="ms-2 me-1 h-3.5 w-3.5 text-muted-foreground" />
      <button
        data-testid="language-en"
        onClick={() => setLanguage("en")}
        className={`px-2 py-1 rounded-sm transition ${
          lang === "en" ? "bg-primary text-primary-foreground font-medium" : "text-foreground/70"
        }`}
      >
        EN
      </button>
      <button
        data-testid="language-ar"
        onClick={() => setLanguage("ar")}
        className={`px-2 py-1 rounded-sm me-1 transition ${
          lang === "ar" ? "bg-primary text-primary-foreground font-medium" : "text-foreground/70"
        }`}
        style={{ fontFamily: "var(--font-arabic)" }}
      >
        ع
      </button>
    </div>
  );
}
