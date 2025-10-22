// src/PageAuth/Login.jsx
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Background from '../Components/Background';

console.log('API baseURL =', api.defaults.baseURL);

/* ------ Modale "Mot de passe oublié" ------ */
function ForgotPasswordModal({ open, onClose, onSent }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) {
      setEmail('');
      setErr('');
      setSending(false);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      onSent?.(email.trim());
      onClose();
    } catch (e2) {
      const msg = e2?.response?.data?.error || 'Échec de l’envoi. Réessaie.';
      setErr(msg);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="card w-full max-w-md p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Réinitialiser le mot de passe</h3>
            <button className="btn-outline text-sm px-3 py-1" onClick={onClose}>Fermer</button>
          </div>
          <form onSubmit={submit} className="grid gap-3 mt-4">
            <label className="text-sm font-medium">Adresse e-mail</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              required
              autoFocus
              autoComplete="email"
            />
            {err && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 text-sm px-3 py-2">
                {err}
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn" type="submit" disabled={sending || !email.trim()}>
                {sending ? 'Envoi…' : 'Envoyer le lien'}
              </button>
              <button className="btn-outline" type="button" onClick={onClose}>Annuler</button>
            </div>
            <div className="text-xs text-zinc-500">
              Tu recevras un e-mail avec un lien de réinitialisation valable quelques heures.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { user, login } = useAuth();
  const nav = useNavigate();

  // Si déjà connecté, redirige vers /home
  useEffect(() => {
    if (user) nav('/home', { replace: true });
  }, [user, nav]);

  const emailOk = useMemo(() => {
    if (!email) return false;
    // Validation simple et tolérante
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setInfo('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      login(data);
      nav('/home', { replace: true });
    } catch (e2) {
      const msg = e2?.response?.data?.error || 'Identifiants invalides';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const onForgotSent = (sentEmail) => {
    setInfo(`Un e-mail de réinitialisation a été envoyé à ${sentEmail}.`);
  };

  return (
    <div className="relative min-h-screen grid lg:grid-cols-12">
      {/* Fond global */}
      <Background />

      {/* Colonne gauche : Formulaire */}
      <div className="col-span-12 lg:col-span-6 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Logo / marque */}
          <div className="flex items-center gap-3 mb-8">
            <div className="rounded-xl w-[48px] h-[48px] border border-white/20 bg-white/10 backdrop-blur flex items-center justify-center shadow-soft">
              <div className="w-[22px] h-[22px] rotate-45 bg-gradient-to-b from-zinc-100 to-zinc-300 rounded-sm" />
            </div>
            <div className="text-xl font-semibold tracking-tight text-white">TaskFlow</div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-6 sm:p-8 shadow-soft">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Connexion</h1>
            <p className="text-sm text-zinc-200/80 mt-1">
              Accédez à votre espace de gestion des tâches.
            </p>

            {/* banner info / erreur */}
            {info && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm px-3 py-2">
                {info}
              </div>
            )}
            {err && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
                {err}
              </div>
            )}

            <form onSubmit={onSubmit} className="grid gap-3 mt-6">
              <label className="text-sm font-medium text-zinc-100">
                Adresse e-mail
              </label>
              <input
                className="input bg-white/90 dark:bg-white/90 text-zinc-900"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                autoFocus
                autoComplete="email"
              />

              <label className="text-sm font-medium text-zinc-100 mt-2">
                Mot de passe
              </label>
              <input
                className="input bg-white/90 dark:bg-white/90 text-zinc-900"
                value={password}
                onChange={(e) => setP(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />

              <div className="flex items-center justify-between text-sm mt-1">
                <button
                  type="button"
                  className="text-zinc-100/90 hover:text-white underline underline-offset-2"
                  onClick={() => setForgotOpen(true)}
                >
                  Mot de passe oublié ?
                </button>

                {/* Lien vers la page d’activation (invitation) */}
                <Link
                  className="text-zinc-100/90 hover:text-white underline underline-offset-2"
                  to="/set-password"
                >
                  Activer mon compte
                </Link>
              </div>

              <button
                type="submit"
                className="btn w-full mt-3"
                disabled={loading || !emailOk || !password}
                title={!emailOk ? 'Saisis une adresse e-mail valide' : undefined}
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>

            {/* Aides / extra */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-zinc-200/80">
                Besoin d’aide ?
              </span>
              <span className="text-white font-medium">
                Contactez un administrateur
              </span>
            </div>
          </div>

          {/* Mentions */}
          <div className="text-xs text-zinc-200/70 mt-6">
            © {new Date().getFullYear()} TaskFlow. Tous droits réservés.
          </div>
        </div>
      </div>

      {/* Colonne droite : panneau visuel */}
      <div className="hidden lg:flex col-span-6 items-center relative overflow-hidden p-10">
        <div className="relative z-10 w-full px-2">
          <div className="max-w-lg ml-auto">
            <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-6 shadow-soft">
              <div className="text-3xl font-semibold tracking-tight text-white">
                Bienvenue !
              </div>
              <div className="text-zinc-200/85 mt-2">
                Gérez vos sites, équipes et tâches en toute simplicité.
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl h-24 bg-gradient-to-b from-indigo-500/90 to-violet-500/90" />
                <div className="rounded-xl h-24 bg-gradient-to-b from-emerald-400/90 to-teal-500/90" />
                <div className="rounded-xl h-24 bg-gradient-to-b from-amber-400/90 to-orange-500/90" />
              </div>

              <div className="mt-6 text-sm text-zinc-200/80">
                +7k utilisateurs, et ça continue ! Votre parcours commence ici.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modale forgot password */}
      <ForgotPasswordModal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        onSent={onForgotSent}
      />
    </div>
  );
}
