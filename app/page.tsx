import { prisma } from '@/lib/prisma';
import KanbanBoard from '@/components/KanbanBoard';
import ProjectSelector from '@/components/ProjectSelector';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const selectedProjectId = params.projectId || projects[0]?.id;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-full mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">RalphBlaster</h1>
              <p className="text-gray-500 text-sm mt-1">Autonomous development workflow</p>
            </div>
            <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-gray-50">
        {selectedProjectId ? (
          <KanbanBoard projectId={selectedProjectId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-12 px-4">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No projects yet</h2>
              <p className="text-gray-500">Create your first project to get started.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
