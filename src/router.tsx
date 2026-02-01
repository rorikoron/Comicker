import { createRootRoute, createRoute, createRouter, RouterProvider, redirect } from '@tanstack/react-router';
import { Layout } from './components/Layout';
// Import views (placeholders for now)
import { BleedView } from './views/BleedView';
import { MergeView } from './views/MergeView';

// Root Route
const rootRoute = createRootRoute({
  component: Layout,
});

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({
      to: '/bleed',
      replace: true,
    });
  },
});

const bleedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'bleed',
  component: BleedView,
});

const mergeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'merge',
  validateSearch: (search: Record<string, unknown>): { bleededImagePath?: string } => {
    return {
      bleededImagePath: (search.bleededImagePath as string) || undefined,
    }
  },
  component: MergeView,
});


const routeTree = rootRoute.addChildren([indexRoute, bleedRoute, mergeRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export const Router = () => {
  return <RouterProvider router={router} />;
};
