import { useState } from 'react';
import { useProfile } from './ContextProfile';
import { DEFAULT_PROFILE, ProjectProfile } from '../types/context';
import { useT } from '../i18n/I18nContext';

const FIELDS: { key: keyof ProjectProfile; labelKey: string; multiline?: boolean }[] = [
  { key: 'domain', labelKey: 'profile.domain' },
  { key: 'productType', labelKey: 'profile.productType' },
  { key: 'markets', labelKey: 'profile.markets' },
  { key: 'terminology', labelKey: 'profile.terminology' },
  { key: 'tone', labelKey: 'profile.tone' },
  { key: 'environments', labelKey: 'profile.environments' },
  { key: 'mainMarket', labelKey: 'profile.mainMarket' },
  { key: 'outputLanguage', labelKey: 'profile.outputLanguage' },
  { key: 'siteMap', labelKey: 'profile.siteMap', multiline: true },
  { key: 'testDataConventions', labelKey: 'profile.testDataConventions', multiline: true },
];

interface ProfileEditorProps {
  onClose: () => void;
}

export function ProfileEditor({ onClose }: ProfileEditorProps) {
  const t = useT();
  const [profile, setProfile] = useProfile();
  const [draft, setDraft] = useState<ProjectProfile>(profile);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setDraft(DEFAULT_PROFILE);
    setProfile(DEFAULT_PROFILE);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t('profile.title')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>{t('profile.hint')}</p>
        {FIELDS.map(({ key, labelKey, multiline }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label htmlFor={`profile-${key}`} style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              {t(labelKey)}
            </label>
            {multiline ? (
              <textarea
                id={`profile-${key}`}
                value={draft[key]}
                onChange={(e) => { setDraft({ ...draft, [key]: e.target.value }); setSaved(false); }}
                className="field-textarea"
                style={{ minHeight: 100, fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
            ) : (
              <input
                id={`profile-${key}`}
                type="text"
                value={draft[key]}
                onChange={(e) => { setDraft({ ...draft, [key]: e.target.value }); setSaved(false); }}
                className="field-input"
              />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={handleReset}>{t('profile.reset')}</button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {saved ? t('profile.saved') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
