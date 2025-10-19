// src/pages/Home.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Background from '../components/Background';

function HomeInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const siteName = user?.siteName || user?.site?.name || 'Votre site';

  return (
    <div className="relative min-h-screen">
      <Background />

      <div className="relative grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-2xl text-center">
          {/* badge / titre du site */}
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm shadow-soft backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-100">Connecté</span>
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {siteName}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-200/80">
            Bienvenue dans votre espace. Lancez-vous pour gérer les tâches et interventions de votre site.
          </p>

          <div className="mx-auto mt-8 w-full max-w-sm">
            <button
              onClick={() => navigate('/tasks')}
              className="btn w-full py-3 text-base"
            >
              Entrer dans les tâches
            </button>
          </div>

          {/* petites tuiles décoratives (optionnel, adaptées au fond sombre) */}
          <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-3">
            <div className="h-24 rounded-2xl bg-gradient-to-b from-indigo-500/90 to-violet-500/90" />
            <div className="h-24 rounded-2xl bg-gradient-to-b from-emerald-400/90 to-teal-500/90" />
            <div className="h-24 rounded-2xl bg-gradient-to-b from-amber-400/90 to-orange-500/90" />
          </div>

          <div className="mt-8 text-xs text-zinc-300/70">
            © {new Date().getFullYear()} TaskFlow — prêt à travailler.
          </div>
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
