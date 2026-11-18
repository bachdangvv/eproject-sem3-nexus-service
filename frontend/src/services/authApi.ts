import { ApiError, type LoginInput, type SessionResponse } from '../types/nexus';
import { apiRequest, clearCsrfToken, getCsrfToken } from './apiClient';

let inFlightSessionRequest: Promise<SessionResponse> | null = null;

export async function getSession(): Promise<SessionResponse> {
  if (inFlightSessionRequest) {
    return inFlightSessionRequest;
  }

  const request = (async () => {
    const session = await apiRequest<SessionResponse>('/session');
    if (session.backendOffline) {
      throw new ApiError({
        status: 503,
        title: 'Backend Service Unavailable',
        message: 'Backend API is offline.',
        backendOffline: true,
      });
    }
    return session;
  })();

  inFlightSessionRequest = request;
  try {
    return await request;
  } finally {
    if (inFlightSessionRequest === request) {
      inFlightSessionRequest = null;
    }
  }
}

export async function login(username: string, password: string): Promise<SessionResponse> {
  if (!getCsrfToken()) {
    await getSession();
  }
  const payload: LoginInput = {
    username: username.trim(),
    password,
  };
  await apiRequest<void>('/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return getSession();
}

export async function logout(): Promise<SessionResponse> {
  if (!getCsrfToken()) {
    await getSession();
  }
  try {
    await apiRequest<void>('/logout', { method: 'POST' });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      throw error;
    }
  }
  clearCsrfToken();
  return getSession();
}
