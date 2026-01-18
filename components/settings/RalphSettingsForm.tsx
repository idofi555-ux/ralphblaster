'use client';

import { useState } from 'react';
import { Settings } from '@/lib/settings';
import { useToast } from '@/contexts/ToastContext';

interface RalphSettingsFormProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5 (Recommended)' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5' },
];

export default function RalphSettingsForm({ settings, onSettingsChange }: RalphSettingsFormProps) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    claudeModel: settings.claudeModel,
    maxTokens: settings.maxTokens,
    claudeCliPath: settings.claudeCliPath,
    logRetentionCount: settings.logRetentionCount,
    statusPollInterval: settings.statusPollInterval,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const updatedSettings = await response.json();
      onSettingsChange(updatedSettings);
      addToast('Settings saved successfully', 'success');
    } catch (error) {
      addToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      claudeModel: settings.claudeModel,
      maxTokens: settings.maxTokens,
      claudeCliPath: settings.claudeCliPath,
      logRetentionCount: settings.logRetentionCount,
      statusPollInterval: settings.statusPollInterval,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Ralph Configuration</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Claude Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Claude Model (for PRD Generation)
          </label>
          <select
            value={formData.claudeModel}
            onChange={(e) => setFormData({ ...formData, claudeModel: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Model used for generating PRDs. Opus is more capable but more expensive.
          </p>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Tokens
          </label>
          <input
            type="number"
            value={formData.maxTokens}
            onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 4096 })}
            min={1024}
            max={32000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum tokens for PRD generation (1024-32000). Higher values allow longer PRDs.
          </p>
        </div>

        {/* Claude CLI Path */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Claude CLI Path
          </label>
          <input
            type="text"
            value={formData.claudeCliPath}
            onChange={(e) => setFormData({ ...formData, claudeCliPath: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="mt-1 text-sm text-gray-500">
            Path to the Claude CLI executable used by Ralph.
          </p>
        </div>

        {/* Log Retention */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Log Retention Count
          </label>
          <input
            type="number"
            value={formData.logRetentionCount}
            onChange={(e) => setFormData({ ...formData, logRetentionCount: parseInt(e.target.value) || 100 })}
            min={10}
            max={1000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Number of log entries to keep per Ralph execution (10-1000).
          </p>
        </div>

        {/* Status Poll Interval */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status Poll Interval (ms)
          </label>
          <input
            type="number"
            value={formData.statusPollInterval}
            onChange={(e) => setFormData({ ...formData, statusPollInterval: parseInt(e.target.value) || 1500 })}
            min={500}
            max={10000}
            step={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            How often to poll for Ralph status updates (500-10000ms). Lower values = faster updates but more load.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
