import { prisma } from '@/lib/prisma';
import KanbanBoard from '@/components/KanbanBoard';
import ProjectSelector from '@/components/ProjectSelector';
import Link from 'next/link';

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
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">RalphBlaster</h1>
                <p className="text-gray-500 text-sm mt-1">Autonomous development workflow</p>
              </div>
              <Link
                href="/settings"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </Link>
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
