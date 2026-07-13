const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/;

function getAllowedHosts() {
  return (process.env.JIRA_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().replace(/^['"]|['"]$/g, '').trim().toLowerCase())
    .filter(Boolean);
}

export function validateAndEncodeIssueKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Clave de ticket inválida.');
  }
  if (!ISSUE_KEY_RE.test(key)) {
    throw new Error('Clave de ticket inválida.');
  }
  return encodeURIComponent(key);
}

export function validateBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL base de Jira inválida.');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL base de Jira inválida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL base de Jira inválida.');
  }

  if (!getAllowedHosts().includes(parsed.hostname.toLowerCase())) {
    throw new Error('Host de Jira no permitido.');
  }

  return parsed.origin;
}
