'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import type { Project } from '@/types';
import ProjectSettingsModal from './ProjectSettingsModal';
import ImportProjectModal from './ImportProjectModal';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId?: string;
}

export default function ProjectSelector({ projects, selectedProjectId }: ProjectSelectorProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', codePath: '', color: '#3B82F6' });

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleProjectChange = (projectId: string) => {
    router.push(`/?projectId=${projectId}`);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      if (res.ok) {
        const project = await res.json();
        setIsCreating(false);
        setNewProject({ name: '', codePath: '', color: '#3B82F6' });
        addToast(`Project "${project.name}" created!`, 'success');
        router.push(`/?projectId=${project.id}`);
        router.refresh();
      } else {
        addToast('Failed to create project', 'error');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      addToast('Failed to create project', 'error');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        {selectedProject && (
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: selectedProject.color }}
          />
        )}
        <select
          value={selectedProjectId || ''}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
        >
          {projects.length === 0 && <option value="">No projects</option>}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        {selectedProject && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Project Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      <button
        onClick={() => setIsImportOpen(true)}
        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium whitespace-nowrap border border-gray-300"
      >
        Import
      </button>

      <button
        onClick={() => setIsCreating(true)}
        className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium whitespace-nowrap"
      >
        + New Project
      </button>

      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Project"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codebase Path
                </label>
                <input
                  type="text"
                  value={newProject.codePath}
                  onChange={(e) => setNewProject({ ...newProject, codePath: e.target.value })}
                  placeholder="/Users/me/dev/myproject"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newProject.color}
                    onChange={(e) => setNewProject({ ...newProject, color: e.target.value })}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-gray-300"
                  />
                  <span className="text-sm text-gray-500">{newProject.color}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSettingsOpen && selectedProject && (
        <ProjectSettingsModal
          project={selectedProject}
          onClose={() => setIsSettingsOpen(false)}
          onUpdated={() => router.refresh()}
          onDeleted={() => router.refresh()}
        />
      )}

      {isImportOpen && (
        <ImportProjectModal
          onClose={() => setIsImportOpen(false)}
          onImported={(project) => {
            setIsImportOpen(false);
            addToast(`Project "${project.name}" imported!`, 'success');
            router.push(`/?projectId=${project.id}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
