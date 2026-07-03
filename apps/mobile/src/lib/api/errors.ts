import type { ApiError } from './types';

export class ApiClientError extends Error {
  code: number;
  errors?: string[];
  path: string;

  constructor(payload: ApiError) {
    super(payload.message);
    this.name = 'ApiClientError';
    this.code = payload.code;
    this.errors = payload.errors;
    this.path = payload.path;
  }
}
