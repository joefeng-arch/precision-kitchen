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

/** 网络层失败（离线/服务不可达/非 JSON 响应）的统一友好文案；code 0 = 无 HTTP 状态 */
function networkError(path: string): ApiClientError {
  return new ApiClientError({
    code: 0,
    message: "Can't reach the server — check your connection and try again.",
    path,
    timestamp: new Date().toISOString(),
  });
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

  let response: Response;
  let payload: any;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    payload = await response.json();
  } catch {
    // fetch 的 TypeError（Failed to fetch）/ 网关吐非 JSON —— 不再裸显原始错误
    throw networkError(path);
  }

  if (!response.ok || (typeof payload?.code === 'number' && payload.code >= 400)) {
    if (payload?.code === 401) onUnauthorized?.();
    throw new ApiClientError(payload as ApiError);
  }

  return (payload as ApiResponse<T>).data;
}
