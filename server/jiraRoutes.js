import { Router } from 'express';

export const jiraRoutes = Router();

jiraRoutes.get('/issue/:issueKey', async (req, res) => {
  const { issueKey } = req.params;
  const token = req.headers['x-jira-token'];
  const baseUrl = req.headers['x-jira-base-url'];

  if (!token || !baseUrl) {
    return res.status(400).json({ error: 'Faltan credenciales de Jira (token o URL base).' });
  }

  try {
    const response = await fetch(`${baseUrl}/rest/api/2/issue/${issueKey}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

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
    console.error('Jira proxy error:', err);
    return res.status(500).json({ error: 'Error de conexión con el servidor proxy.' });
  }
});

jiraRoutes.get('/search', async (req, res) => {
  const token = req.headers['x-jira-token'];
  const baseUrl = req.headers['x-jira-base-url'];
  const jql = req.query.jql;

  if (!token || !baseUrl) {
    return res.status(400).json({ error: 'Faltan credenciales de Jira (token o URL base).' });
  }

  if (!jql) {
    return res.status(400).json({ error: 'Falta el parámetro JQL.' });
  }

  try {
    const response = await fetch(
      `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=key,summary,status,created,updated&maxResults=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
      }
      if (response.status === 400) {
        return res.status(400).json({ error: 'JQL inválida. Revisa la sintaxis.' });
      }
      return res.status(response.status).json({ error: `Error al consultar Jira: ${response.status}` });
    }

    const data = await response.json();
    const issues = (data.issues || []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || '',
      status: issue.fields?.status?.name || '',
      created: issue.fields?.created || '',
      updated: issue.fields?.updated || '',
    }));

    return res.json({ issues });
  } catch (err) {
    console.error('Jira proxy error:', err);
    return res.status(500).json({ error: 'Error de conexión con el servidor proxy.' });
  }
});
