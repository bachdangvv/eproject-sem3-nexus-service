import { ApiError } from '../types/nexus';

const DEFAULT_TIMEOUT_MS = 10_000;

let cachedCsrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getCsrfToken(): string | null {
  return cachedCsrfToken;
}

export function setCsrfToken(token: string | null): void {
  cachedCsrfToken = token;
}

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function defaultStatusTitle(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 429:
      return 'Too Many Requests';
    case 502:
    case 503:
    case 504:
      return 'Service Unavailable';
    default:
      return `HTTP ${status}`;
  }
}

function defaultStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Please check the submitted fields and try again.';
    case 401:
      return 'Authentication is required or credentials are invalid.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested record was not found.';
    case 409:
      return 'This action conflicts with the current record state.';
    case 429:
      return 'Too many login attempts. Please wait a minute and try again.';
    case 502:
    case 503:
    case 504:
      return 'Backend API is unavailable. Ensure the Nexus backend server is running.';
    default:
      return `Request failed (${status}).`;
  }
}

function normalizeValidationErrors(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const normalized: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      const messages = value.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
      if (messages.length > 0) {
        normalized[key] = messages;
      }
    } else if (typeof value === 'string' && value.trim().length > 0) {
      normalized[key] = [value];
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

async function parseApiError(response: Response): Promise<ApiError> {
  const status = response.status;
  let title = defaultStatusTitle(status);
  let detail: string | undefined;
  let errors: Record<string, string[]> | undefined;
  let rawMessage: string | undefined;
  let backendOffline: boolean | undefined;

  try {
    const text = await response.text();
    if (text.trim().length > 0) {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.title === 'string' && parsed.title.trim().length > 0) {
          title = parsed.title.trim();
        }
        if (typeof parsed.detail === 'string' && parsed.detail.trim().length > 0) {
          detail = parsed.detail.trim();
        }
        if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
          rawMessage = parsed.message.trim();
        }
        if (parsed.backendOffline === true) {
          backendOffline = true;
        }
        errors = normalizeValidationErrors(parsed.errors);
      }
    }
  } catch {
    // Empty or non-JSON response body; fall through to status defaults
  }

  const flattenedErrors = errors
    ? Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${msgs.join(' ')}`)
        .join(' ')
    : undefined;

  const message = detail || flattenedErrors || rawMessage || defaultStatusMessage(status);
  return new ApiError({ status, title, detail, errors, message, backendOffline });
}

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const headers = new Headers(fetchOptions.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && fetchOptions.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD' && cachedCsrfToken) {
    headers.set('X-CSRF-Token', cachedCsrfToken);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  try {
    const response = await fetch(`/api${normalizedPath}`, {
      ...fetchOptions,
      method,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearCsrfToken();
        if (normalizedPath !== '/login' && normalizedPath !== '/register') {
          unauthorizedHandler?.();
        }
      }
      throw await parseApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (text.trim().length === 0) {
      return undefined as T;
    }

    const data = JSON.parse(text) as T;
    if (
      normalizedPath.split('?')[0] === '/session' &&
      data &&
      typeof data === 'object' &&
      'csrfToken' in data
    ) {
      const record = data as Record<string, unknown>;
      const offline = record.backendOffline === true;
      setCsrfToken(!offline && typeof record.csrfToken === 'string' ? record.csrfToken : null);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError({
        status: 504,
        title: 'Request Timeout',
        message: 'The request timed out while contacting the backend.',
      });
    }
    throw new ApiError({
      status: 503,
      title: 'Network Error',
      message: 'Unable to reach the Nexus backend server.',
      backendOffline: true,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
