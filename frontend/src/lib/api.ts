// Small fetch wrapper for the backend API, reached through the same-origin /api proxy.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: unknown;

  constructor(status: number, message: string, code: string | null, detail: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

interface ValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

const FIELD_NAMES: Record<string, string> = {
  race_time: 'race time',
  horse_name: 'horse',
  unit_stake_pence: 'stake',
  stake_pence: 'stake',
  return_pence: 'return',
  display_name: 'name',
  new_password: 'new password',
  budget_pence: 'budget',
};

function describeIssue(issue: ValidationIssue): string {
  const message = (issue.msg ?? 'Invalid value').replace(/^Value error, /, '');
  const loc = (issue.loc ?? []).filter((part) => part !== 'body');
  if (loc.length === 0) {
    return message;
  }
  const field = String(loc.at(-1));
  const selectionIndex = loc[0] === 'selections' && typeof loc[1] === 'number' ? loc[1] : null;
  const name = FIELD_NAMES[field] ?? field.replaceAll('_', ' ');
  const prefix = selectionIndex === null ? name : `Horse ${selectionIndex + 1} ${name}`;
  return `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
}

export function messageFromDetail(detail: unknown, fallback: string): { message: string; code: string | null } {
  if (typeof detail === 'string') {
    return { message: detail, code: null };
  }
  if (Array.isArray(detail)) {
    const messages = (detail as ValidationIssue[]).map((issue) => describeIssue(issue));
    return { message: messages.join('. ') || fallback, code: 'validation' };
  }
  if (detail && typeof detail === 'object') {
    const record = detail as { message?: unknown; code?: unknown };
    return {
      message: typeof record.message === 'string' ? record.message : fallback,
      code: typeof record.code === 'string' ? record.code : null,
    };
  }
  return { message: fallback, code: null };
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'You are not signed in',
  403: 'You are not allowed to do that',
  404: 'Not found',
  413: 'That file is too large',
  502: 'The betting server is not reachable. Try again in a moment.',
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

export function withQuery(path: string, query?: RequestOptions['query']): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  let body = options.body;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }
  let response: Response;
  try {
    response = await fetch(withQuery(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.', 'network', null);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const fallback = STATUS_MESSAGES[response.status] ?? `Something went wrong (${response.status})`;
    const detail = data && typeof data === 'object' && 'detail' in data ? (data as { detail: unknown }).detail : data;
    const { message, code } = messageFromDetail(detail, fallback);
    throw new ApiError(response.status, message, code, detail);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
