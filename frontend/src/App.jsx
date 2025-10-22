// src/App.jsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Nav from './Components/Nav';
import ProtectedRoute from './Components/ProtectedRoute';

import AuthLogin from './PageAuth/AuthLogin';
import AuthSetPassword from './PageAuth/AuthSetPassword';
import AuthResetPassword from './PageAuth/AuthResetPassword';

import AdminDashboard from './PageAdmin/AdminDashboard';
import AdminSites from './PageAdmin/AdminSites';
import AdminUsers from './PageAdmin/AdminUsers';

import GeneralHome from './PageGeneral/GeneralHome';
import GeneralSiteHub from './PageGeneral/GeneralSiteHub';

import GeneralSettings from './PageSetting/Settings';


export default function App() {
  const { pathname } = useLocation();

  // cacher la navbar sur : home/login/set/reset + toutes les pages site (/site/:id)
  const hideNav =
    pathname === '/home' ||
    pathname === '/login' ||
    pathname === '/set-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/site/');

  return (
    <>
      {!hideNav && <Nav />}

      <Routes>
        {/* Public */}
        <Route path="/login" element={<AuthLogin />} />
        <Route path="/set-password" element={<AuthSetPassword />} />
        <Route path="/reset-password" element={<AuthResetPassword />} />

        {/* Protégées */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <GeneralHome />
            </ProtectedRoute>
          }
        />

        {/* Dashboard d’administration (admin/owner/manager) */}
        <Route
          path="/AdminDashboard"
          element={
            <ProtectedRoute roles={['ADMIN', 'OWNER', 'MANAGER']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/AdminUsers"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/Adminsites"
          element={
            <ProtectedRoute>
              <AdminSites />
            </ProtectedRoute>
          }
        />

        {/* Réglages généraux — ADMIN uniquement */}
        <Route
          path="/GeneralSettings"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <GeneralSettings />
            </ProtectedRoute>
          }
        />

        {/* Hub d’un site (pas de navbar) */}
        <Route
          path="/site/:siteId"
          element={
            <ProtectedRoute>
              <GeneralSiteHub />
            </ProtectedRoute>
          }
        />

        {/* Default */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
