import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import ProtectedRoute from '../Components/ProtectedRoute';
import { useAuth } from '../AuthContext';

/* --------------------------- Modale générique --------------------------- */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="card w-full max-w-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button className="btn-outline text-sm px-3 py-1" onClick={onClose}>Fermer</button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Modale création d'équipe ---------------------- */
function CreateTeamModal({ open, onClose, siteId, afterCreate }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (!open) { setName(''); setErr(''); } }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api.post(`/admin/sites/${siteId}/teams`, { name: name.trim() });
      afterCreate?.(name.trim());
      onClose();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Création impossible');
    }
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle équipe">
      <form onSubmit={submit} className="grid gap-3">
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Nom de l'équipe" autoFocus />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div className="flex gap-2">
          <button className="btn" type="submit" disabled={!name.trim()}>Créer</button>
          <button className="btn-outline" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------- Modale création d’un user ---------------------- */
function CreateUserModal({ open, onClose, me, stats, afterCreate }) {
  const [sites, setSites] = useState([]);
  const [roles, setRoles] = useState([]); // ["ADMIN","OWNER","MANAGER","USER"]
  const [teams, setTeams] = useState([]);

  const [form, setForm] = useState({
    siteId: '',
    role: 'USER',
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    teamId: '',
  });

  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [teamModal, setTeamModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const isAdmin = me?.role === 'ADMIN';
  const isOwner = me?.role === 'OWNER';
  const isManager = me?.role === 'MANAGER';

  const selRole = String(form.role || 'USER').toUpperCase();

  const usedForRole  = stats?.counts?.[selRole] ?? 0;
  const limitForRole = stats?.limits?.[selRole] ?? null;
  const quotaBlocked = limitForRole != null && usedForRole >= limitForRole;

  useEffect(() => {
    if (!open) return;
    (async () => {
      setErr(''); setInfo('');
      try {
        const [rRes, sRes] = await Promise.all([
          api.get('/roles'),
          api.get('/admin/sites'),
        ]);
        setRoles(rRes.data || []);
        const sitesData = Array.isArray(sRes.data) ? sRes.data : [];
        setSites(sitesData);

        setForm(f => {
          const next = { ...f };
          if (!f.siteId && sitesData[0]?.id) next.siteId = sitesData[0].id;
          if (!f.role) next.role = 'USER';
          return next;
        });
      } catch {
        setErr('Erreur chargement sites/rôles');
      }
    })();
  }, [open]);

  // charger les équipes du site sélectionné (inutile pour OWNER/ADMIN)
  useEffect(() => {
    const sid = form.siteId;
    if (!open || !sid || selRole === 'OWNER' || selRole === 'ADMIN') return;
    (async () => {
      try {
        const { data } = await api.get(`/admin/sites/${sid}/teams`);
        setTeams(data || []);
      } catch {
        setTeams([]);
      }
    })();
  }, [open, form.siteId, selRole]);

  const roleOptions = useMemo(() => {
    if (isAdmin) return roles;                     // ADMIN peut créer ADMIN
    if (isOwner) return roles.filter(r => r !== 'ADMIN');
    if (isManager) return roles.filter(r => r === 'USER');
    return [];
  }, [roles, isAdmin, isOwner, isManager]);

  // si OWNER/ADMIN, on cache site/team
  useEffect(() => {
    if (!open) return;
    if (selRole === 'OWNER' || selRole === 'ADMIN') {
      setForm(f => ({ ...f, teamId: '' }));
    }
  }, [selRole, open]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo('');

    if (quotaBlocked) {
      setErr('Quota atteint pour ce rôle.');
      return;
    }
    const { firstName, lastName, username, email, teamId } = form;
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim()) {
      setErr('Champs requis manquants');
      return;
    }

    // Pour OWNER/ADMIN, le backend ignorera le rattachement de site, mais l’URL exige un :siteId
    const effectiveSiteId =
      (selRole === 'OWNER' || selRole === 'ADMIN')
        ? (me?.primarySiteId || sites[0]?.id || '')
        : form.siteId;

    if (!effectiveSiteId) {
      setErr('Aucun site disponible pour effectuer la création.');
      return;
    }

    try {
      setCreating(true);
      await api.post(`/admin/sites/${effectiveSiteId}/users`, {
        role: selRole,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        // OWNER/ADMIN: pas d’équipe
        teamId: (selRole === 'OWNER' || selRole === 'ADMIN') ? undefined : (teamId || undefined),
      });
      setInfo(`Invitation envoyée à ${email}`);
      setForm(f => ({ ...f, firstName: '', lastName: '', username: '', email: '' }));
      afterCreate?.();
      onClose?.();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Création refusée (droits/valeurs).');
    } finally {
      setCreating(false);
    }
  };

  const onTeamCreated = async (createdName) => {
    try {
      const sid = form.siteId;
      if (!sid) return;
      const { data } = await api.get(`/admin/sites/${sid}/teams`);
      setTeams(data || []);
      const t = (data || []).find(x => x.name === createdName);
      if (t) setForm(f => ({ ...f, teamId: t.id }));
    } catch { /* noop */ }
  };

  const QuotaBadge = ({ used, limit }) => (
    <div className="text-xs mt-1">
      {limit == null ? (
        <span className="px-2 py-1 rounded-full border border-emerald-400/40 text-emerald-300 bg-emerald-500/10">
          Quota : illimité
        </span>
      ) : (
        <span className={`px-2 py-1 rounded-full border ${used >= limit ? 'border-red-400/40 text-red-300 bg-red-500/10' : 'border-amber-400/40 text-amber-200 bg-amber-500/10'}`}>
          {used} / {limit}
        </span>
      )}
    </div>
  );

  const showSiteTeam = selRole !== 'OWNER' && selRole !== 'ADMIN';
  const requiredOk = form.firstName.trim() && form.lastName.trim() && form.username.trim() && form.email.trim();
  const siteOk = showSiteTeam ? !!form.siteId : true;
  const canSubmit = !!selRole && requiredOk && siteOk && !quotaBlocked && !creating;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Créer un utilisateur">
        <form onSubmit={submit} className="grid gap-3">
          {/* Rôle + quota */}
          <div>
            <select
              className="select w-full"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              required
            >
              {roleOptions.length === 0 && <option value="">Aucun rôle disponible</option>}
              {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <QuotaBadge used={usedForRole} limit={limitForRole} />
            {quotaBlocked && (
              <div className="text-red-500 text-xs mt-1">
                Vous avez atteint la limite de {selRole}.
              </div>
            )}
          </div>

          {/* Site & équipe — masqués pour OWNER/ADMIN */}
          {showSiteTeam && (
            <>
              <select
                className="select"
                value={form.siteId}
                onChange={e => setForm(f => ({ ...f, siteId: e.target.value, teamId: '' }))}
                required
              >
                {sites.length === 0 && <option value="">Aucun site</option>}
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select className="select" value={form.teamId}
                        onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
                  <option value="">— Aucune équipe —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setTeamModal(true)}
                  disabled={!form.siteId}
                >
                  + Équipe
                </button>
              </div>
            </>
          )}

          {/* Identité */}
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input" value={form.firstName}
                   onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Prénom" required />
            <input className="input" value={form.lastName}
                   onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Nom" required />
          </div>

          <input className="input" value={form.username}
                 onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username (login)" required />

          <input className="input" type="email" value={form.email}
                 onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email" required />

          {err && <div className="text-red-600 text-sm">{err}</div>}
          {info && <div className="text-emerald-600 text-sm">{info}</div>}

          <div className="flex gap-2">
            <button className="btn" type="submit" disabled={!canSubmit}>Créer</button>
            <button className="btn-outline" type="button" onClick={onClose}>Fermer</button>
          </div>
        </form>
      </Modal>

      <CreateTeamModal
        open={teamModal}
        onClose={() => setTeamModal(false)}
        siteId={form.siteId}
        afterCreate={onTeamCreated}
      />
    </>
  );
}

