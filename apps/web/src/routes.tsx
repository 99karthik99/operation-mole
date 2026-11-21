import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from './components/AppShell.tsx';
import { DirectoryComparePage } from './pages/DirectoryComparePage.tsx';
import { FileComparePage } from './pages/FileComparePage.tsx';
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage.tsx';
import { SessionOverviewPage } from './pages/SessionOverviewPage.tsx';
import { SessionsPage } from './pages/SessionsPage.tsx';
import { WelcomePage } from './pages/WelcomePage.tsx';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <WelcomePage /> },
      { path: 'u/:user', element: <SessionsPage /> },
      { path: 'u/:user/s/:sessionId', element: <SessionOverviewPage /> },
      { path: 'u/:user/s/:sessionId/folders', element: <DirectoryComparePage /> },
      { path: 'u/:user/s/:sessionId/files', element: <FileComparePage /> },
      { path: 'u/:user/s/:sessionId/lab', element: <PlaceholderPage /> },
      // Links from before sessions existed.
      { path: 'directories', element: <Navigate to="/" replace /> },
      { path: 'files', element: <Navigate to="/" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
