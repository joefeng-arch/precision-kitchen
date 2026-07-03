import { ApiClientError } from './errors';
import type { ApiError, ApiResponse } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

let getAuthToken: () => string | null = () => null;

export function setAuthTokenGetter(getter: () => string | null) {
  getAuthToken = getter;
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const payload = await response.json();

  if (!response.ok || (typeof payload?.code === 'number' && payload.code >= 400)) {
    if (payload?.code === 401) onUnauthorized?.();
    throw new ApiClientError(payload as ApiError);
  }

  return (payload as ApiResponse<T>).data;
}
