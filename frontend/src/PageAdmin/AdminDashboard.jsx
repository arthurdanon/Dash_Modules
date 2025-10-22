// src/PageAdmin/AdminDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '../Components/ProtectedRoute';
import { useAuth } from '../AuthContext';
import { api } from '../api';

function StatusBadge({ invited, active }) {
  if (invited) {
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30">
        Invité
      </span>
    );
  }
  if (active) {
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
        Actif
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs rounded-full bg-zinc-500/10 text-zinc-700 border border-zinc-500/30">
      Désactivé
    </span>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin   = user?.role === 'ADMIN'   || user?.isAdmin;
  const isOwner   = user?.role === 'OWNER'   || user?.isOwner;
  const isManager = user?.role === 'MANAGER' || user?.isManager;

  const [sites, setSites] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [err, setErr] = useState('');

  const loadSites = async () => {
    setLoadingSites(true);
    try {
      const { data } = await api.get('/admin/sites');
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Erreur chargement des sites');
      setSites([]);
    } finally {
      setLoadingSites(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Erreur chargement des utilisateurs');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadSites();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const owners   = users.filter(u => (u.roleName || u.role?.name || u.role) === 'OWNER').length;
    const managers = users.filter(u => (u.roleName || u.role?.name || u.role) === 'MANAGER').length;
    const regulars = users.filter(u => (u.roleName || u.role?.name || u.role) === 'USER').length;
    const invited  = users.filter(u => !u.hasPassword).length;
    const active   = users.filter(u => !!u.isActive && !!u.hasPassword).length;
    return { sites: sites.length, owners, managers, users: regulars, invited, active };
  }, [sites, users]);

  const resendInvite = async (id) => {
    try {
      await api.post(`/admin/users/${id}/resend-invite`);
      alert('Invitation renvoyée.');
    } catch (e) {
      alert(e?.response?.data?.error || 'Envoi impossible');
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
      await loadUsers();
    } catch (e) {
      alert(e?.response?.data?.error || 'Action impossible');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => { loadSites(); loadUsers(); }} disabled={loadingSites || loadingUsers}>
            {loadingSites || loadingUsers ? 'Rafraîchissement…' : 'Rafraîchir'}
          </button>
          {(isAdmin || isOwner || isManager) && (
            <>
              <button className="btn-outline" onClick={() => navigate('/AdminUsers')}>Gérer les utilisateurs</button>
              {(isAdmin || isOwner) && (
                <button className="btn-outline" onClick={() => navigate('/AdminSites')}>Gérer les sites</button>
              )}
            </>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-3 py-2">
          {err}
        </div>
      )}

      <section className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="card p-4"><div className="text-xs text-zinc-500">Sites</div><div className="mt-1 text-2xl font-semibold">{kpis.sites}</div></div>
        <div className="card p-4"><div className="text-xs text-zinc-500">Owners</div><div className="mt-1 text-2xl font-semibold">{kpis.owners}</div></div>
        <div className="card p-4"><div className="text-xs text-zinc-500">Managers</div><div className="mt-1 text-2xl font-semibold">{kpis.managers}</div></div>
        <div className="card p-4"><div className="text-xs text-zinc-500">Utilisateurs</div><div className="mt-1 text-2xl font-semibold">{kpis.users}</div></div>
        <div className="card p-4"><div className="text-xs text-zinc-500">Invités</div><div className="mt-1 text-2xl font-semibold">{kpis.invited}</div></div>
        <div className="card p-4"><div className="text-xs text-zinc-500">Actifs</div><div className="mt-1 text-2xl font-semibold">{kpis.active}</div></div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Sites</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Managers</th>
                <th>Users</th>
                <th>Modules</th>
                <th>Créé le</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.managersCount ?? 0}</td>
                  <td>{s.usersCount ?? 0}</td>
                  <td>
                    {s.modules && typeof s.modules === 'object'
                      ? Object.entries(s.modules).filter(([, v]) => !!v).map(([k]) => k).join(', ') || '—'
                      : '—'}
                  </td>
                  <td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {sites.length === 0 && (
                <tr><td colSpan="5" className="text-center py-4 text-zinc-500">Aucun site</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Utilisateurs récents</h3>
          <button className="btn-outline" onClick={() => navigate('/AdminUsers')}>Tout voir</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Site principal</th>
                <th>Équipe</th>
                <th>Rôle</th>
                <th>Email</th>
                <th>Statut</th>
                <th style={{ minWidth: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 8).map((u) => {
                const role = u.roleName || u.role?.name || u.role || 'USER';
                const invited = !u.hasPassword;
                const active = !!u.isActive && !!u.hasPassword;
                return (
                  <tr key={u.id}>
                    <td>{u.lastName || '—'}</td>
                    <td>{u.firstName || '—'}</td>
                    <td>{u.primarySite?.name || u.site?.name || '—'}</td>
                    <td>{u.team?.name || '—'}</td>
                    <td>{role}</td>
                    <td>{u.email || '—'}</td>
                    <td><StatusBadge invited={invited} active={active} /></td>
                    <td className="flex flex-wrap gap-2">
                      <button className="btn-outline" onClick={() => navigate('/AdminUsers')}>
                        Gérer
                      </button>
                      {invited && (
                        <button className="btn-outline" onClick={() => resendInvite(u.id)}>
                          Renvoyer
                        </button>
                      )}
                      {!invited && (isAdmin || isOwner) && (
                        <button className="btn-outline" onClick={() => toggleActive(u)}>
                          {u.isActive ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan="8" className="text-center py-4 text-zinc-500">Aucun utilisateur</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute>
      <DashboardInner />
    </ProtectedRoute>
  );
}
