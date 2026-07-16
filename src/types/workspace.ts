import type { ViewType } from '../config/constants';

export interface Artifact {
  id: string;
  tool: ViewType;
  input: string;
  output: string;
  timestamp: number;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  artifacts: Artifact[];
}
