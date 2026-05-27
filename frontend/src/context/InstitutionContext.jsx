import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const InstitutionContext = createContext(null);
const STORAGE_KEY = "academiaos_institution";

export function InstitutionProvider({ children }) {
  const { user } = useAuth();
  const [institutions, setInstitutions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);

  const applyTheme = (inst) => {
    const html = document.documentElement;
    ["isb-theme", "eaic-theme", "bradford-theme"].forEach((c) => html.classList.remove(c));
    if (inst?.theme_key) html.classList.add(inst.theme_key);
  };

  const fetchAll = useCallback(async () => {
    if (!user || user === false) return;
    setLoading(true);
    try {
      const { data } = await api.get("/institutions");
      setInstitutions(data);
      const savedId = localStorage.getItem(STORAGE_KEY);
      const fallbackId = user.institution_id || data[0]?.id;
      const pick = data.find((i) => i.id === savedId) || data.find((i) => i.id === fallbackId) || data[0];
      if (pick) {
        setCurrent(pick);
        applyTheme(pick);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const switchInstitution = (id) => {
    const inst = institutions.find((i) => i.id === id);
    if (!inst) return;
    setCurrent(inst);
    applyTheme(inst);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <InstitutionContext.Provider
      value={{ institutions, current, loading, switchInstitution, refresh: fetchAll }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export const useInstitution = () => useContext(InstitutionContext);
