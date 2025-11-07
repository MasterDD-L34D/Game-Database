import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type SearchContextValue = {
  query: string;
  debouncedQuery: string;
  setQuery: (value: string) => void;
  commitQuery: (value?: string) => string;
};

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

const DEBOUNCE_DELAY = 350;

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const latestQueryRef = useRef(query);

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === debouncedQuery) return;
    const handle = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(handle);
  }, [query, debouncedQuery]);

  const setQuery = useCallback((value: string) => {
    latestQueryRef.current = value;
    setQueryState(value);
  }, []);

  const commitQuery = useCallback((value?: string) => {
    const base = value ?? latestQueryRef.current;
    const trimmed = base.trim();
    latestQueryRef.current = trimmed;
    setQueryState((prev) => (prev === trimmed ? prev : trimmed));
    setDebouncedQuery((prev) => (prev === trimmed ? prev : trimmed));
    return trimmed;
  }, []);

  const value = useMemo<SearchContextValue>(
    () => ({
      query,
      debouncedQuery,
      setQuery,
      commitQuery,
    }),
    [query, debouncedQuery, setQuery, commitQuery],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

export const SEARCH_DEBOUNCE_DELAY = DEBOUNCE_DELAY;
