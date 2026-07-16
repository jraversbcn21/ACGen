import { useLocalStorage } from '../hooks/useLocalStorage';
import { ProjectProfile, DEFAULT_PROFILE } from '../types/context';

export function useProfile(): [ProjectProfile, (value: ProjectProfile) => void] {
  return useLocalStorage<ProjectProfile>('acgen_project_profile', DEFAULT_PROFILE);
}
