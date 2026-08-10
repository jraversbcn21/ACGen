import { useT } from '../i18n/I18nContext';

// STUB TEMPORAL (Task 2 → Task 5 del plan regression-versions):
// la vista versionada se implementa en RegressionCard + la reescritura de Task 5.
export function RegressionTracker() {
  const t = useT();
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.title')}</h2>;
}
