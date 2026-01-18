'use client';

import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface ProjectInfo {
  name: string;
  path: string;
  type: string;
  gitUrl?: string;
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  framework?: string;
}

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (project: { id: string; name: string }) => void;
}

const PROJECT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

export default function ImportProjectModal({ isOpen, onClose, onImport }: ImportProjectModalProps) {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'local' | 'git'>('local');
  const [localPath, setLocalPath] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [branch, setBranch] = useState('default');
  const [branches, setBranches] = useState<string[]>([]);
  const [preview, setPreview] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);

  const fetchPreview = async () => {
    setLoading(true);
    setPreview(null);

    try {
      if (tab === 'local') {
        const response = await fetch(`/api/projects/import?path=${encodeURIComponent(localPath)}`);
        const data = await response.json();
        if (data.projectInfo) {
          setPreview(data.projectInfo);
        } else {
          throw new Error(data.error || 'Failed to detect project');
        }
      } else {
        // Fetch branches first
        const branchResponse = await fetch(`/api/projects/import?gitUrl=${encodeURIComponent(gitUrl)}`);
        const branchData = await branchResponse.json();
        if (branchData.branches) {
          setBranches(branchData.branches);
        }

        // Set preview info for git
        setPreview({
          name: gitUrl.split('/').pop()?.replace('.git', '') || 'project',
          path: '',
          type: 'unknown',
          gitUrl,
          hasPackageJson: true,
          hasTsConfig: false,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to preview project';
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);

    try {
      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: tab,
          path: tab === 'local' ? localPath : undefined,
          gitUrl: tab === 'git' ? gitUrl : undefined,
          branch: tab === 'git' ? branch : undefined,
          color: selectedColor,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Import failed');
      }

      addToast(`Project "${data.project.name}" imported successfully!`, 'success');
      onImport(data.project);
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import project';
      addToast(message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setLocalPath('');
    setGitUrl('');
    setBranch('default');
    setBranches([]);
    setPreview(null);
    setSelectedColor(PROJECT_COLORS[0]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Import Project</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setTab('local'); setPreview(null); }}
            className={`flex-1 py-3 text-sm font-medium ${
              tab === 'local'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Local Folder
          </button>
          <button
            onClick={() => { setTab('git'); setPreview(null); }}
            className={`flex-1 py-3 text-sm font-medium ${
              tab === 'git'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Git Repository
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {tab === 'local' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/Users/you/projects/my-app"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <button
                  onClick={fetchPreview}
                  disabled={!localPath || loading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {loading ? 'Scanning...' : 'Scan'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Git URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <button
                    onClick={fetchPreview}
                    disabled={!gitUrl || loading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Fetch'}
                  </button>
                </div>
              </div>

              {preview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="default">Default branch</option>
                    {branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-800">Project Preview</h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-medium">{preview.name}</span>
                </div>
                {preview.framework && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Framework:</span>
                    <span className="font-medium">{preview.framework}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">TypeScript:</span>
                  <span className={preview.hasTsConfig ? 'text-green-600' : 'text-gray-400'}>
                    {preview.hasTsConfig ? 'Yes' : 'No'}
                  </span>
                </div>
                {preview.path && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Path:</span>
                    <span className="font-mono text-xs truncate max-w-[200px]">{preview.path}</span>
                  </div>
                )}
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">Project Color</label>
                <div className="flex gap-2">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || importing}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
          >
            {importing ? 'Importing...' : 'Import Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
