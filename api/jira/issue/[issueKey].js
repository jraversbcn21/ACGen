import { validateAndEncodeIssueKey, validateBaseUrl } from '../../_lib/jiraUtils.js';

const FETCH_TIMEOUT_MS = 8_000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { issueKey } = req.query;
  const token = req.headers['x-jira-token'];
  const baseUrl = req.headers['x-jira-base-url'];

  if (!token || !baseUrl) {
    return res.status(400).json({ error: 'Faltan credenciales de Jira (token o URL base).' });
  }

  let validatedBaseUrl;
  try {
    validatedBaseUrl = validateBaseUrl(baseUrl);
  } catch {
    return res.status(400).json({ error: 'URL base de Jira inválida.' });
  }

  let encodedIssueKey;
  try {
    encodedIssueKey = validateAndEncodeIssueKey(issueKey);
  } catch {
    return res.status(400).json({ error: 'Clave de ticket inválida.' });
  }

  try {
    const response = await fetch(
      `${validatedBaseUrl}/rest/api/2/issue/${encodedIssueKey}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
      }
      if (response.status === 404) {
        return res.status(404).json({ error: 'Ticket no encontrado.' });
      }
      return res.status(response.status).json({ error: `Error al consultar Jira: ${response.status}` });
    }

    const data = await response.json();
    const fields = data.fields || {};

    const result = {
      key: data.key || null,
      summary: fields.summary || null,
      description: fields.description || null,
      issueType: fields.issuetype?.name || null,
      priority: fields.priority?.name || null,
      status: fields.status?.name || null,
      labels: fields.labels || [],
      components: (fields.components || []).map((c) => c.name),
      acceptanceCriteria: fields.customfield_10401 || null,
    };

    return res.json(result);
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Timeout al consultar Jira. El servidor no responde.' });
    }
    console.error('Jira proxy error:', err);
    return res.status(500).json({ error: 'Error de conexión con el servidor proxy.' });
  }
}
