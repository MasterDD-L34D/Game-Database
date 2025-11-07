
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './locales/it/common.json';
import navigation from './locales/it/navigation.json';
import dashboard from './locales/it/dashboard.json';
import list from './locales/it/list.json';
import filters from './locales/it/filters.json';
import table from './locales/it/table.json';
import records from './locales/it/records.json';
import exportNs from './locales/it/export.json';
import taxonomy from './locales/it/taxonomy.json';

const resources = {
  it: {
    common,
    navigation,
    dashboard,
    list,
    filters,
    table,
    records,
    export: exportNs,
    taxonomy,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'it',
  fallbackLng: 'it',
  defaultNS: 'common',
  ns: ['common', 'navigation', 'dashboard', 'list', 'filters', 'table', 'records', 'export', 'taxonomy'],
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  missingKeyHandler(lng, ns, key) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Missing translation for ${ns}:${key} (${lng})`);
    }
  },
  parseMissingKeyHandler(key) {
    return key;
  },
});

export default i18n;
