const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/;

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

  return parsed.origin;
}
