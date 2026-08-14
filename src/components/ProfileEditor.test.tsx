import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileEditor } from './ProfileEditor';
import { I18nProvider } from '../i18n/I18nContext';
import { DEFAULT_PROFILE, parseDeviceList } from '../types/context';
import { IOS_DEVICES } from '../config/constants';

function renderEditor(onClose = vi.fn()) {
  return render(<I18nProvider><ProfileEditor onClose={onClose} /></I18nProvider>);
}

describe('ProfileEditor', () => {
  beforeEach(() => {
    localStorage.clear();
    // I18nProvider defaults to the jsdom navigator language (en-US in this
    // environment); every sibling component test pins Spanish explicitly.
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('muestra los valores por defecto del perfil', () => {
    renderEditor();
    expect(screen.getByLabelText(/dominio|domain/i)).toHaveValue(DEFAULT_PROFILE.domain);
    expect(screen.getByLabelText(/entorno/i)).toHaveValue('Pro');
    expect(screen.getByLabelText(/mercado principal|main market/i)).toHaveValue('ES');
  });

  it('guarda los cambios en localStorage', () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText(/entorno/i), { target: { value: 'UAT' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|save/i }));
    const stored = JSON.parse(localStorage.getItem('acgen_project_profile')!);
    expect(stored.environments).toBe('UAT');
  });

  it('restaurar por defecto repone DEFAULT_PROFILE', () => {
    localStorage.setItem('acgen_project_profile', JSON.stringify({ ...DEFAULT_PROFILE, environments: 'UAT' }));
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /restaurar|reset/i }));
    const stored = JSON.parse(localStorage.getItem('acgen_project_profile')!);
    expect(stored.environments).toBe('Pro');
  });

  it('las convenciones de datos se editan en un textarea', () => {
    renderEditor();
    const field = screen.getByLabelText(/convenciones/i);
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveValue(DEFAULT_PROFILE.testDataConventions);
  });
});

describe('dispositivos en el perfil', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('el editor muestra los dos campos de dispositivos con sus defaults', () => {
    renderEditor();
    expect((screen.getByLabelText(/Dispositivos iOS/i) as HTMLInputElement).value).toBe('iPhone XR, iPhone 11');
    expect((screen.getByLabelText(/Dispositivos Android/i) as HTMLInputElement).value).toBe('Redmi Note 11 Pro, Moto g35 5G');
  });

  it('parseDeviceList trocea, recorta y descarta vacios', () => {
    expect(parseDeviceList('  Pixel 8 ,, Galaxy S24  ', IOS_DEVICES)).toEqual(['Pixel 8', 'Galaxy S24']);
  });

  it('parseDeviceList cae al fallback con el campo vacio', () => {
    expect(parseDeviceList('   ', IOS_DEVICES)).toEqual(['iPhone XR', 'iPhone 11']);
  });
});
