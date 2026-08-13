import { useLocalStorage } from '../hooks/useLocalStorage';
import { ProjectProfile, DEFAULT_PROFILE } from '../types/context';

export function useProfile(): [ProjectProfile, (value: ProjectProfile) => void] {
  const [stored, setStored] = useLocalStorage<ProjectProfile>('acgen_project_profile', DEFAULT_PROFILE);
  // Perfiles guardados antes de la Fase 1 carecen de los campos nuevos: fusionar sobre defaults.
  return [{ ...DEFAULT_PROFILE, ...stored }, setStored];
}
