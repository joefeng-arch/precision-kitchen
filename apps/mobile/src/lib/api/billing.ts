import { apiFetch } from './client';
import type { BillingStatus } from './types';

export function getBillingStatus() {
  return apiFetch<BillingStatus>('/billing/status');
}

/** dev 专用（服务端受 ALLOW_MOCK_LOGIN 控制）：不依赖真实购买本地测 PRO */
export function mockUpgrade() {
  return apiFetch<BillingStatus>('/billing/mock-upgrade', { method: 'POST' });
}

export function mockDowngrade() {
  return apiFetch<BillingStatus>('/billing/mock-downgrade', { method: 'POST' });
}
