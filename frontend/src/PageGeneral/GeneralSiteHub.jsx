// src/PageGeneral/SiteHub.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ProtectedRoute from '../Components/ProtectedRoute';
import Background from '../Components/Background';

const MODULE_LABELS = {
  tasks: 'Tâches',
  stock: 'Stock',
  hr: 'Ressources humaines',
  reports: 'Rapports',
  maintenance: 'Maintenance',
};

const MODULE_ROUTES = {
  tasks: '/AdminDashboard',
  stock: '/AdminDashboard',
  hr: '/AdminDashboard',
  reports: '/AdminDashboard',
  maintenance: '/AdminDashboard',
};

function SiteHubInner() {
  const { siteId } = useParams();
  const navigate = useNavigate();

  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data } = await api.get(`/sites/${siteId}`);
        setSite(data || null);
      } catch (e) {
        setErr(e?.response?.data?.error || 'Site introuvable ou accès refusé');
        setSite(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  const activeModules = useMemo(() => {
    if (!site?.modules || typeof site.modules !== 'object') return [];
    return Object.entries(site.modules)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
  }, [site]);

  return (
    <div className="relative min-h-screen">
      <Background />

      <div className="relative px-6 py-10 md:py-14 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">
              {site?.name || 'Site'}
            </h1>
            <p className="text-zinc-200/80 mt-1">Accès aux modules activés pour ce site.</p>
          </div>
          <button className="btn-outline" onClick={() => navigate('/home')}>
            Retour
          </button>
        </div>

        {loading && <div className="text-zinc-200/80">Chargement…</div>}

        {!loading && err && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
            {err}
          </div>
        )}

        {!loading && !err && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeModules.length === 0 && (
              <div className="col-span-full text-zinc-200/80">
                Aucun module activé pour ce site.
              </div>
            )}

            {activeModules.map((key) => {
              const label = MODULE_LABELS[key] || key;
              const to = MODULE_ROUTES[key] || '#';
              return (
                <button
                  key={key}
                  onClick={() => (to !== '#' ? navigate(to) : null)}
                  className="card p-5 text-left hover:shadow-lg transition border border-white/15 bg-white/10 backdrop-blur"
                >
                  <div className="text-sm text-zinc-200/80">Module</div>
                  <div className="mt-1 text-xl font-semibold text-white">{label}</div>
                  <p className="mt-2 text-sm text-zinc-200/75">
                    {to === '#' ? 'Bientôt disponible' : 'Ouvrir le module'}
                  </p>
                  <div className="mt-4">
                    <span className="btn">{to === '#' ? 'À venir' : 'Ouvrir'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SiteHub() {
  return (
    <ProtectedRoute>
      <SiteHubInner />
    </ProtectedRoute>
  );
}
