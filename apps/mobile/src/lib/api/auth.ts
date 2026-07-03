import { apiFetch } from './client';
import type { MockLoginRequest, LoginRequest, LoginResult, WhoAmI } from './types';

export function mockLogin(body: MockLoginRequest = {}) {
  return apiFetch<LoginResult>('/auth/mock-login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function login(body: LoginRequest) {
  return apiFetch<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function whoami() {
  return apiFetch<WhoAmI>('/auth/whoami');
}
