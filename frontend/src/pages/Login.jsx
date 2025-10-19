// src/pages/Login.jsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';

console.log('API baseURL =', api.defaults.baseURL);

export default function Login() {
  const [username, setU] = useState('admin_global');
  const [password, setP] = useState('admin123');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const nav = useNavigate();

  // Si déjà connecté, redirige vers /home
  useEffect(() => {
    if (user) nav('/home', { replace: true });
  }, [user, nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data);
      nav('/home', { replace: true });
    } catch {
      setErr('Identifiants invalides');
    } finally {
      setLoading(false);
    }
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

            <form onSubmit={onSubmit} className="grid gap-3 mt-6">
              <label className="text-sm font-medium text-zinc-100">
                Nom d’utilisateur
              </label>
              <input
                className="input bg-white/90 dark:bg-white/90 text-zinc-900"
                value={username}
                onChange={(e) => setU(e.target.value)}
                placeholder="username"
                autoFocus
              />

              <label className="text-sm font-medium text-zinc-100 mt-2">
                Mot de passe
              </label>
              <input
                className="input bg-white/90 dark:bg-white/90 text-zinc-900"
                value={password}
                onChange={(e) => setP(e.target.value)}
                placeholder="password"
                type="password"
              />

              {err && (
                <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
                  {err}
                </div>
              )}

              <button
                type="submit"
                className="btn w-full mt-3"
                disabled={loading}
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
    </div>
  );
}
