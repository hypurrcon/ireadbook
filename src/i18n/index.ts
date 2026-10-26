import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import th from './th.json';
import en from './en.json';

export type Lang = 'th' | 'en';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'th' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  return (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('th')) ? 'th' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { th: { translation: th }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Lang) {
  try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export function currentLang(): Lang {
  return (i18n.language === 'th' ? 'th' : 'en');
}

export default i18n;
