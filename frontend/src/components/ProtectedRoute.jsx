// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function ProtectedRoute({ children, roles = [], predicate }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si des rôles sont exigés
  if (roles.length > 0) {
    const wanted = roles.map(r => String(r).toUpperCase());
    const myRole = String(user?.role || '').toUpperCase();
    const byName = wanted.includes(myRole);

    // Compat: flags booléens éventuels
    const byFlags =
      (wanted.includes('ADMIN') && user?.isAdmin) ||
      (wanted.includes('OWNER') && user?.isOwner) ||
      (wanted.includes('MANAGER') && user?.isManager);

    if (!byName && !byFlags) {
      // Interdit → redirige vers /home
      return <Navigate to="/home" replace />;
    }
  }

  // Predicate optionnel (ex: predicate={(u)=>u.id===...})
  if (typeof predicate === 'function' && !predicate(user)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
