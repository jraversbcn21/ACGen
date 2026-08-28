import { useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';
import { parseUrlCell } from '../utils/trackerLinks';

export interface DocLink {
  id: string;
  name: string;
  url: string;
  category: string;
  favorite: boolean;
}

/** Busqueda sin acentos, mismo criterio que la portada. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const EMPTY_DRAFT = { name: '', url: '', category: '' };

export function DocLibrary() {
  const t = useT();
  const [store, setStore] = useLocalStorage<{ links: DocLink[] }>(STORAGE_KEYS.DOC_LINKS, { links: [] });
  const links = store.links;
  const [query, setQuery] = useState('');
  // 'all' | '__fav' | nombre de categoria. Las categorias son texto libre por
  // enlace; los chips se derivan de las existentes, no hay lista que gestionar.
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const categories = useMemo(() => {
    const acc = new Map<string, number>();
    links.forEach((l) => { const c = l.category.trim(); if (c) acc.set(c, (acc.get(c) ?? 0) + 1); });
    return Array.from(acc, ([name, count]) => ({ name, count }));
  }, [links]);
  const favCount = useMemo(() => links.filter((l) => l.favorite).length, [links]);

  const visible = useMemo(() => {
    const q = norm(query.trim());
    const filtered = links.filter((l) => {
      if (filter === '__fav' && !l.favorite) return false;
      if (filter !== 'all' && filter !== '__fav' && l.category.trim() !== filter) return false;
      if (!q) return true;
      return norm(l.name).includes(q) || norm(l.url).includes(q) || norm(l.category).includes(q);
    });
    // Favoritos arriba; dentro de cada grupo, el orden de alta (nuevas primero).
    return [...filtered.filter((l) => l.favorite), ...filtered.filter((l) => !l.favorite)];
  }, [links, query, filter]);

  const openForm = (link?: DocLink) => {
    setEditingId(link?.id ?? null);
    setDraft(link ? { name: link.name, url: link.url, category: link.category } : EMPTY_DRAFT);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const handleSave = () => {
    const name = draft.name.trim();
    const url = draft.url.trim();
    if (!name || !url) return;
    const category = draft.category.trim();
    if (editingId) {
      setStore((prev) => ({ links: prev.links.map((l) => (l.id === editingId ? { ...l, name, url, category } : l)) }));
    } else {
      setStore((prev) => ({ links: [{ id: crypto.randomUUID(), name, url, category, favorite: false }, ...prev.links] }));
    }
    closeForm();
  };

  /* Pegar "Nombre - URL" (formato SnapLink, el mismo de los trackers) en el
     campo URL rellena ambos campos de una vez. */
  const handleUrlChange = (value: string) => {
    const parts = parseUrlCell(value);
    if (parts?.name && !draft.name.trim()) {
      setDraft((d) => ({ ...d, name: parts.name!, url: parts.url }));
    } else {
      setDraft((d) => ({ ...d, url: value }));
    }
  };

  const toggleFavorite = (id: string) =>
    setStore((prev) => ({ links: prev.links.map((l) => (l.id === id ? { ...l, favorite: !l.favorite } : l)) }));

  const handleDelete = (link: DocLink) => {
    if (!confirm(t('doclibrary.deleteConfirm'))) return;
    setStore((prev) => ({ links: prev.links.filter((l) => l.id !== link.id) }));
    if (editingId === link.id) closeForm();
  };

  const searching = query.trim() !== '';

  return (
    <div className="dl-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('doclibrary.title')}</h1>
          <p className="tool-sub">{t('doclibrary.subtitle', { n: String(links.length) })}</p>
        </div>
        <div className="tool-head-aside">
          <button type="button" className="btn-primary" onClick={() => (showForm && !editingId ? closeForm() : openForm())}>
            + {t('doclibrary.addLink')}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="dl-form">
          <div className="dl-form-row">
            <div className="dl-form-field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="dl-name" className="field-label">{t('doclibrary.nameLabel')}</label>
              <input id="dl-name" type="text" className="field-input" autoFocus value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') closeForm(); }} />
            </div>
            <div className="dl-form-field" style={{ flex: '2 1 280px' }}>
              <label htmlFor="dl-url" className="field-label">{t('doclibrary.urlLabel')}</label>
              <input id="dl-url" type="text" className="field-input" placeholder="https://..." value={draft.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') closeForm(); }} />
            </div>
            <div className="dl-form-field" style={{ flex: '1 1 160px' }}>
              <label htmlFor="dl-category" className="field-label">{t('doclibrary.categoryLabel')}</label>
              <input id="dl-category" type="text" className="field-input" list="dl-categories" value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') closeForm(); }} />
              <datalist id="dl-categories">
                {categories.map((c) => <option key={c.name} value={c.name} />)}
              </datalist>
            </div>
          </div>
          <div className="dl-form-actions">
            <button type="button" className="btn-primary" style={{ minWidth: 130 }}
              disabled={!draft.name.trim() || !draft.url.trim()} onClick={handleSave}>
              {t(editingId ? 'common.save' : 'doclibrary.create')}
            </button>
            <button type="button" className="btn-ghost" onClick={closeForm}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="dl-bar">
        <div className="dl-search">
          <input type="search" className="field-input" value={query}
            placeholder={t('doclibrary.searchPlaceholder')} aria-label={t('doclibrary.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)} />
          {searching && <span className="dl-search-count">{visible.length}/{links.length}</span>}
        </div>
        <div className="dl-chips">
          <button type="button" className="ld-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            {t('doclibrary.filterAll')}
            <span className="ld-chip-count">{links.length}</span>
          </button>
          {favCount > 0 && (
            <button type="button" className="ld-chip" aria-pressed={filter === '__fav'}
              onClick={() => setFilter(filter === '__fav' ? 'all' : '__fav')}>
              ★ {t('doclibrary.favorites')}
              <span className="ld-chip-count">{favCount}</span>
            </button>
          )}
          {categories.map((c) => (
            <button key={c.name} type="button" className="ld-chip" aria-pressed={filter === c.name}
              onClick={() => setFilter(filter === c.name ? 'all' : c.name)}>
              {c.name}
              <span className="ld-chip-count">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dl-list">
        {links.length === 0 && (
          <div className="dl-empty">
            <span className="dl-empty-title">{t('doclibrary.emptyTitle')}</span>
            <span className="dl-empty-sub">{t('doclibrary.emptyHint')}</span>
          </div>
        )}
        {links.length > 0 && visible.length === 0 && (
          <div className="dl-empty">
            <span className="dl-empty-title">{t('doclibrary.noMatches')}</span>
          </div>
        )}
        {visible.map((link) => (
          <div key={link.id} className="dl-item">
            <button type="button" className={`dl-star ${link.favorite ? 'dl-star-on' : ''}`}
              aria-pressed={link.favorite} aria-label={t('doclibrary.toggleFavorite')}
              title={t('doclibrary.toggleFavorite')} onClick={() => toggleFavorite(link.id)}>
              ★
            </button>
            <a className="dl-item-body" href={link.url} target="_blank" rel="noopener noreferrer" title={link.url}>
              <span className="dl-item-name">{link.name} ↗</span>
              <span className="dl-item-url">{link.url}</span>
            </a>
            {link.category.trim() && <span className="dl-tag">{link.category}</span>}
            <span className="dl-item-actions">
              <button type="button" className="btn-ghost dl-mini" onClick={() => openForm(link)}>{t('common.edit')}</button>
              <button type="button" className="btn-ghost dl-mini" onClick={() => handleDelete(link)}>{t('common.delete')}</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
