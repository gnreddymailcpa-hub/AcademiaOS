/**
 * useTenantLocale — single source of truth for tenant-level locale config.
 *
 * Returns:
 *   { arabicEnabled }  → whether the Arabic locale UI surface is permitted
 *                        for the currently selected tenant.
 *
 * Resolution order:
 *   1. Explicit `current.locale_arabic_enabled` field (set by Institution Admin)
 *   2. Fallback: derive from country name (UAE / Saudi / Emirates / "Arab*")
 *   3. Default: false
 *
 * All UI surfaces (LanguageSwitcher, AI Instructor, AI Advisor,
 * Student Assistant, Assessments, etc.) MUST gate Arabic copy through
 * this hook rather than hard-coding `lang === "ar"`.
 */
import { useInstitution } from "../context/InstitutionContext";

export function useTenantLocale() {
  const { current } = useInstitution();

  if (current && typeof current.locale_arabic_enabled === "boolean") {
    return { arabicEnabled: current.locale_arabic_enabled };
  }
  const country = (current?.country || "").toLowerCase();
  const arabicEnabled =
    country.includes("arab") ||
    country.includes("uae") ||
    country.includes("emirat") ||
    country.includes("saudi") ||
    country.includes("qatar") ||
    country.includes("kuwait") ||
    country.includes("bahrain") ||
    country.includes("oman");
  return { arabicEnabled };
}
