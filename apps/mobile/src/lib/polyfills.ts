/**
 * crypto.randomUUID 是 secure-context 限定 API（HTTPS / localhost 才有）——
 * 手机浏览器直连 http://<局域网IP>:8081 测试时不存在，expo-router 导航一调即崩
 * （getCrypto().randomUUID is not a function）。getRandomValues 不受此限制，
 * 用它补一个符合 RFC 4122 v4 的实现。原生端（Hermes）不受影响，守卫直接跳过。
 */
if (
  typeof crypto !== 'undefined' &&
  typeof crypto.randomUUID !== 'function' &&
  typeof crypto.getRandomValues === 'function'
) {
  (crypto as { randomUUID: () => string }).randomUUID = (): string => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
    return (
      h.slice(0, 4).join('') +
      '-' +
      h.slice(4, 6).join('') +
      '-' +
      h.slice(6, 8).join('') +
      '-' +
      h.slice(8, 10).join('') +
      '-' +
      h.slice(10).join('')
    );
  };
}

export {};
