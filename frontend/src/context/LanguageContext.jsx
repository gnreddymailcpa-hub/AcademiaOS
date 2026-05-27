import React, { createContext, useContext, useEffect, useState } from "react";
import { t as translate } from "../lib/i18n";

const LanguageContext = createContext(null);
const STORAGE_KEY = "academiaos_lang";

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || "en");

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLanguage = (l) => setLang(l);
  const t = (key) => translate(lang, key);
  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>{children}</LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
