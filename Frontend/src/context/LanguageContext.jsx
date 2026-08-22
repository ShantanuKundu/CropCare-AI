import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

/**
 * t(key, vars)  — looks up a translation key and optionally interpolates
 * variables.  Example: t('helloUser', { name: 'Ravi' })
 * Template syntax in translation strings: "Hello, {name}!"
 */
function buildTranslator(language) {
  return (key, vars = {}) => {
    const raw =
      translations[language]?.[key] ??
      translations['en']?.[key] ??
      key;

    // Replace {varName} placeholders
    return raw.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? vars[k] : `{${k}}`
    );
  };
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('cropcare_language') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('cropcare_language', language);
  }, [language]);

  // Memoize t so it only changes when language changes,
  // causing all useLanguage() consumers to re-render automatically.
  const t = useMemo(() => buildTranslator(language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

/**
 * getTForPDF() — returns a ready-to-use t() translator for the currently
 * selected language. Safe to call from any non-React module (e.g. pdfReport.js).
 * Reads the same localStorage key that LanguageProvider persists.
 */
export function getTForPDF() {
  const lang = localStorage.getItem('cropcare_language') || 'en';
  return buildTranslator(lang);
}

