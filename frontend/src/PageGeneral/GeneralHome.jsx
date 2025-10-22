// src/PageGeneral/Home.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ProtectedRoute from '../Components/ProtectedRoute';
import Background from '../Components/Background';

function HomeInner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin   = user?.role === 'ADMIN' || user?.isAdmin;
  const isOwner   = user?.role === 'OWNER' || user?.isOwner;
  const isManager = user?.role === 'MANAGER' || user?.isManager;

  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const loadSites = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get('/sites');
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Impossible de charger les sites');
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const canAdmin = isAdmin || isOwner || isManager;

  return (
    <div className="relative min-h-screen">
      <Background />

      <div className="relative px-6 py-10 md:py-14 max-w-6xl mx-auto">
        {/* header / badge */}
        <div className="mb-8 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm shadow-soft backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-100">Connecté</span>
          </div>
          <button
            onClick={loadSites}
            className="btn-outline"
            disabled={loading}
            title="Rafraîchir"
          >
            {loading ? 'Rafraîchir…' : 'Rafraîchir'}
          </button>
        </div>

        {/* erreurs */}
        {err && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
            {err}
          </div>
        )}

        {/* grille cartes */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Tuile Administration (ADMIN/OWNER/MANAGER) */}
          {canAdmin && (
            <button
              onClick={() => navigate('/AdminDashboard')}
              className="card p-5 text-left hover:shadow-lg transition border border-white/15 bg-white/10 backdrop-blur"
            >
              <div className="text-sm text-zinc-200/80">Accès</div>
              <div className="mt-1 text-xl font-semibold text-white">Administration</div>
              <p className="mt-2 text-sm text-zinc-200/75">
                Espace Admin / Owner / Manager pour administrer la plateforme.
              </p>
              <div className="mt-4">
                <span className="btn">Ouvrir</span>
              </div>
            </button>
          )}

          {/* Tuile Paramètres généraux (ADMIN seulement) */}
          {isAdmin && (
            <button
              onClick={() => navigate('/GeneralSettings')}
              className="card p-5 text-left hover:shadow-lg transition border border-white/15 bg-white/10 backdrop-blur"
            >
              <div className="text-sm text-zinc-200/80">Admin</div>
              <div className="mt-1 text-xl font-semibold text-white">Paramètres généraux</div>
              <p className="mt-2 text-sm text-zinc-200/75">
                Définir les quotas (sites, owners, managers, users) et gérer les modules activables.
              </p>
              <div className="mt-4">
                <span className="btn">Ouvrir</span>
              </div>
            </button>
          )}

          {/* Tuiles Sites */}
          {loading && (
            <div className="col-span-full text-center text-zinc-200/80 py-10">
              Chargement des sites…
            </div>
          )}

          {!loading && sites.length === 0 && (
            <div className="col-span-full text-center text-zinc-200/80 py-10">
              Aucun site accessible pour le moment.
            </div>
          )}

          {!loading &&
            sites.map((s) => (
              <div
                key={s.id}
                className="card p-5 border border-white/15 bg-white/10 backdrop-blur"
              >
                <div className="text-sm text-zinc-200/80">Site</div>
                <div className="mt-1 text-xl font-semibold text-white">{s.name}</div>

                {/* modules (optionnel) */}
                {s.modules && typeof s.modules === 'object' && (
                  <div className="mt-2 text-xs text-zinc-200/70">
                    Modules:{' '}
                    {Object.entries(s.modules)
                      .filter(([, v]) => !!v)
                      .map(([k]) => k)
                      .join(', ') || '—'}
                  </div>
                )}

                <div className="mt-4">
                  {/* Pour l’instant on entre sur /site/${s.id} ; plus tard on pourra router par siteId */}
                  <button className="btn" onClick={() => navigate(`/site/${s.id}`)}>
                    Entrer
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* petites tuiles décoratives */}
        <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-3">
          <div className="h-24 rounded-2xl bg-gradient-to-b from-indigo-500/90 to-violet-500/90" />
          <div className="h-24 rounded-2xl bg-gradient-to-b from-emerald-400/90 to-teal-500/90" />
          <div className="h-24 rounded-2xl bg-gradient-to-b from-amber-400/90 to-orange-500/90" />
        </div>

        <div className="mt-8 text-xs text-center text-zinc-300/70">
          © {new Date().getFullYear()} TaskFlow — prêt à travailler.
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeInner />
    </ProtectedRoute>
  );
}
