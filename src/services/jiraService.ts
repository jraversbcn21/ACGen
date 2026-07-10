import { JIRA_URL_REGEX, PROXY_URL } from '../config/constants';
import type { JiraSearchResult, JiraTicketData } from '../types';

export function extractIssueKey(input: string): string | null {
  const match = input.match(JIRA_URL_REGEX);
  if (match) return match[1].toUpperCase();
  const bareMatch = input.match(/^([A-Z]+-\d+)$/i);
  if (bareMatch) return bareMatch[1].toUpperCase();
  return null;
}

export async function fetchJiraTicket(
  issueKey: string,
  token: string,
  baseUrl: string,
): Promise<JiraTicketData> {
  const response = await fetch(`${PROXY_URL}/jira/issue/${issueKey}`, {
    headers: {
      'X-Jira-Token': token,
      'X-Jira-Base-Url': baseUrl,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error HTTP ${response.status}`);
  }

  return response.json();
}

export function formatTicketAsText(ticket: JiraTicketData): string {
  const labels = ticket.labels.length > 0 ? ticket.labels.join(', ') : 'Ninguna';
  const components = ticket.components.length > 0 ? ticket.components.join(', ') : 'Ninguno';
  const description = ticket.description || 'Sin descripción';
  const acceptanceCriteria = ticket.acceptanceCriteria || 'No definidos';

  return (
    `[${ticket.key}] ${ticket.summary}\n` +
    `Tipo: ${ticket.issueType}\n` +
    `Prioridad: ${ticket.priority}\n` +
    `Estado: ${ticket.status}\n` +
    `Etiquetas: ${labels}\n` +
    `Componentes: ${components}\n` +
    `Descripción:\n${description}\n` +
    `Criterios de aceptación existentes:\n${acceptanceCriteria}`
  );
}

export async function jiraSearch(
  jql: string,
  token: string,
  baseUrl: string,
): Promise<{ issues: JiraSearchResult[] }> {
  const response = await fetch(
    `${PROXY_URL}/jira/search?jql=${encodeURIComponent(jql)}`,
    {
      headers: {
        'X-Jira-Token': token,
        'X-Jira-Base-Url': baseUrl,
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error HTTP ${response.status}`);
  }

  return response.json();
}
