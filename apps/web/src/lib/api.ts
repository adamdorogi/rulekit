export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch('/api' + path, {
    method: options.method,
    credentials: 'same-origin',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || data?.error || 'Request failed (' + response.status + ').');
  }
  return data as T;
}

export const sessionPath = '/v1/auth/me';
export const projectsPath = '/v1/projects';
export const projectPath = (slug: string) => projectsPath + '/' + encodeURIComponent(slug);
