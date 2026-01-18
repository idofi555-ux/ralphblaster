'use client';

import { useState } from 'react';
import Link from 'next/link';
import RalphSettingsForm from './RalphSettingsForm';
import LogsViewer from './LogsViewer';
import UsageTracker from './UsageTracker';
import SecurityTestsSettings from './SecurityTestsSettings';
import HostingSettings from './HostingSettings';
import { Settings } from '@/lib/settings';

interface SettingsPageClientProps {
  initialSettings: Settings;
}

type Tab = 'settings' | 'security' | 'hosting' | 'logs' | 'usage';

export default function SettingsPageClient({ initialSettings }: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [settings, setSettings] = useState(initialSettings);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'settings', label: 'Ralph Settings' },
    { id: 'security', label: 'Security Tests' },
    { id: 'hosting', label: 'Hosting' },
    { id: 'logs', label: 'Logs' },
    { id: 'usage', label: 'Usage & Credits' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Settings</h1>
              <p className="text-gray-500 text-sm mt-1">Configure RalphBlaster</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Board
            </Link>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'settings' && (
          <RalphSettingsForm settings={settings} onSettingsChange={setSettings} />
        )}
        {activeTab === 'security' && <SecurityTestsSettings />}
        {activeTab === 'hosting' && <HostingSettings />}
        {activeTab === 'logs' && <LogsViewer />}
        {activeTab === 'usage' && <UsageTracker />}
      </main>
    </div>
  );
}
