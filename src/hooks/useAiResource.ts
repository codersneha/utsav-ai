import { useCallback, useRef, useState } from 'react';
import { usePersistentState } from './usePersistentState';

export type AiRequest<T> = (signal: AbortSignal) => Promise<{ value: T; notice?: string }>;

/** One AI-backed resource (ideas or logistics) with its loading state. */
export function useAiResource<T>(key: string, isValid: (v: unknown) => v is T | null) {
  const [value, setValue] = usePersistentState<T | null>(key, null, isValid);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  /** Starts a request; state only changes after it settles (safe to call from effects). */
  const run = useCallback(
    async (request: AiRequest<T>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await request(controller.signal);
        setValue(result.value);
        setNotice(result.notice);
      } catch {
        // Aborted because a newer request started.
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [setValue],
  );

  const start = useCallback(
    (request: AiRequest<T>) => {
      setLoading(true);
      setNotice(undefined);
      void run(request);
    },
    [run],
  );

  const clear = () => {
    abortRef.current?.abort();
    setValue(null);
    setLoading(false);
    setNotice(undefined);
  };

  return { value, loading, notice, start, clear };
}
