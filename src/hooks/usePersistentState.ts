import { useEffect, useState } from 'react';
import { loadJson, saveJson } from '../lib/storage';

/** useState that survives reloads via localStorage (guarded and validated). */
export function usePersistentState<T>(
  key: string,
  initial: T,
  isValid?: (v: unknown) => v is T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => loadJson(key, initial, isValid));
  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);
  return [value, setValue];
}
