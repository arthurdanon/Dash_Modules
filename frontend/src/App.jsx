import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/Nav';
import Home from './pages/Home';
import Sites from './pages/Sites';
import Users from './pages/Users';
import Tasks from './pages/Tasks';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  const { pathname } = useLocation();
  // Cacher la navbar sur /home et /login
  const showNav = pathname !== '/home' && pathname !== '/login';

  return (
    <>
      {showNav && <Nav />}

      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protégées */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sites"
          element={
            <ProtectedRoute>
              <Sites />
            </ProtectedRoute>
          }
        />

        {/* Défault: aller au login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
