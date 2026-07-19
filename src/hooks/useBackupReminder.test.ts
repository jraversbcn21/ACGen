import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackupReminder } from './useBackupReminder';

describe('useBackupReminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is due with significant data and no previous backup, and markDone clears it', () => {
    localStorage.setItem('acgen_sprints', JSON.stringify([{ id: 's1', name: 'Sprint 1' }]));

    const { result } = renderHook(() => useBackupReminder());

    expect(result.current.due).toBe(true);
    expect(result.current.lastBackupAt).toBeNull();

    const before = Date.now();
    act(() => {
      result.current.markDone();
    });
    const after = Date.now();

    expect(result.current.due).toBe(false);
    expect(typeof result.current.lastBackupAt).toBe('number');
    expect(result.current.lastBackupAt as number).toBeGreaterThanOrEqual(before);
    expect(result.current.lastBackupAt as number).toBeLessThanOrEqual(after);
    expect(JSON.parse(localStorage.getItem('acgen_last_backup') || 'null')).toBe(result.current.lastBackupAt);
  });

  it('is not due without significant data, even with no previous backup', () => {
    const { result } = renderHook(() => useBackupReminder());

    expect(result.current.due).toBe(false);
    expect(result.current.lastBackupAt).toBeNull();
  });
});
