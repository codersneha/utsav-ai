import { useEffect, useState } from 'react';
import { loadJson, saveJson } from '../lib/storage';

/**
 * useState that survives reloads via localStorage (guarded and validated).
 * `normalize` upgrades a valid stored value to the current shape, e.g. adding
 * defaults for fields introduced after the plan was saved.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  isValid?: (v: unknown) => v is T,
  normalize: (v: T) => T = (v) => v,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => normalize(loadJson(key, initial, isValid)));
  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);
  return [value, setValue];
}
