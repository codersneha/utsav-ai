/**
 * Safe localStorage wrapper: storage can be unavailable (private mode,
 * blocked cookies) or contain stale data, so every access is guarded.
 */
const PREFIX = 'utsav-ai:v1:';

export function loadJson<T>(key: string, fallback: T, isValid?: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app keeps working in memory.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore.
  }
}

export const isRecordOf =
  <V>(check: (v: unknown) => v is V) =>
  (value: unknown): value is Record<string, V> =>
    typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(check);

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
