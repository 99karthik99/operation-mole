import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { routes } from '../routes.tsx';

/** Renders the full app at `url` with an isolated router and query cache. */
export function renderApp(url: string) {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const location = () => router.state.location;
  const search = () => new URLSearchParams(router.state.location.search);
  return { ...view, router, location, search };
}
