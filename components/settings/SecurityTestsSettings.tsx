'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface SecurityTest {
  id: string;
  name: string;
  command: string;
  description: string | null;
  enabled: boolean;
  order: number;
}

interface PresetTest {
  name: string;
  command: string;
  description: string;
}

export default function SecurityTestsSettings() {
  const { addToast } = useToast();
  const [tests, setTests] = useState<SecurityTest[]>([]);
  const [presets, setPresets] = useState<PresetTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTest, setNewTest] = useState({ name: '', command: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await fetch('/api/security-tests');
      const data = await response.json();
      setTests(data.tests || []);
      setPresets(data.presets || []);
    } catch (error) {
      addToast('Failed to load security tests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addTest = async (test: { name: string; command: string; description?: string }) => {
    setSaving(true);
    try {
      const response = await fetch('/api/security-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test),
      });

      if (!response.ok) throw new Error('Failed to add test');

      const newTest = await response.json();
      setTests([...tests, newTest]);
      setShowAddForm(false);
      setNewTest({ name: '', command: '', description: '' });
      addToast('Security test added', 'success');
    } catch (error) {
      addToast('Failed to add security test', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleTest = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/security-tests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });

      if (!response.ok) throw new Error('Failed to update test');

      setTests(tests.map((t) => (t.id === id ? { ...t, enabled } : t)));
    } catch (error) {
      addToast('Failed to update test', 'error');
    }
  };

  const deleteTest = async (id: string) => {
    try {
      const response = await fetch(`/api/security-tests?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete test');

      setTests(tests.filter((t) => t.id !== id));
      addToast('Security test deleted', 'success');
    } catch (error) {
      addToast('Failed to delete test', 'error');
    }
  };

  const addPreset = (preset: PresetTest) => {
    addTest(preset);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        Loading security tests...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Tests */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Security Tests</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
          >
            Add Custom Test
          </button>
        </div>

        {tests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No security tests configured. Add a preset or create a custom test.
          </p>
        ) : (
          <div className="space-y-3">
            {tests.map((test) => (
              <div
                key={test.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4 flex-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={test.enabled}
                      onChange={(e) => toggleTest(test.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{test.name}</p>
                    <p className="text-sm text-gray-500 font-mono">{test.command}</p>
                    {test.description && (
                      <p className="text-xs text-gray-400 mt-1">{test.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTest(test.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Custom Test Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Custom Test</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={newTest.name}
                onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                placeholder="e.g., License Check"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Command</label>
              <input
                type="text"
                value={newTest.command}
                onChange={(e) => setNewTest({ ...newTest, command: e.target.value })}
                placeholder="e.g., npx license-checker --failOn AGPL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={newTest.description}
                onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                placeholder="What this test checks for"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => addTest(newTest)}
                disabled={saving || !newTest.name || !newTest.command}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? 'Adding...' : 'Add Test'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewTest({ name: '', command: '', description: '' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Add Presets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map((preset, index) => (
            <button
              key={index}
              onClick={() => addPreset(preset)}
              className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 text-left transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">{preset.name}</p>
                <p className="text-xs text-gray-500">{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-blue-800">How Security Tests Work</p>
            <p className="text-blue-700 mt-1">
              Security tests run in order before deployment. A test passes if it exits with code 0.
              If any test fails, deployment is blocked until issues are resolved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
