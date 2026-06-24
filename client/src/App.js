import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';

import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PublicRoute from './components/Auth/PublicRoute';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import ReportIssuePage from './pages/ReportIssuePage';
import IssuesPage from './pages/IssuesPage';
import IssueDetailPage from './pages/IssueDetailPage';
import MapPage from './pages/MapPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import UserTimeline from './pages/UserTimeline';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  const { i18n } = useTranslation();

  // Set document title based on language
  React.useEffect(() => {
    document.title = 'FixmyStreet - ' + i18n.t('navigation.home');
  }, [i18n]);

  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
              <Route path="/map" element={<PublicRoute><MapPage /></PublicRoute>} />
              
              {/* Protected Routes */}
              <Route path="/report" element={<ProtectedRoute><ReportIssuePage /></ProtectedRoute>} />
              <Route path="/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />
              <Route path="/issues/:id" element={<ProtectedRoute><IssueDetailPage /></ProtectedRoute>} />
              <Route path="/my-issues" element={<ProtectedRoute><UserTimeline /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute admin><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/issues/:id" element={<ProtectedRoute admin><IssueDetailPage /></ProtectedRoute>} />
              
              {/* 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
