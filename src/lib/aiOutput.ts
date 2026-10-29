import { cleanText } from './validation.js';

/**
 * Helpers for treating LLM output as untrusted input: parse defensively,
 * type-check every field, cap lengths and strip markup.
 */

/** Parses a JSON string (or passes through an object); null if unusable. */
export function toObject(raw: unknown): Record<string, unknown> | null {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

/** Keeps non-empty, cleaned strings from an array, up to `maxItems`. */
export function cleanList(value: unknown, maxItems: number, maxLength = 220): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => cleanText(v, maxLength))
    .filter((v) => v.length > 0)
    .slice(0, maxItems);
}

/** Maps an array of untrusted objects through `pick`, dropping nulls. */
export function cleanObjects<T>(
  value: unknown,
  maxItems: number,
  pick: (o: Record<string, unknown>) => T | null,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'object' && v !== null ? pick(v as Record<string, unknown>) : null))
    .filter((v): v is T => v !== null)
    .slice(0, maxItems);
}
