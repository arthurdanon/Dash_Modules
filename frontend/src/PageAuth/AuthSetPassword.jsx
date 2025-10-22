// src/PageAuth/SetPassword.jsx
import { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function SetPassword() {
  const { search } = useLocation();
  const nav = useNavigate();
  const token = new URLSearchParams(search).get('token');

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setErr(''); }, [pwd, pwd2]);

  const submit = async (e) => {
    e.preventDefault();
    if (!token) return setErr('Lien invalide ou expiré.');
    if (!pwd || pwd.length < 8) return setErr('Mot de passe trop court (min 8 caractères).');
    if (pwd !== pwd2) return setErr('Les mots de passe ne correspondent pas.');
    setLoading(true);
    setErr('');
    try {
      await api.post('/auth/accept-invite', { token, password: pwd });
      setOk(true);
      // Optionnel: nav('/login', { replace: true });
    } catch (e) {
      const msg = e?.response?.data?.error || 'Lien invalide ou expiré.';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold">Lien invalide</h1>
        <p className="mt-2 text-zinc-600">Le lien d’activation est manquant ou invalide.</p>
        <Link className="btn mt-4 inline-block" to="/login">Retour à la connexion</Link>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold">Mot de passe défini ✅</h1>
        <p className="mt-2 text-zinc-600">
          Votre compte est prêt. Vous pouvez maintenant vous connecter.
        </p>
        <button className="btn mt-4" onClick={() => nav('/login', { replace: true })}>
          Aller à la connexion
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold">Définir mon mot de passe</h1>
      <form onSubmit={submit} className="grid gap-3 mt-4">
        <label className="text-sm font-medium">Nouveau mot de passe</label>
        <input
          className="input"
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="********"
          autoFocus
        />

        <label className="text-sm font-medium">Confirmer</label>
        <input
          className="input"
          type="password"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          placeholder="********"
        />

        {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 text-sm px-3 py-2">{err}</div>}

        <button className="btn mt-2" type="submit" disabled={loading}>
          {loading ? 'Validation…' : 'Valider'}
        </button>
      </form>
    </div>
  );
}
