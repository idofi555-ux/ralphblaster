'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface HostingConfig {
  id: string;
  provider: string;
  cliPath: string | null;
  projectToken: string | null;
  autoDeployBranch: string | null;
}

interface Provider {
  id: string;
  name: string;
  cliName: string | null;
}

export default function HostingSettings() {
  const { addToast } = useToast();
  const [config, setConfig] = useState<HostingConfig | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/hosting');
      const data = await response.json();
      setConfig(data.config);
      setProviders(data.providers || []);
    } catch (error) {
      addToast('Failed to load hosting config', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);

    try {
      const response = await fetch('/api/hosting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          cliPath: config.cliPath,
          projectToken: config.projectToken,
          autoDeployBranch: config.autoDeployBranch,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      addToast('Hosting configuration saved', 'success');
      setConnectionStatus(null);
    } catch (error) {
      addToast('Failed to save hosting config', 'error');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);

    try {
      const response = await fetch('/api/hosting', { method: 'POST' });
      const result = await response.json();
      setConnectionStatus(result);

      if (result.connected) {
        addToast('Connection successful!', 'success');
      } else {
        addToast(result.message || 'Connection failed', 'error');
      }
    } catch (error) {
      setConnectionStatus({ connected: false, message: 'Connection test failed' });
      addToast('Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        Loading hosting configuration...
      </div>
    );
  }

  const selectedProvider = providers.find((p) => p.id === config.provider);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Hosting Configuration</h2>

        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hosting Provider
            </label>
            <select
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* CLI Path */}
          {config.provider !== 'manual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CLI Path
              </label>
              <input
                type="text"
                value={config.cliPath || ''}
                onChange={(e) => setConfig({ ...config, cliPath: e.target.value })}
                placeholder={`e.g., /usr/local/bin/${selectedProvider?.cliName || 'cli'}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">
                Path to the {selectedProvider?.name} CLI executable
              </p>
            </div>
          )}

          {/* Project Token */}
          {config.provider !== 'manual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Token (optional)
              </label>
              <input
                type="password"
                value={config.projectToken || ''}
                onChange={(e) => setConfig({ ...config, projectToken: e.target.value })}
                placeholder="Enter deployment token"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Optional token for automated deployments
              </p>
            </div>
          )}

          {/* Auto Deploy Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto-Deploy Branch
            </label>
            <input
              type="text"
              value={config.autoDeployBranch || ''}
              onChange={(e) => setConfig({ ...config, autoDeployBranch: e.target.value })}
              placeholder="main"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Branch to deploy from (default: main)
            </p>
          </div>

          {/* Connection Status */}
          {connectionStatus && (
            <div
              className={`p-4 rounded-lg ${
                connectionStatus.connected
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {connectionStatus.connected ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={connectionStatus.connected ? 'text-green-800' : 'text-red-800'}>
                  {connectionStatus.message}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            {config.provider !== 'manual' && (
              <button
                onClick={testConnection}
                disabled={testing || !config.cliPath}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Provider Instructions */}
      {config.provider === 'railway' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-purple-800">Railway Setup</p>
              <ol className="text-purple-700 mt-2 space-y-1 list-decimal list-inside">
                <li>Install Railway CLI: <code className="bg-purple-100 px-1 rounded">npm install -g @railway/cli</code></li>
                <li>Login: <code className="bg-purple-100 px-1 rounded">railway login</code></li>
                <li>Link project: <code className="bg-purple-100 px-1 rounded">railway link</code> in your project directory</li>
                <li>Set CLI path above (usually <code className="bg-purple-100 px-1 rounded">/usr/local/bin/railway</code>)</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {config.provider === 'vercel' && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-white">Vercel Setup</p>
              <ol className="text-gray-300 mt-2 space-y-1 list-decimal list-inside">
                <li>Install Vercel CLI: <code className="bg-gray-700 px-1 rounded">npm install -g vercel</code></li>
                <li>Login: <code className="bg-gray-700 px-1 rounded">vercel login</code></li>
                <li>Set CLI path above (usually <code className="bg-gray-700 px-1 rounded">/usr/local/bin/vercel</code>)</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
