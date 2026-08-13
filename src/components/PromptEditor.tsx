import { useState } from 'react';
import { DEFAULT_PROMPTS } from '../config/constants';
import { getPrompt } from '../services/apiService';
import { useT } from '../i18n/I18nContext';

const TOOLS = [
  { key: 'acceptance', labelKey: 'sidebar.criterios' },
  { key: 'testcase', labelKey: 'sidebar.testcase' },
  { key: 'bugreport', labelKey: 'sidebar.bugreport' },
  { key: 'testdata', labelKey: 'sidebar.testdata' },
  { key: 'userstory', labelKey: 'sidebar.userstory' },
  { key: 'refiner', labelKey: 'sidebar.refiner' },
  { key: 'edgecase', labelKey: 'sidebar.edgecase' },
  { key: 'converter', labelKey: 'sidebar.converter' },
];

interface PromptEditorProps {
  onClose: () => void;
}

export function PromptEditor({ onClose }: PromptEditorProps) {
  const t = useT();
  const [tool, setTool] = useState('acceptance');
  const [text, setText] = useState(() => getPrompt('acceptance'));
  const [saved, setSaved] = useState(false);

  const handleToolChange = (key: string) => {
    setTool(key);
    setText(getPrompt(key));
    setSaved(false);
  };

  const handleSave = () => {
    if (text.trim()) {
      localStorage.setItem(`acgen_prompt_${tool}`, text);
    } else {
      localStorage.removeItem(`acgen_prompt_${tool}`);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    localStorage.removeItem(`acgen_prompt_${tool}`);
    setText(DEFAULT_PROMPTS[tool]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isOverridden = (key: string) => {
    try {
      return localStorage.getItem(`acgen_prompt_${key}`) !== null;
    } catch { return false; }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Editor de Prompts</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {TOOLS.map((tk) => (
            <button
              key={tk.key}
              type="button"
              className={tool === tk.key ? 'btn-primary' : 'btn-ghost'}
              onClick={() => handleToolChange(tk.key)}
              style={{ fontSize: 12 }}
            >
              {t(tk.labelKey)}
              {isOverridden(tk.key) && <span style={{ marginLeft: 4, color: 'var(--success)' }}>*</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
          Variables: &#123;dominio&#125;, &#123;tipoProducto&#125;, &#123;mercados&#125;, &#123;terminologia&#125;, &#123;tono&#125;, &#123;entornos&#125;, &#123;mercadoPrincipal&#125;, &#123;mapaSitio&#125;, &#123;idiomaSalida&#125;, &#123;convencionesDatos&#125;
        </p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
          className="field-textarea"
          style={{ minHeight: 300, fontFamily: 'var(--font-mono)', fontSize: 13 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={handleReset}>
            Restaurar por defecto
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {saved ? 'Guardado!' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
