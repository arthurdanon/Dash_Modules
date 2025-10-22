// src/PageAdmin/AdminSites.jsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import ProtectedRoute from '../Components/ProtectedRoute';
import { useAuth } from '../AuthContext';

function SitesInner() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.isAdmin;
  const isOwner = user?.role === 'OWNER' || user?.isOwner;
  // manager: accès lecture seule
  // const isManager = user?.role === 'MANAGER' || user?.isManager;

  const [name, setName] = useState('');
  const [sites, setSites] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.get('/admin/sites');
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Erreur chargement sites');
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createSite = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErr('');
    setCreating(true);
    try {
      await api.post('/admin/sites', { name: name.trim() });
      setName('');
      await load();
    } catch (e2) {
      const msg = e2?.response?.data?.error || 'Création refusée.';
      setErr(msg);
    } finally {
      setCreating(false);
    }
  };

  const del = async (id, siteName) => {
    if (!window.confirm(`Supprimer le site "${siteName}" ? Cette action est irréversible.`)) return;
    try {
      await api.delete(`/admin/sites/${id}`);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || 'Suppression refusée');
    }
  };

  const renderModules = (mods) => {
    if (!mods || typeof mods !== 'object') return '—';
    const active = Object.entries(mods)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
    return active.length ? active.join(', ') : '—';
  };

  return (
    <div className="relative z-10 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Sites</h2>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Chargement…' : 'Rafraîchir'}
          </button>
        </div>
      </div>

      {(isAdmin || isOwner) && (
        <form onSubmit={createSite} className="flex gap-3 mb-6">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nom du site"
            className="input flex-1"
          />
          <button type="submit" disabled={!name.trim() || creating} className="btn">
            {creating ? 'Création…' : 'Créer'}
          </button>
        </form>
      )}

      {err && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-3 py-2">
          {err}
        </div>
      )}

      <div className="overflow-x-auto shadow rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-2 text-left">Nom</th>
              <th className="px-4 py-2 text-left">Owners</th>
              <th className="px-4 py-2 text-left">Managers</th>
              <th className="px-4 py-2 text-left">Users</th>
              <th className="px-4 py-2 text-left">Modules actifs</th>
              <th className="px-4 py-2 text-left">Créé le</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">{s.ownersCount ?? 0}</td>
                <td className="px-4 py-2">{s.managersCount ?? 0}</td>
                <td className="px-4 py-2">{s.usersCount ?? 0}</td>
                <td className="px-4 py-2">{renderModules(s.modules)}</td>
                <td className="px-4 py-2">
                  {s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2">
                  {(isAdmin || isOwner) ? (
                    <button
                      onClick={() => del(s.id, s.name)}
                      className="text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && sites.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-zinc-500">
                  Aucun site
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-zinc-500">
                  Chargement…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!(isAdmin || isOwner) && (
        <div className="text-xs text-zinc-500 mt-3">
          La création / suppression de site est réservée aux administrateurs et propriétaires.
        </div>
      )}
    </div>
  );
}

export default function Sites() {
  // Accès page : ADMIN, OWNER, MANAGER
  return (
    <ProtectedRoute roles={['ADMIN', 'OWNER', 'MANAGER']}>
      <SitesInner />
    </ProtectedRoute>
  );
}
