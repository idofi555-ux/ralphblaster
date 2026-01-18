'use client';

import { useState, useEffect } from 'react';

interface ApiUsageLog {
  id: string;
  type: string;
  ticketId: string | null;
  ticketTitle: string | null;
  projectName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  duration: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface SystemLog {
  id: string;
  level: string;
  category: string;
  message: string;
  details: string | null;
  createdAt: string;
}

type LogTab = 'ralph' | 'system';

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState<LogTab>('ralph');
  const [ralphLogs, setRalphLogs] = useState<ApiUsageLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === 'ralph') {
        const response = await fetch('/api/usage');
        const data = await response.json();
        setRalphLogs(data);
      } else {
        const response = await fetch('/api/logs');
        const data = await response.json();
        setSystemLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-600 bg-red-50';
      case 'WARN':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'SUCCESS'
      ? 'text-green-600 bg-green-50'
      : 'text-red-600 bg-red-50';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200 px-4">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('ralph')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'ralph'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Ralph Runs
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'system'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            System Logs
          </button>
        </nav>
      </div>

      {/* Refresh Button */}
      <div className="px-4 py-3 border-b border-gray-100 flex justify-end">
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading logs...</div>
        ) : activeTab === 'ralph' ? (
          ralphLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No Ralph runs yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {ralphLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {log.type === 'PRD_GENERATION' ? 'PRD Generation' : 'Ralph Execution'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {log.ticketTitle || 'Unknown Ticket'}
                      </p>
                      {log.projectName && (
                        <p className="text-xs text-gray-500">{log.projectName}</p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-800">
                        {log.estimatedCost != null ? `$${log.estimatedCost.toFixed(4)}` : '-'}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(log.createdAt)}</p>
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        {log.inputTokens != null && (
                          <div>
                            <span className="text-gray-500">Input Tokens:</span>{' '}
                            <span className="font-medium">{log.inputTokens.toLocaleString()}</span>
                          </div>
                        )}
                        {log.outputTokens != null && (
                          <div>
                            <span className="text-gray-500">Output Tokens:</span>{' '}
                            <span className="font-medium">{log.outputTokens.toLocaleString()}</span>
                          </div>
                        )}
                        {log.duration != null && (
                          <div>
                            <span className="text-gray-500">Duration:</span>{' '}
                            <span className="font-medium">{log.duration}s</span>
                          </div>
                        )}
                      </div>
                      {log.errorMessage && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-red-600 text-xs font-mono">
                          {log.errorMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : systemLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No system logs yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {systemLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-xs text-gray-500">{log.category}</span>
                    </div>
                    <p className="text-sm text-gray-800">{log.message}</p>
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </p>
                </div>

                {expandedLog === log.id && log.details && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                      {log.details}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
