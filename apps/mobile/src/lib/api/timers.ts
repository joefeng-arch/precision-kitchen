import { apiFetch } from './client';
import type { CreateTimerRequest, TimerView } from './types';

export function createTimer(body: CreateTimerRequest) {
  return apiFetch<TimerView>('/timers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getTimer(id: string) {
  return apiFetch<TimerView>(`/timers/${id}`);
}

export function pauseTimer(id: string) {
  return apiFetch<TimerView>(`/timers/${id}/pause`, { method: 'POST' });
}

export function resumeTimer(id: string) {
  return apiFetch<TimerView>(`/timers/${id}/resume`, { method: 'POST' });
}

export function deleteTimer(id: string) {
  return apiFetch<{ id: string }>(`/timers/${id}`, { method: 'DELETE' });
}
