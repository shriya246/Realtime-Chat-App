/**
 * Purpose: Configures client providers and authenticated application routing.
 */

import { Navigate, BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

/**
 * Displays a quiet loading state while validating a persisted authentication session.
 *
 * @returns {JSX.Element} Loading screen.
 */
const SessionLoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">Loading...</div>
);

/**
 * Restricts nested route content to authenticated users.
 *
 * @param {{ children: import('react').ReactNode }} props - Protected page.
 * @returns {JSX.Element} Protected content or login redirect.
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SessionLoadingScreen />;
  }

  return isAuthenticated ? children : <Navigate replace to="/login" />;
};

/**
 * Prevents authenticated users from returning to login and registration.
 *
 * @param {{ children: import('react').ReactNode }} props - Guest-only page.
 * @returns {JSX.Element} Guest page or chat redirect.
 */
const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SessionLoadingScreen />;
  }

  return isAuthenticated ? <Navigate replace to="/chat" /> : children;
};

/**
 * Defines all browser routes within application contexts.
 *
 * @returns {JSX.Element} Routed application.
 */
const AppRoutes = () => (
  <Routes>
    <Route
      element={
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      }
      path="/login"
    />
    <Route
      element={
        <PublicOnlyRoute>
          <RegisterPage />
        </PublicOnlyRoute>
      }
      path="/register"
    />
    <Route
      element={
        <ProtectedRoute>
          <ChatPage />
        </ProtectedRoute>
      }
      path="/chat"
    />
    <Route element={<Navigate replace to="/chat" />} path="*" />
  </Routes>
);

/**
 * Creates the complete ChatterBox browser application.
 *
 * @returns {JSX.Element} Root application tree.
 */
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
