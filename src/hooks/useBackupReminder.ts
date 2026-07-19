import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { isBackupDue } from '../services/backup';

export interface BackupReminderState {
  due: boolean;
  lastBackupAt: number | null;
  markDone: () => void; // marks now and refreshes state
}

export function useBackupReminder(): BackupReminderState {
  const [lastBackupAt, setLastBackupAt] = useLocalStorage<number | null>(STORAGE_KEYS.LAST_BACKUP, null);

  const markDone = useCallback(() => {
    setLastBackupAt(Date.now());
  }, [setLastBackupAt]);

  return {
    due: isBackupDue(lastBackupAt),
    lastBackupAt,
    markDone,
  };
}
