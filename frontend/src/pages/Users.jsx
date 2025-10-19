import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../AuthContext';

/* --------------------------- Modale générique --------------------------- */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="card w-full max-w-lg p-5">
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

/* ----------------------- Modale création d’un user ---------------------- */
function CreateUserModal({ open, onClose, me, afterCreate }) {
  const [sites, setSites] = useState([]);
  const [roles, setRoles] = useState([]); // ex: ["ADMIN","OWNER","MANAGER","USER"]

  const [form, setForm] = useState({
    siteId: '',
    role: '',
    firstName: '',
    lastName: '',
    username: '',
  });

  const [err, setErr] = useState('');
  const [generatedPwd, setGeneratedPwd] = useState('');

  const myRole = me?.role ?? 'USER';
  const isAdmin = myRole === 'ADMIN';
  const isOwner = myRole === 'OWNER';
  const isManager = myRole === 'MANAGER';

  // Charger sites + rôles à l’ouverture
  useEffect(() => {
    if (!open) return;
    (async () => {
      setErr('');
      setGeneratedPwd('');
      try {
        const [rRes, sRes] = await Promise.all([api.get('/roles'), api.get('/sites')]);
        const rolesList = Array.isArray(rRes.data) ? rRes.data : [];
        const sitesList = Array.isArray(sRes.data) ? sRes.data : [];
        setRoles(rolesList);
        setSites(sitesList);

        setForm(f => {
          const next = { ...f };
          if (!f.siteId && sitesList[0]?.id) next.siteId = sitesList[0].id;
          return next;
        });
      } catch {
        setErr('Erreur chargement des sites/rôles');
      }
    })();
  }, [open]);

  // Rôles autorisés selon mon rôle
  const roleOptions = useMemo(() => {
    if (!roles || roles.length === 0) return [];
    if (isAdmin) return roles; // ["ADMIN","OWNER","MANAGER","USER"]
    if (isOwner) return roles.filter(r => r === 'OWNER' || r === 'MANAGER' || r === 'USER');
    if (isManager) return roles.filter(r => r === 'USER');
    return [];
  }, [roles, isAdmin, isOwner, isManager]);

  // Choisir une valeur par défaut de rôle dès qu’on a des options
  useEffect(() => {
    if (!open) return;
    setForm(f => {
      if (!f.role && roleOptions.length > 0) {
        return { ...f, role: roleOptions[0] };
      }
      // si la valeur actuelle n'est plus autorisée (ex: changement d'utilisateur)
      if (f.role && !roleOptions.includes(f.role)) {
        return { ...f, role: roleOptions[0] || '' };
      }
      return f;
    });
  }, [open, roleOptions]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setGeneratedPwd('');

    const { siteId, role, firstName, lastName, username } = form;
    if (!siteId) return setErr('Sélectionne un site.');
    if (!role) return setErr('Sélectionne un rôle.');
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      return setErr('Champs requis manquants');
    }

    try {
      const payload = {
        role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
      };
      const { data } = await api.post(`/sites/${siteId}/users`, payload);
      if (data?.generatedPassword) setGeneratedPwd(data.generatedPassword);

      // reset champs texte (garde site et rôle pour enchaîner)
      setForm(f => ({ ...f, firstName: '', lastName: '', username: '' }));
      afterCreate?.();
    } catch (e2) {
      const msg = e2?.response?.data?.error || 'Création refusée.';
      setErr(msg);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Créer un utilisateur">
      <form onSubmit={submit} className="grid gap-3">
        {/* Site */}
        <select
          className="select"
          value={form.siteId}
          onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))}
          required
        >
          {sites.length === 0 && <option value="">Aucun site</option>}
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Rôle */}
        <select
          className="select"
          value={form.role}
          onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          required
          disabled={roleOptions.length === 0}
        >
          {roleOptions.length === 0 && <option value="">Aucun rôle disponible</option>}
          {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Identité */}
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="input"
            value={form.firstName}
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            placeholder="Prénom"
            required
          />
          <input
            className="input"
            value={form.lastName}
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            placeholder="Nom"
            required
          />
        </div>

        <input
          className="input"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          placeholder="username (login)"
          required
        />

        {err && <div className="text-red-600 text-sm">{err}</div>}

        <div className="flex gap-2">
          <button
            className="btn"
            type="submit"
            disabled={!form.siteId || !form.role}
          >
            Créer
          </button>
          <button className="btn-outline" type="button" onClick={onClose}>Fermer</button>
        </div>

        {generatedPwd && (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="text-sm mb-1 text-emerald-200/90">Mot de passe généré</div>
            <div className="font-mono text-emerald-100">{generatedPwd}</div>
            <div className="mt-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigator.clipboard?.writeText(generatedPwd)}
              >
                Copier
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------- Page Users ------------------------------ */
function UsersInner() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [passwords, setPasswords] = useState({}); // { [userId]: 'plaintext' }
  const [openUserModal, setOpenUserModal] = useState(false);

  const myRole = me?.role ?? 'USER';
  const isAdmin = myRole === 'ADMIN';
  const isOwner = myRole === 'OWNER';
  const isManager = myRole === 'MANAGER';

  // Qui peut créer ?
  const canCreateUsers = isAdmin || isOwner || isManager;

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch {
      setUsers([]); // si 403 (user simple)
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const delUser = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (e) {
      alert(e?.response?.data?.error || 'Suppression refusée');
    }
  };

  const loadPassword = async (id) => {
    try {
      const { data } = await api.get(`/users/${id}/password`);
      setPasswords(p => ({ ...p, [id]: data.password }));
    } catch {
      setPasswords(p => ({ ...p, [id]: '—' }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Utilisateurs</h2>
        <div className="flex items-center gap-2">
          {canCreateUsers && (
            <button className="btn" onClick={() => setOpenUserModal(true)}>
              Nouvel utilisateur
            </button>
          )}
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Liste</h3>
          <button className="btn-outline" onClick={loadUsers}>Rafraîchir</button>
        </div>

        <div className="overflow-auto mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Site</th>
                <th>Rôle</th>
                <th>Username</th>
                <th>Mot de passe</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.lastName || '—'}</td>
                  <td>{u.firstName || '—'}</td>
                  <td>{u.site?.name || '—'}</td>
                  <td>{u.role || '—'}</td>
                  <td>{u.username || '—'}</td>
                  <td>
                    {passwords[u.id]
                      ? <span className="font-mono">{passwords[u.id]}</span>
                      : (
                        <button
                          className="btn-outline"
                          onClick={() => loadPassword(u.id)}
                          disabled={u.role === 'ADMIN'}
                          title={u.role === 'ADMIN' ? 'Mot de passe non accessible pour les admins' : 'Afficher'}
                        >
                          Afficher
                        </button>
                      )
                    }
                  </td>
                  <td>
                    <button className="btn-outline" onClick={() => delUser(u.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="7" className="text-center py-4 text-zinc-500">Aucun utilisateur</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modale */}
      <CreateUserModal
        open={openUserModal}
        onClose={() => setOpenUserModal(false)}
        me={me}
        afterCreate={loadUsers}
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
