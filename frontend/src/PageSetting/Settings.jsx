// src/PageSetting/Settings.jsx
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '../Components/ProtectedRoute';
import { useAuth } from '../AuthContext';
import { api } from '../api';

function NumberField({ label, value, onChange, placeholder = 'illimité' }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-300">{label}</span>
      <input
        className="input"
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (Number.isNaN(n) || n < 0) return; // ignore entrée invalide
          onChange(n);
        }}
        min={0}
      />
    </label>
  );
}

function ModuleToggle({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="accent-black"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function GeneralSettingsInner() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.isAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  // État éditable (copie locale)
  const [form, setForm] = useState({
    id: '',
    name: '',
    maxSites: null,
    maxOwners: null,
    maxManagers: null,
    maxUsers: null,
    availableModules: {}, // { stock: true, ... }
    sites: [],            // [{id,name,modules}]
  });

  // === Load
  const load = async () => {
    setLoading(true);
    setErr('');
    setInfo('');
    try {
      // Base path serveur: app.use('/api/settings', settingsRoutes)
      const { data } = await api.get('/settings/settings-list'); // GET /api/settings/settings-list
      const arr = Array.isArray(data) ? data : [];
      const s = arr[0];
      if (s) {
        setForm({
          id: s.id,
          name: s.name || '',
          maxSites: s.maxSites ?? null,
          maxOwners: s.maxOwners ?? null,
          maxManagers: s.maxManagers ?? null,
          maxUsers: s.maxUsers ?? null,
          availableModules: s.availableModules || {},
          sites: s.sites || [],
        });
      } else {
        setForm({
          id: '',
          name: '',
          maxSites: null, maxOwners: null, maxManagers: null, maxUsers: null,
          availableModules: {},
          sites: [],
        });
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Erreur chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Liste de modules connus (dynamiques) = clés de availableModules
  const moduleKeys = useMemo(() => {
    const keys = Object.keys(form.availableModules || {});
    keys.sort();
    return keys;
  }, [form.availableModules]);

  // Ajout d’un module au catalogue “activable”
  const [newModule, setNewModule] = useState('');
  const addModuleKey = () => {
    const key = newModule.trim();
    if (!key) return;
    setForm(f => ({
      ...f,
      availableModules: { ...(f.availableModules || {}), [key]: true },
    }));
    setNewModule('');
  };

  // === Save settings (quotas + catalogue)
  const saveSettings = async () => {
    if (!form.id) {
      setErr("Aucun paramètre n'a été initialisé côté serveur.");
      return;
    }
    setSaving(true);
    setErr('');
    setInfo('');
    try {
      const payload = {
        name: form.name?.trim() || undefined,
        maxSites: form.maxSites,
        maxOwners: form.maxOwners,
        maxManagers: form.maxManagers,
        maxUsers: form.maxUsers,
        availableModules: form.availableModules || {},
      };
      await api.patch(`/settings/settings/${form.id}`, payload); // PATCH /api/settings/settings/:id
      setInfo('Paramètres sauvegardés.');
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Erreur sauvegarde des paramètres');
    } finally {
      setSaving(false);
    }
  };

  // Toggle module sur un SITE (PATCH immédiat)
  const toggleSiteModule = async (siteId, key, on) => {
    try {
      const current = (form.sites || []).find(s => s.id === siteId);
      const nextModules = { ...(current?.modules || {}) };
      nextModules[key] = !!on;

      const { data } = await api.patch(
        `/settings/settings-sites/${siteId}/modules`,
        { modules: nextModules }
      ); // PATCH /api/settings/settings-sites/:siteId/modules

      const returnedModules = (data && data.modules) ? data.modules : nextModules;

      setForm(f => ({
        ...f,
        sites: (f.sites || []).map(s => s.id === siteId ? { ...s, modules: returnedModules } : s),
      }));
      setInfo('Module du site mis à jour.');
    } catch (e) {
      setErr(e?.response?.data?.error || 'Mise à jour module site impossible');
    }
  };

  if (!isAdmin) {
    // Double protection (les routes API sont déjà protégées côté serveur)
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Paramètres (Admin)</h2>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={load} disabled={loading}>
            {loading ? 'Chargement…' : 'Rafraîchir'}
          </button>
          <button className="btn" onClick={saveSettings} disabled={saving || loading || !form.id}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-3 py-2">
          {err}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-sm px-3 py-2">
          {info}
        </div>
      )}

      {/* Bloc quotas + catalogue modules */}
      <section className="card p-5 grid gap-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Nom (client)</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom de l’organisation"
            />
          </label>

          <NumberField label="Max Sites"    value={form.maxSites}    onChange={(v) => setForm(f => ({ ...f, maxSites: v }))} />
          <NumberField label="Max Owners"   value={form.maxOwners}   onChange={(v) => setForm(f => ({ ...f, maxOwners: v }))} />
          <NumberField label="Max Managers" value={form.maxManagers} onChange={(v) => setForm(f => ({ ...f, maxManagers: v }))} />
          <NumberField label="Max Users"    value={form.maxUsers}    onChange={(v) => setForm(f => ({ ...f, maxUsers: v }))} />
        </div>

        <div className="mt-2">
          <div className="font-medium mb-2">Catalogue des modules activables</div>

          {moduleKeys.length === 0 && (
            <div className="text-sm text-zinc-500 mb-2">Aucun module déclaré.</div>
          )}

          <div className="flex flex-wrap gap-3">
            {moduleKeys.map((k) => (
              <ModuleToggle
                key={k}
                label={k}
                checked={!!form.availableModules[k]}
                onChange={(on) =>
                  setForm(f => ({ ...f, availableModules: { ...f.availableModules, [k]: on } }))
                }
              />
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="input"
              placeholder="Ajouter un module (ex: stock)"
              value={newModule}
              onChange={(e) => setNewModule(e.target.value)}
            />
            <button className="btn" type="button" onClick={addModuleKey} disabled={!newModule.trim()}>
              Ajouter
            </button>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Astuce : cocher/décocher dans ce catalogue détermine ce qui est activable pour les sites.
          </div>
        </div>
      </section>

      {/* Bloc modules par site */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Modules par site</h3>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>Site</th>
                {moduleKeys.map((k) => <th key={`head-${k}`}>{k}</th>)}
                <th>Dernière maj</th>
              </tr>
            </thead>
            <tbody>
              {(form.sites || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  {moduleKeys.map((k) => (
                    <td key={`cell-${s.id}-${k}`}>
                      <input
                        type="checkbox"
                        className="accent-black"
                        checked={!!(s.modules && s.modules[k])}
                        onChange={(e) => toggleSiteModule(s.id, k, e.target.checked)}
                      />
                    </td>
                  ))}
                  <td>{/* s.updatedAt si exposé côté API */}—</td>
                </tr>
              ))}
              {(!form.sites || form.sites.length === 0) && (
                <tr>
                  <td colSpan={1 + moduleKeys.length + 1} className="text-center py-4 text-zinc-500">
                    Aucun site
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function GeneralSettings() {
  return (
    <ProtectedRoute>
      <GeneralSettingsInner />
    </ProtectedRoute>
  );
}