/* -------------------------- Modale édition user ------------------------- */
function EditUserModal({ open, onClose, userId, me, afterSave }) {
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const [detail, setDetail] = useState(null);
  const [membershipIds, setMembershipIds] = useState([]);
  const [form, setForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'USER',
    isActive: false,
    primarySiteId: '',
    teamId: '',
  });

  const isAdmin = me?.role === 'ADMIN';
  const isOwner = me?.role === 'OWNER';
  const isManager = me?.role === 'MANAGER';

  useEffect(() => {
    const run = async () => {
      if (!open || !userId) return;
      setErr(''); setInfo('');
      setLoading(true);
      try {
        const [rRes, sRes, uRes] = await Promise.all([
          api.get('/roles'),
          api.get('/admin/sites'),
          api.get(`/admin/users/${userId}/detail`),
        ]);
        const allRoles = rRes.data || [];
        const allSites = sRes.data || [];
        const { user, membershipSiteIds } = uRes.data || {};
        setRoles(allRoles);
        setSites(allSites);
        setDetail(user || null);
        setMembershipIds(membershipSiteIds || []);
        const roleName = user?.role?.name || user?.role || 'USER';
        setForm({
          username: user?.username || '',
          email: user?.email || '',
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          role: roleName,
          isActive: !!user?.isActive,
          primarySiteId: user?.primarySiteId || '',
          teamId: user?.teamId || '',
        });
        if (user?.primarySiteId) {
          const tRes = await api.get(`/admin/sites/${user.primarySiteId}/teams`);
          setTeams(tRes.data || []);
        } else {
          setTeams([]);
        }
      } catch (e) {
        setErr(e?.response?.data?.error || 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [open, userId]);

  useEffect(() => {
    if (!open || !form.primarySiteId) return;
    (async () => {
      try {
        const { data } = await api.get(`/admin/sites/${form.primarySiteId}/teams`);
        setTeams(data || []);
      } catch {
        setTeams([]);
      }
    })();
  }, [open, form.primarySiteId]);

  const roleOptions = useMemo(() => {
    if (isAdmin) return roles;
    if (isOwner) return roles.filter(r => r !== 'ADMIN');
    if (isManager) return roles.filter(r => r === 'USER');
    return [];
  }, [roles, isAdmin, isOwner, isManager]);

  const toggleMembership = (siteId) => {
    setMembershipIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const save = async () => {
    setErr(''); setInfo('');
    try {
      const baseIds = (detail?.membershipSiteIds || []);
      const baseSet = new Set(baseIds);
      const currentSet = new Set(membershipIds);
      const addSites = [...currentSet].filter(id => !baseSet.has(id));
      const removeSites = [...baseSet].filter(id => !currentSet.has(id));

      const safeActive = detail?.hasPassword ? !!form.isActive : false;

      await api.patch(`/admin/users/${detail.id}`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
        isActive: safeActive,
        primarySiteId: form.primarySiteId || null,
        teamId: form.teamId || null,
        addSites,
        removeSites,
      });
      setInfo('Utilisateur mis à jour.');
      afterSave?.();
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Enregistrement impossible');
    }
  };

  const resendInvite = async () => {
    setErr(''); setInfo('');
    try {
      await api.post(`/admin/users/${detail.id}/resend-invite`);
      setInfo('Lien d’activation renvoyé.');
    } catch (e) {
      setErr(e?.response?.data?.error || 'Envoi impossible');
    }
  };

  if (!open) return null;

  const invited = !!detail && !detail.hasPassword;

  return (
    <Modal open={open} onClose={onClose} title="Modifier l’utilisateur">
      {loading ? (
        <div className="text-sm text-zinc-500">Chargement…</div>
      ) : detail ? (
        <div className="grid gap-3">
          {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 text-sm px-3 py-2">{err}</div>}
          {info && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-sm px-3 py-2">{info}</div>}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs opacity-70">Prénom</label>
              <input className="input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}/>
            </div>
            <div>
              <label className="text-xs opacity-70">Nom</label>
              <input className="input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}/>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs opacity-70">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
            </div>
            <div>
              <label className="text-xs opacity-70">Username (verrouillé)</label>
              <input className="input opacity-70" value={form.username} readOnly disabled />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs opacity-70">Rôle</label>
              <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="text-xs opacity-70 w-full">Statut</label>
              <div className="flex items-center gap-2">
                <input
                  id="activeToggle"
                  type="checkbox"
                  checked={form.isActive && !invited}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  disabled={invited}
                />
                <label htmlFor="activeToggle" className={`text-sm ${invited ? 'opacity-60' : ''}`}>
                  Actif {invited && <span className="text-xs opacity-70">(définit un mot de passe d’abord)</span>}
                </label>
                {invited && (
                  <button type="button" className="btn-outline ml-2" onClick={resendInvite}>
                    Renvoyer l’invitation
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs opacity-70">Site principal</label>
              <select
                className="select"
                value={form.primarySiteId || ''}
                onChange={e => setForm(f => ({ ...f, primarySiteId: e.target.value, teamId: '' }))}
              >
                <option value="">— Aucun —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs opacity-70">Équipe (du site principal)</label>
              <select
                className="select"
                value={form.teamId || ''}
                onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
                disabled={!form.primarySiteId}
              >
                <option value="">— Aucune —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs opacity-70 mb-1">Accès aux sites</div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-40 overflow-auto p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
              {sites.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={membershipIds.includes(s.id)}
                    onChange={() => toggleMembership(s.id)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
              {sites.length === 0 && <div className="text-xs opacity-70">Aucun site</div>}
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-2">
            <button className="btn-outline" onClick={onClose}>Annuler</button>
            <button className="btn" onClick={save}>Enregistrer</button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-zinc-500">Utilisateur introuvable.</div>
      )}
    </Modal>
  );
}

/* ------------------------------- Page Users ------------------------------ */
function UsersInner() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [openUserModal, setOpenUserModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [info, setInfo] = useState('');

  const [stats, setStats] = useState(null);
  const loadStats = async () => {
    try {
      const { data } = await api.get('/admin/users/stats');
      setStats(data || null);
    } catch {
      setStats(null);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => { loadUsers(); loadStats(); }, []);

  const delUser = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      await Promise.all([loadUsers(), loadStats()]);
    } catch (e) {
      alert(e?.response?.data?.error || 'Suppression refusée');
    }
  };

  const resendInvite = async (id) => {
    setInfo('');
    try {
      await api.post(`/admin/users/${id}/resend-invite`);
      setInfo('Lien d’activation renvoyé.');
    } catch (e) {
      alert(e?.response?.data?.error || 'Envoi impossible');
    }
  };

  const StatCard = ({ title, used, limit }) => {
    const lim = (limit == null) ? '∞' : String(limit);
    return (
      <div className="card p-4 border border-white/15 bg-white/10 backdrop-blur">
        <div className="text-xs text-zinc-200/80">{title}</div>
        <div className="mt-1 text-2xl font-semibold text-white">
          {used} <span className="text-base text-zinc-300">/ {lim}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl p-4 grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Utilisateurs</h2>
        <div className="flex items-center gap-2">
          <button className="btn-outline" onClick={() => { loadUsers(); loadStats(); }}>Rafraîchir</button>
          <button className="btn" onClick={() => setOpenUserModal(true)}>Nouvel utilisateur</button>
        </div>
      </div>

      {/* 3 encarts stats */}
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard title="Owners"   used={stats?.counts?.OWNER ?? 0}   limit={stats?.limits?.OWNER ?? null} />
        <StatCard title="Managers" used={stats?.counts?.MANAGER ?? 0} limit={stats?.limits?.MANAGER ?? null} />
        <StatCard title="Users"    used={stats?.counts?.USER ?? 0}    limit={stats?.limits?.USER ?? null} />
      </div>

      {info && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-sm px-3 py-2">
          {info}
        </div>
      )}

      <section className="card p-4">
        <div className="overflow-auto mt-1">
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
                <th style={{ minWidth: 260 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isInvited = !u.hasPassword;
                const isActive = !!u.isActive && !isInvited;
                return (
                  <tr key={u.id}>
                    <td>{u.lastName || '—'}</td>
                    <td>{u.firstName || '—'}</td>
                    <td>{u.primarySite?.name || u.site?.name || '—'}</td>
                    <td>{u.team?.name || '—'}</td>
                    <td>{u.roleName || u.role?.name || u.role || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>
                      {isInvited ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30">
                          Invité
                        </span>
                      ) : isActive ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-zinc-500/10 text-zinc-700 border border-zinc-500/30">
                          Désactivé
                        </span>
                      )}
                    </td>
                    <td className="flex gap-2">
                      <button className="btn-outline" onClick={() => setEditId(u.id)}>
                        Modifier
                      </button>
                      <button className="btn-outline" onClick={() => delUser(u.id)}>
                        Supprimer
                      </button>
                      {isInvited && (
                        <button className="btn-outline" onClick={() => resendInvite(u.id)}>
                          Renvoyer
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

      <CreateUserModal
        open={openUserModal}
        onClose={() => setOpenUserModal(false)}
        me={me}
        stats={stats}
        afterCreate={() => { loadUsers(); loadStats(); }}
      />

      <EditUserModal
        open={!!editId}
        onClose={() => setEditId(null)}
        userId={editId}
        me={me}
        afterSave={() => { loadUsers(); loadStats(); }}
      />
    </div>
  );
}

export default function Users() {
  return (
    <ProtectedRoute>
      <UsersInner />
    </ProtectedRoute>
  );
}
