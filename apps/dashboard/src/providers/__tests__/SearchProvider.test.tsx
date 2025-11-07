import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SearchProvider, SEARCH_DEBOUNCE_DELAY, useSearch } from '../SearchProvider';

describe('SearchProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <SearchProvider>{children}</SearchProvider>;
  }

  it('debounces query updates and exposes trimmed value after delay', async () => {
    const { result } = renderHook(() => useSearch(), { wrapper });

    expect(result.current.query).toBe('');
    expect(result.current.debouncedQuery).toBe('');

    act(() => {
      result.current.setQuery('  panda  ');
    });

    expect(result.current.query).toBe('  panda  ');
    expect(result.current.debouncedQuery).toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_DELAY);
    });

    expect(result.current.debouncedQuery).toBe('panda');

    act(() => {
      const committed = result.current.commitQuery(' lynx ');
      expect(committed).toBe('lynx');
    });

    expect(result.current.query).toBe('lynx');
    expect(result.current.debouncedQuery).toBe('lynx');
  });

  it('commits the latest query when no explicit value is provided', async () => {
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.setQuery('  owl  ');
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      const committed = result.current.commitQuery();
      expect(committed).toBe('owl');
    });

    expect(result.current.query).toBe('owl');
    expect(result.current.debouncedQuery).toBe('owl');
  });
});
