import React, { useEffect } from "react";
import { Languages } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { useTenantLocale } from "../../lib/useTenantLocale";

export default function LanguageSwitcher() {
  const { lang, setLanguage } = useLang();
  const { arabicEnabled } = useTenantLocale();

  // Auto-recover: if the tenant has Arabic disabled but the user's stored
  // preference is "ar" (because they switched in another tenant), drop back to EN.
  useEffect(() => {
    if (!arabicEnabled && lang === "ar") setLanguage("en");
  }, [arabicEnabled, lang, setLanguage]);

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center rounded-md border border-border bg-card text-xs"
      data-testid="language-switcher"
    >
      <Languages className="ms-2 me-1 h-3.5 w-3.5 text-muted-foreground" />
      <button
        data-testid="lang-en"
        aria-label="English"
        onClick={() => setLanguage("en")}
        className={`px-2 py-1 rounded-sm transition ${
          lang === "en" ? "bg-primary text-primary-foreground font-medium" : "text-foreground/70"
        }`}
      >
        EN
      </button>
      {arabicEnabled && (
        <button
          data-testid="lang-ar"
          aria-label="Arabic"
          onClick={() => setLanguage("ar")}
          className={`px-2 py-1 rounded-sm me-1 transition ${
            lang === "ar" ? "bg-primary text-primary-foreground font-medium" : "text-foreground/70"
          }`}
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          ع
        </button>
      )}
    </div>
  );
}
