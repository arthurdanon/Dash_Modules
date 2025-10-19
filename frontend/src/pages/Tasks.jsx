import ProtectedRoute from '../components/ProtectedRoute';

function TasksInner() {
  // version placeholder pour tester la route; on branchera plus tard /tasks
  return (
    <div style={{padding:16}}>
      <h2>Tasks</h2>
      <p>À venir : liste/creation de tâches, filtres par équipe, statut Kanban.</p>
    </div>
  );
}

export default function Tasks() {
  return (
    <ProtectedRoute>
      <TasksInner />
    </ProtectedRoute>
  );
}
