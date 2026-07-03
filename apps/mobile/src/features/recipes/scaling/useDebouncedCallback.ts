import { useCallback, useEffect, useRef } from 'react';

export interface DebouncedCallback<T> {
  /** Resets a trailing-edge timer on every call. */
  call: (value: T) => void;
  /** Cancels any pending timer and invokes immediately. */
  flush: (value: T) => void;
  /** Clears any pending timer without invoking. */
  cancel: () => void;
}

export function useDebouncedCallback<T>(
  callback: (value: T) => void,
  delayMs: number,
): DebouncedCallback<T> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const call = useCallback(
    (value: T) => {
      cancel();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        callbackRef.current(value);
      }, delayMs);
    },
    [cancel, delayMs],
  );

  const flush = useCallback(
    (value: T) => {
      cancel();
      callbackRef.current(value);
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);

  return { call, flush, cancel };
}
