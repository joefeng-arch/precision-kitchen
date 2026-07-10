import { BillingController } from './billing.controller';

function makeController() {
  const service = {
    getStatus: jest.fn().mockResolvedValue({ tier: 'user' }),
    handleRevenueCatEvent: jest.fn().mockResolvedValue({ handled: true }),
    mockUpgrade: jest.fn().mockResolvedValue({ tier: 'vip' }),
    mockDowngrade: jest.fn().mockResolvedValue({ tier: 'user' }),
  } as any;
  return { controller: new BillingController(service), service };
}

const USER = { sub: 'u1', role: 'vip' } as any;

describe('BillingController', () => {
  it('GET status → getStatus(user.sub, user.role)（有效角色）', async () => {
    const { controller, service } = makeController();
    await controller.status(USER);
    expect(service.getStatus).toHaveBeenCalledWith('u1', 'vip');
  });

  it('webhook body 原样透传 service', async () => {
    const { controller, service } = makeController();
    const body = { event: { type: 'RENEWAL' } };
    await controller.revenueCatWebhook(body);
    expect(service.handleRevenueCatEvent).toHaveBeenCalledWith(body);
  });

  it('mock 升降级各自委托对应方法', async () => {
    const { controller, service } = makeController();
    await controller.mockUpgrade(USER);
    await controller.mockDowngrade(USER);
    expect(service.mockUpgrade).toHaveBeenCalledWith('u1');
    expect(service.mockDowngrade).toHaveBeenCalledWith('u1');
  });
});
