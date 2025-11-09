import { ReactElement, isValidElement } from 'react';
import { ThemeProvider } from '@mui/material';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
  type QueryKey,
  type SetDataOptions,
} from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryRouter,
  type MemoryRouterProps,
  type RouteObject,
  type Router,
} from 'react-router-dom';
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

type InitialQueryEntry = {
  queryKey: QueryKey;
  data: unknown;
  options?: SetDataOptions;
};

type RouterOverrides = Pick<MemoryRouterProps, 'initialEntries' | 'initialIndex'> & {
  routes?: RouteObject[];
};

type RouterOption = Router | RouterOverrides;

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  queryClientOptions?: QueryClientConfig;
  initialQueryData?: InitialQueryEntry[];
  router?: RouterOption;
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

function isRouter(value: RouterOption | undefined): value is Router {
  return !!value && typeof value === 'object' && 'subscribe' in value && typeof value.subscribe === 'function';
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClientOptions,
    initialQueryData,
    router: routerOption,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const mergedQueryClientOptions = mergeQueryClientConfig(
    DEFAULT_QUERY_CLIENT_CONFIG,
    queryClientOptions,
  );
  const queryClient = new QueryClient(mergedQueryClientOptions);

  for (const entry of initialQueryData ?? []) {
    queryClient.setQueryData(entry.queryKey, entry.data, entry.options);
  }

  const router = isRouter(routerOption)
    ? routerOption
    : createMemoryRouter(routerOption?.routes ?? [{ path: '/', element: ui }], {
        initialEntries: routerOption?.initialEntries,
        initialIndex: routerOption?.initialIndex,
      });

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
  propsOrElement: ListPageProps | ReactElement,
  { queryClientOptions, initialQueryData, ...options }: RenderListPageOptions = {},
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

  if (isValidElement(propsOrElement)) {
    return renderWithProviders(propsOrElement, {
      ...options,
      queryClientOptions: mergedQueryClientOptions,
      initialQueryData,
    });
  }

  return renderWithProviders(<ListPage {...propsOrElement} />, {
    ...options,
    queryClientOptions: mergedQueryClientOptions,
    initialQueryData,
  });
}

export type { ListPageProps };
export { default as userEvent } from '@testing-library/user-event';
export { createMemoryRouter } from 'react-router-dom';
