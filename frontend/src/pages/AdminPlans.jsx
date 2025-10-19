import { useEffect, useState } from 'react';
import { api } from '../api';
import ProtectedRoute from '../components/ProtectedRoute';
import Background from '../components/Background';
import { useAuth } from '../AuthContext';

/* --- Modal générique --- */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="card w-full max-w-xl p-5">
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

function AdminPlansInner() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [owners, setOwners] = useState([]); // pour assigner un plan
  const [err, setErr] = useState('');

  // Modales
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);

  const [form, setForm] = useState({ name:'', maxSites:5, maxManagers:5, maxUsers:50, priceCents:9900 });
  const [editing, setEditing] = useState(null);
  const [assign, setAssign] = useState({ ownerId: '', planId: '' });

  const load = async () => {
    setErr('');
    try {
      const [p, o] = await Promise.all([
        api.get('/admin/plans'),
        api.get('/owners', { /* il te faut une route GET /owners admin-only */ })
          .catch(()=>({data:[]})) // au cas où tu ne l’as pas encore
      ]);
      setPlans(p.data);
      setOwners(o.data);
    } catch {
      setErr('Erreur chargement plans');
    }
  };

  useEffect(() => { load(); }, []);

  if (!user?.isAdmin) {
    return <div className="p-6">Accès réservé à l’administrateur.</div>;
  }

  const submitCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/plans', form);
      setOpenCreate(false);
      setForm({ name:'', maxSites:5, maxManagers:5, maxUsers:50, priceCents:9900 });
      load();
    } catch {
      alert('Création refusée');
    }
  };

  const openEditPlan = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      maxSites: p.maxSites,
      maxManagers: p.maxManagers,
      maxUsers: p.maxUsers,
      priceCents: p.priceCents,
    });
    setOpenEdit(true);
  };
  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/plans/${editing.id}`, form);
      setOpenEdit(false);
      setEditing(null);
      load();
    } catch {
      alert('Mise à jour refusée');
    }
  };

  const del = async (id) => {
    if (!window.confirm('Supprimer ce plan ?')) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      load();
    } catch (e) {
      alert('Suppression refusée (plan utilisé ?)');
    }
  };

  const openAssignModal = (plan) => {
    setAssign(a => ({ ...a, planId: plan.id }));
    setOpenAssign(true);
  };
  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assign.ownerId || !assign.planId) return;
    try {
      await api.post(`/admin/owners/${assign.ownerId}/subscription`, { planId: assign.planId });
      setOpenAssign(false);
      setAssign({ ownerId:'', planId:'' });
      alert('Plan assigné au propriétaire');
    } catch {
      alert('Assignation refusée');
    }
  };

  return (
    <div className="relative min-h-screen">
      <Background />
      <div className="relative z-10 p-6 max-w-5xl mx-auto grid gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Plans</h2>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={load}>Rafraîchir</button>
            <button className="btn" onClick={() => setOpenCreate(true)}>Nouveau plan</button>
          </div>
        </div>

        {err && <div className="text-red-500">{err}</div>}

        <section className="card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2 text-left">Nom</th>
                  <th className="px-4 py-2 text-left">Sites</th>
                  <th className="px-4 py-2 text-left">Managers</th>
                  <th className="px-4 py-2 text-left">Users</th>
                  <th className="px-4 py-2 text-left">Prix (€/mois)</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">{p.maxSites}</td>
                    <td className="px-4 py-2">{p.maxManagers}</td>
                    <td className="px-4 py-2">{p.maxUsers}</td>
                    <td className="px-4 py-2">{(p.priceCents/100).toFixed(2)}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <button className="btn-outline" onClick={() => openEditPlan(p)}>Éditer</button>
                      <button className="btn-outline" onClick={() => openAssignModal(p)}>Assigner</button>
                      <button className="text-red-500 hover:underline" onClick={() => del(p.id)}>Supprimer</button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-6 text-center text-zinc-500">Aucun plan</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal Création */}
        <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Nouveau plan">
          <form onSubmit={submitCreate} className="grid gap-3">
            <input className="input" placeholder="Nom" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" type="number" placeholder="Max sites" value={form.maxSites} onChange={e=>setForm(f=>({...f, maxSites:e.target.value}))}/>
              <input className="input" type="number" placeholder="Max managers" value={form.maxManagers} onChange={e=>setForm(f=>({...f, maxManagers:e.target.value}))}/>
              <input className="input" type="number" placeholder="Max users" value={form.maxUsers} onChange={e=>setForm(f=>({...f, maxUsers:e.target.value}))}/>
              <input className="input" type="number" placeholder="Prix (cents)" value={form.priceCents} onChange={e=>setForm(f=>({...f, priceCents:e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" type="button" onClick={()=>setOpenCreate(false)}>Annuler</button>
              <button className="btn" type="submit" disabled={!form.name.trim()}>Créer</button>
            </div>
          </form>
        </Modal>

        {/* Modal Édition */}
        <Modal open={openEdit} onClose={()=>{setOpenEdit(false); setEditing(null);}} title={`Éditer le plan${editing ? ` : ${editing.name}` : ''}`}>
          <form onSubmit={submitEdit} className="grid gap-3">
            <input className="input" placeholder="Nom" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" type="number" placeholder="Max sites" value={form.maxSites} onChange={e=>setForm(f=>({...f, maxSites:e.target.value}))}/>
              <input className="input" type="number" placeholder="Max managers" value={form.maxManagers} onChange={e=>setForm(f=>({...f, maxManagers:e.target.value}))}/>
              <input className="input" type="number" placeholder="Max users" value={form.maxUsers} onChange={e=>setForm(f=>({...f, maxUsers:e.target.value}))}/>
              <input className="input" type="number" placeholder="Prix (cents)" value={form.priceCents} onChange={e=>setForm(f=>({...f, priceCents:e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" type="button" onClick={()=>{setOpenEdit(false); setEditing(null);}}>Annuler</button>
              <button className="btn" type="submit" disabled={!form.name.trim()}>Enregistrer</button>
            </div>
          </form>
        </Modal>

        {/* Modal Assignation à un propriétaire */}
        <Modal open={openAssign} onClose={()=>setOpenAssign(false)} title="Assigner un plan à un propriétaire">
          <form onSubmit={submitAssign} className="grid gap-3">
            <select className="input" value={assign.planId} onChange={e=>setAssign(a=>({...a, planId:e.target.value}))}>
              <option value="">Choisir un plan</option>
              {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input" value={assign.ownerId} onChange={e=>setAssign(a=>({...a, ownerId:e.target.value}))}>
              <option value="">Choisir un propriétaire</option>
              {owners.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" type="button" onClick={()=>setOpenAssign(false)}>Annuler</button>
              <button className="btn" type="submit" disabled={!assign.planId || !assign.ownerId}>Assigner</button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}

export default function AdminPlans() {
  return (
    <ProtectedRoute>
      <AdminPlansInner />
    </ProtectedRoute>
  );
}
