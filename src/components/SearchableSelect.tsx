import { useState, useRef, useEffect, useCallback } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  const filtered = search.length >= 3
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, close]);

  const handleSelect = (val: string) => {
    onChange(val);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev + 1 >= filtered.length ? 0 : prev + 1;
        return next;
      });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev - 1 < 0 ? filtered.length - 1 : prev - 1;
        return next;
      });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex].value);
      }
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className="sselect" ref={containerRef}>
      <button
        type="button"
        className={`sselect-trigger ${open ? 'sselect-open' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedOption ? 'sselect-selected' : 'sselect-placeholder'}>
          {selectedOption ? selectedOption.label : (placeholder || 'Seleccionar...')}
        </span>
        <span className="select-chev">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className="sselect-dropdown">
          <div className="sselect-search">
            <input
              ref={inputRef}
              type="text"
              className="field-input"
              placeholder="Buscar mercado..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
          <ul ref={listRef} className="sselect-list" role="listbox">
            {filtered.length === 0 ? (
              <li className="sselect-empty">Sin resultados</li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  className={`sselect-option ${opt.value === value ? 'sselect-current' : ''} ${idx === highlightedIndex ? 'sselect-highlighted' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
