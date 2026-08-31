import { useEffect, useState } from 'react';

/** Задержка перед поиском — чтобы не дёргать базу на каждую букву. */
export function useDebounce<T>(value: T, delayMs = 180): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
