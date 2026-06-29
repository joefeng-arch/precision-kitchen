import { ContentCheckService } from './content.service';

describe('ContentCheckService (no-op 海外实现)', () => {
  const svc = new ContentCheckService();

  it('checkText 一律放行', async () => {
    await expect(svc.checkText('任意文本')).resolves.toEqual({ safe: true });
  });

  it('checkImage 一律放行', async () => {
    await expect(svc.checkImage('/tmp/whatever.png')).resolves.toEqual({ safe: true });
  });
});
