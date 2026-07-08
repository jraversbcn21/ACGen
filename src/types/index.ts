export interface GroqResponse {
  content: string;
  model: string;
  reasoning?: string;
}

export interface TestCaseResponse {
  testCases: TestCaseData[];
  model: string;
}

export interface GroqApiError {
  message: string;
  code?: string;
  status?: number;
}

export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface JiraTicketData {
  key: string | null;
  summary: string | null;
  description: string | null;
  issueType: string | null;
  priority: string | null;
  status: string | null;
  labels: string[];
  components: string[];
  acceptanceCriteria: string | null;
}

export interface TestCaseData {
  key: string;
  summary: string;
  priority: string;
  type: string;
  preconditions: string;
  testSteps: string[];
  expectedResult: string;
}

export type PlatformId = 'web-desktop' | 'web-mobile' | 'app-android' | 'app-ios';

export interface BugReportFormData {
  description: string;
  platform: PlatformId;
  market: string;
  browser?: string;
  url?: string;
  appVersion?: string;
  device?: string;
  osVersion?: string;
  jiraTicketUrl?: string;
}

export type DataTypeId = 'shipping-address' | 'billing-data' | 'user-registration' | 'payment-cards' | 'promo-codes';

export interface TestDataFormData {
  dataType: DataTypeId;
  market: string;
  quantity: number;
  jiraTicketUrl?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  inputPreview: string;
  output: string;
}

export interface JiraSearchResult {
  key: string;
  summary: string;
  status: string;
  created: string;
  updated: string;
}
