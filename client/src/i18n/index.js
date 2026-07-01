import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Import translation files
import enTranslation from '../locales/en/translation.json';
import hiTranslation from '../locales/hi/translation.json';
import bnTranslation from '../locales/bn/translation.json';
import orTranslation from '../locales/or/translation.json';
import urTranslation from '../locales/ur/translation.json';
import saTranslation from '../locales/sa/translation.json';
import satTranslation from '../locales/sat/translation.json';

const resources = {
  en: {
    translation: enTranslation
  },
  hi: {
    translation: hiTranslation
  },
  bn: {
    translation: bnTranslation
  },
  or: {
    translation: orTranslation
  },
  ur: {
    translation: urTranslation
  },
  sa: {
    translation: saTranslation
  },
  sat: {
    translation: satTranslation
  }
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    supportedLngs: ['en', 'hi', 'bn', 'or', 'ur', 'sa', 'sat'],
    
    // Language names for display
    load: 'languageOnly',
    
    // Custom language names
    lng: 'en',
    
    // Namespace
    ns: ['translation'],
    defaultNS: 'translation',
  });

export default i18n;
