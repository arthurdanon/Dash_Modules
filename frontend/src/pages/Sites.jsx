// src/pages/Sites.jsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import ProtectedRoute from '../components/ProtectedRoute';

function SitesInner() {
  const [name, setName] = useState('');
  const [sites, setSites] = useState([]);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/sites');
      // On ne met plus de valeurs aléatoires : l’API fournit managersCount/usersCount
      const sitesWithCounts = data.map(s => ({
        ...s,
        tasksCount: 42, // moyenne fixe temporaire
      }));
      setSites(sitesWithCounts);
    } catch {
      setErr('Erreur chargement sites');
    }
  };

  useEffect(() => { load(); }, []);

  const createSite = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/sites', { name });
      setName('');
      load();
    } catch {
      setErr('Création site refusée (ADMIN requis)');
    }
  };

  const del = async (id) => {
    if (!window.confirm('Supprimer ce site ?')) return;
    try {
      await api.delete(`/sites/${id}`);
      load();
    } catch {
      alert('Suppression refusée (ADMIN requis ou contraintes)');
    }
  };

  return (


      <div className="relative z-10 p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Sites</h2>
          <button className="btn" onClick={load}>Rafraîchir</button>
        </div>

        <form onSubmit={createSite} className="flex gap-3 mb-6">
          <input
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder="Nom du site"
            className="input flex-1"
          />
          <button type="submit" disabled={!name} className="btn">
            Créer
          </button>
        </form>

        {err && <div className="text-red-500 mb-4">{err}</div>}

        <div className="overflow-x-auto shadow rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-2 text-left">Nom</th>
                <th className="px-4 py-2 text-left">Managers</th>
                <th className="px-4 py-2 text-left">Users</th>
                <th className="px-4 py-2 text-left">Moy. Tasks / jour</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map(s => (
                <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.managersCount ?? 0}</td>
                  <td className="px-4 py-2">{s.usersCount ?? 0}</td>
                  <td className="px-4 py-2">{s.tasksCount}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => del(s.id)}
                      className="text-red-500 hover:underline"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {sites.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-zinc-500">
                    Aucun site
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
  );
}

export default function Sites() {
  return (
    <ProtectedRoute>
      <SitesInner />
    </ProtectedRoute>
  );
}
