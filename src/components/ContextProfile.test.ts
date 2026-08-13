import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfile } from './ContextProfile';
import { DEFAULT_PROFILE } from '../types/context';

describe('useProfile', () => {
  beforeEach(() => localStorage.clear());

  it('devuelve DEFAULT_PROFILE cuando no hay nada guardado', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current[0]).toEqual(DEFAULT_PROFILE);
  });

  it('fusiona un perfil guardado antiguo (sin campos nuevos) sobre los defaults', () => {
    // Perfil guardado antes de la Fase 1: solo los 5 campos originales
    localStorage.setItem('acgen_project_profile', JSON.stringify({
      domain: 'Banca digital', productType: 'Web', markets: 'LATAM',
      terminology: 'cuentas, transferencias', tone: 'Formal',
    }));
    const { result } = renderHook(() => useProfile());
    expect(result.current[0].domain).toBe('Banca digital');
    expect(result.current[0].environments).toBe(DEFAULT_PROFILE.environments);
    expect(result.current[0].testDataConventions).toBe(DEFAULT_PROFILE.testDataConventions);
  });

  it('persiste los campos nuevos al guardar', () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current[1]({ ...result.current[0], environments: 'Staging' }));
    const stored = JSON.parse(localStorage.getItem('acgen_project_profile')!);
    expect(stored.environments).toBe('Staging');
  });
});
