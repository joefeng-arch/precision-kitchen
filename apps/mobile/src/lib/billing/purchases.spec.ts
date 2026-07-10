import Purchases from 'react-native-purchases';

import {
  configurePurchases,
  getProOffering,
  purchaseProPackage,
  restorePurchases,
  __resetForTest,
} from './purchases';

// 原生模块不进 jest：整包工厂 mock
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

const mocked = Purchases as jest.Mocked<typeof Purchases>;

describe('purchases wrapper — Expo Go/未配置永不崩', () => {
  const KEY_BACKUP = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetForTest();
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'rc_test_key';
  });
  afterAll(() => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = KEY_BACKUP;
  });

  it('无 SDK key → 返回 false 且不 configure', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    expect(await configurePurchases('u1')).toBe(false);
    expect(mocked.configure).not.toHaveBeenCalled();
  });

  it('首次 configure 带 apiKey + appUserID；同一用户不重复 configure', async () => {
    expect(await configurePurchases('u1')).toBe(true);
    expect(await configurePurchases('u1')).toBe(true);
    expect(mocked.configure).toHaveBeenCalledTimes(1);
    expect(mocked.configure).toHaveBeenCalledWith({ apiKey: 'rc_test_key', appUserID: 'u1' });
  });

  it('切换用户 → logIn 而非重复 configure', async () => {
    await configurePurchases('u1');
    await configurePurchases('u2');
    expect(mocked.configure).toHaveBeenCalledTimes(1);
    expect(mocked.logIn).toHaveBeenCalledWith('u2');
  });

  it('offerings 为空或抛错 → getProOffering 返回 null', async () => {
    await configurePurchases('u1');
    mocked.getOfferings.mockResolvedValueOnce({ current: null } as any);
    expect(await getProOffering()).toBeNull();
    mocked.getOfferings.mockRejectedValueOnce(new Error('Preview mode'));
    expect(await getProOffering()).toBeNull();
  });

  it('SDK 抛错（Expo Go Preview）→ purchase/restore 永不外抛，返回安全值', async () => {
    await configurePurchases('u1');
    mocked.purchasePackage.mockRejectedValueOnce(new Error('not supported in Expo Go'));
    expect(await purchaseProPackage({} as any)).toEqual({ hasPro: false, cancelled: false });
    mocked.restorePurchases.mockRejectedValueOnce(new Error('boom'));
    expect(await restorePurchases()).toEqual({ hasPro: false });
  });
});
