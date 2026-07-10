import { useEffect, useState } from 'react';

/** 尾沿 debounce 一个值：value 停止变化 delayMs 后才写入返回值（首个值立即生效）。 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
