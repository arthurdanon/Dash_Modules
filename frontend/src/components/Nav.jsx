// src/components/Nav.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useEffect, useState } from 'react';
import {
  FiList, FiUsers, FiMapPin, FiLogOut, FiLogIn, FiSun, FiMoon,
  FiBriefcase, FiSettings
} from 'react-icons/fi';

/* ------ Modale de confirmation -------- */
function ConfirmModal({ open, title = 'Confirmer', message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="card w-full max-w-md p-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
          <div className="mt-4 flex gap-2 justify-end">
            <button className="btn-outline" onClick={onCancel}>Annuler</button>
            <button className="btn" onClick={onConfirm}>Oui, se déconnecter</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Nav() {
  const { user, logout } = useAuth();

  // rôle en string prioritaire (nouveau back) puis compat anciens champs
  const roleStr =
    (user?.role && String(user.role)) ||
    (user?.roleName && String(user.roleName)) ||
    (user?.role?.name && String(user.role.name)) ||
    '—';

  const isAdmin   = roleStr === 'ADMIN';
  const isOwner   = roleStr === 'OWNER';
  const isManager = roleStr === 'MANAGER';

  const roleLabel = roleStr;

  const [isDark, setIsDark] = useState(false);
  const [askLogout, setAskLogout] = useState(false);

  // thème initial depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const c = document.documentElement.classList;
    c.toggle('dark');
    const on = c.contains('dark');
    localStorage.setItem('theme', on ? 'dark' : 'light');
    setIsDark(on);
  };

  const confirmLogout = () => setAskLogout(true);
  const cancelLogout = () => setAskLogout(false);
  const doLogout = () => { setAskLogout(false); logout(); };

  return (
    <>
      {/* NAV UNIQUE : bas sur mobile, haut sur desktop */}
      <nav
        className="
          fixed bottom-0 left-0 right-0 z-40
          border-t border-zinc-200 dark:border-zinc-800
          bg-white/90 dark:bg-zinc-900/90 backdrop-blur
          md:static md:top-0 md:border-b md:border-t-0
        "
      >
        <div
          className="
            mx-auto w-full max-w-6xl
            flex items-center gap-2
            px-2 md:px-3
            py-2
          "
        >
          {/* Liens */}
          <div className="flex items-center gap-3">
            <Link
              to="/tasks"
              className="flex items-center gap-2 text-sm md:text-base text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
            >
              <FiList className="text-lg" />
              <span className="hidden md:inline">Tasks</span>
            </Link>

            {(isAdmin || isOwner || isManager) && (
              <Link
                to="/users"
                className="flex items-center gap-2 text-sm md:text-base text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
              >
                <FiUsers className="text-lg" />
                <span className="hidden md:inline">Users</span>
              </Link>
            )}

            {/* Sites pour Admin & Owner (on garde la règle d’origine) */}
            {(isAdmin || isOwner) && (
              <Link
                to="/sites"
                className="flex items-center gap-2 text-sm md:text-base text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
              >
                <FiMapPin className="text-lg" />
                <span className="hidden md:inline">Sites</span>
              </Link>
            )}

            {/* Onglets "admin" — désormais visibles pour ADMIN, OWNER et MANAGER */}
            {(isAdmin || isOwner || isManager) && (
              <>
                <Link
                  to="/admin/owners"
                  className="flex items-center gap-2 text-sm md:text-base text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
                >
                  <FiBriefcase className="text-lg" />
                  <span className="hidden md:inline">Owners</span>
                </Link>
                <Link
                  to="/admin/plans"
                  className="flex items-center gap-2 text-sm md:text-base text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
                >
                  <FiSettings className="text-lg" />
                  <span className="hidden md:inline">Plans</span>
                </Link>
              </>
            )}
          </div>

          {/* Groupe à droite — collé au bord droit */}
          <div className="ml-auto flex items-center gap-2 md:gap-3 pr-1 md:pr-0">
            {/* Nom + rôle toujours affichés */}
            {user && (
              <span className="truncate max-w-[46vw] md:max-w-none text-xs md:text-sm text-zinc-700 dark:text-zinc-300">
                {user.username} <span className="opacity-70">({roleLabel})</span>
              </span>
            )}

            {/* Toggle Theme */}
            <button
              onClick={toggleTheme}
              aria-label="Basculer le thème"
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Thème"
            >
              {isDark ? <FiSun /> : <FiMoon />}
            </button>

            {/* Auth */}
            {user ? (
              <button
                onClick={confirmLogout}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              >
                <FiLogOut className="text-red-600" />
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
              >
                <FiLogIn /> Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Modale de confirmation de déconnexion */}
      <ConfirmModal
        open={askLogout}
        title="Déconnexion"
        message="Voulez-vous vraiment vous déconnecter ?"
        onConfirm={doLogout}
        onCancel={cancelLogout}
      />
    </>
  );
}
