import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { formatDate, localTodayISO, daysBetween } from './dates';

const ORIGINAL_TZ = process.env.TZ;

describe('formatDate', () => {
  // Un timezone negativo (UTC-5) es donde new Date('YYYY-MM-DD') retrocede un día:
  // la fecha se parsea como medianoche UTC, que localmente aún es el día anterior.
  beforeAll(() => {
    process.env.TZ = 'America/Bogota';
  });

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it('keeps the same calendar day in a negative-offset timezone', () => {
    expect(formatDate('2026-07-20', 'es')).toBe('20/07/2026');
  });

  it('formats es as dd/mm/yyyy', () => {
    expect(formatDate('2026-01-05', 'es')).toBe('05/01/2026');
  });

  it('formats en as mm/dd/yyyy', () => {
    expect(formatDate('2026-07-20', 'en')).toBe('07/20/2026');
  });

  it('returns an em dash for null', () => {
    expect(formatDate(null, 'es')).toBe('—');
  });

  it('returns an em dash for a malformed date', () => {
    expect(formatDate('not-a-date', 'es')).toBe('—');
  });
});

describe('localTodayISO', () => {
  beforeAll(() => {
    process.env.TZ = 'America/Bogota';
  });

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the LOCAL calendar day even when UTC is already tomorrow', () => {
    vi.useFakeTimers();
    // 23:30 en Bogotá (UTC-5) => 04:30 del día siguiente en UTC
    vi.setSystemTime(new Date('2026-07-20T23:30:00-05:00'));
    expect(localTodayISO()).toBe('2026-07-20');
  });

  it('zero-pads month and day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00-05:00'));
    expect(localTodayISO()).toBe('2026-01-05');
  });
});

describe('daysBetween', () => {
  // Europe/Madrid: el 29-03-2026 dura 23 h. Con medianoches locales y floor,
  // cada dia posterior al cambio horario salia uno corto hasta acabar el sprint.
  beforeAll(() => { process.env.TZ = 'Europe/Madrid'; });
  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it('cuenta dias de calendario tambien a traves del cambio horario de marzo', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-03-28', '2026-04-15')).toBe(18);
    expect(daysBetween('2026-07-20', '2026-07-20')).toBe(0);
  });
});
