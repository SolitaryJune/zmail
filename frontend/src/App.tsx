import React, { useContext } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/LoginPage';
import { MailboxProvider } from './contexts/MailboxContext';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

const ProtectedRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <MailboxProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </div>
    </MailboxProvider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ProtectedRoutes />
    </AuthProvider>
  );
};

export default App;
