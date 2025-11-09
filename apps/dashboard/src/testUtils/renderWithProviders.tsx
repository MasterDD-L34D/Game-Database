import { ReactElement } from 'react';
import { ThemeProvider } from '@mui/material';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter, type Router } from 'react-router-dom';
import ListPage from '../pages/ListPage';
import { SearchProvider } from '../providers/SearchProvider';
import { SnackbarProvider } from '../components/SnackbarProvider';
import { theme } from '../theme';

const DEFAULT_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  },
};

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  queryClientOptions?: QueryClientConfig;
  router?: Router;
};

export type RenderWithProvidersResult = RenderResult & {
  queryClient: QueryClient;
  router: Router;
};

function mergeQueryClientConfig(
  base: QueryClientConfig,
  override?: QueryClientConfig,
): QueryClientConfig {
  const baseQueries = base.defaultOptions?.queries
    ? { ...base.defaultOptions.queries }
    : undefined;
  const baseMutations = base.defaultOptions?.mutations
    ? { ...base.defaultOptions.mutations }
    : undefined;

  if (!override) {
    return {
      ...base,
      defaultOptions: {
        ...base.defaultOptions,
        queries: baseQueries,
        mutations: baseMutations,
      },
    };
  }

  const overrideQueries = override.defaultOptions?.queries
    ? { ...override.defaultOptions.queries }
    : undefined;
  const overrideMutations = override.defaultOptions?.mutations
    ? { ...override.defaultOptions.mutations }
    : undefined;

  return {
    ...base,
    ...override,
    defaultOptions: {
      ...base.defaultOptions,
      ...override.defaultOptions,
      queries: {
        ...baseQueries,
        ...overrideQueries,
      },
      mutations: {
        ...baseMutations,
        ...overrideMutations,
      },
    },
  };
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClientOptions, router: providedRouter, ...renderOptions }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const mergedQueryClientOptions = mergeQueryClientConfig(
    DEFAULT_QUERY_CLIENT_CONFIG,
    queryClientOptions,
  );
  const queryClient = new QueryClient(mergedQueryClientOptions);

  const router = providedRouter ?? createMemoryRouter([
    { path: '/', element: ui },
  ]);

  const result = render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <SearchProvider>
            <RouterProvider router={router} />
          </SearchProvider>
        </SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>,
    renderOptions,
  );

  return Object.assign(result, { queryClient, router });
}

type ListPageProps = Parameters<typeof ListPage>[0];

export type RenderListPageOptions = RenderWithProvidersOptions;

export function renderListPage(
  props: ListPageProps,
  { queryClientOptions, ...options }: RenderListPageOptions = {},
): RenderWithProvidersResult {
  const mergedQueryClientOptions = mergeQueryClientConfig(
    {
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    },
    queryClientOptions,
  );

  return renderWithProviders(<ListPage {...props} />, {
    ...options,
    queryClientOptions: mergedQueryClientOptions,
  });
}

export type { ListPageProps };
export { default as userEvent } from '@testing-library/user-event';
