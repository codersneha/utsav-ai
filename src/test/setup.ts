import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Coverage instrumentation and axe scans slow the lazy-loaded plan view, so allow more time.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});
