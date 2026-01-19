'use client';

import { useState, useEffect } from 'react';
import type { Ticket } from '@/types';

interface RalphReport {
  success: boolean;
  durationMs: number;
  totalCostUsd: number;
  numTurns: number;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  summary: string;
}

interface TestingPanelProps {
  ticket: Ticket;
  onMerged: () => void;
  onRejected: () => void;
  onChangesRequested: () => void;
}

export default function TestingPanel({ ticket, onMerged, onRejected, onChangesRequested }: TestingPanelProps) {
  const [isMerging, setIsMerging] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changeRequest, setChangeRequest] = useState('');
  const [isSubmittingChanges, setIsSubmittingChanges] = useState(false);
  const [report, setReport] = useState<RalphReport | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  // Extract branch name from instance path
  const instanceName = ticket.ralphInstancePath?.split('/').pop() || '';
  const branchName = `ralph/${instanceName.replace(/-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/, '')}`;

  // Auto-start test server when panel loads
  useEffect(() => {
    startTestServer();

    // Cleanup: stop server when component unmounts
    return () => {
      fetch(`/api/tickets/${ticket.id}/test-server`, { method: 'DELETE' }).catch(() => {});
    };
  }, [ticket.id]);

  // Fetch Ralph report
  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/tickets/${ticket.id}/report`);
        if (res.ok) {
          const data = await res.json();
          setReport(data);
        }
      } catch (error) {
        console.error('Failed to fetch report:', error);
      }
    };
    fetchReport();
  }, [ticket.id]);

  const startTestServer = async () => {
    setIsStartingServer(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/test-server`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setTestUrl(data.url);
      } else {
        setServerError(data.details || data.error || 'Failed to start server');
      }
    } catch (error) {
      console.error('Failed to start test server:', error);
      setServerError('Network error - could not start server');
    } finally {
      setIsStartingServer(false);
    }
  };

  const copyBranchName = () => {
    navigator.clipboard.writeText(branchName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMerge = async () => {
    // Stop test server first
    await fetch(`/api/tickets/${ticket.id}/test-server`, { method: 'DELETE' }).catch(() => {});

    setIsMerging(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/merge`, {
        method: 'POST',
      });
      if (res.ok) {
        onMerged();
      } else {
        const data = await res.json();
        setServerError(data.details || data.error || 'Failed to merge');
      }
    } catch (error) {
      console.error('Failed to merge:', error);
      setServerError('Network error - could not merge');
    } finally {
      setIsMerging(false);
    }
  };

  const handleReject = async () => {
    // Stop test server first
    await fetch(`/api/tickets/${ticket.id}/test-server`, { method: 'DELETE' }).catch(() => {});

    setIsRejecting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        onRejected();
      } else {
        const data = await res.json();
        setServerError(data.details || data.error || 'Failed to reject');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      setServerError('Network error - could not reject');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!changeRequest.trim()) return;

    // Stop test server first
    await fetch(`/api/tickets/${ticket.id}/test-server`, { method: 'DELETE' }).catch(() => {});

    setIsSubmittingChanges(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeRequest: changeRequest.trim() }),
      });
      if (res.ok) {
        setShowChangesModal(false);
        setChangeRequest('');
        onChangesRequested();
      } else {
        const data = await res.json();
        setServerError(data.details || data.error || 'Failed to request changes');
      }
    } catch (error) {
      console.error('Failed to request changes:', error);
      setServerError('Network error - could not request changes');
    } finally {
      setIsSubmittingChanges(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployError(null);
    setDeploySuccess(null);
    try {
      const res = await fetch('/api/hosting/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeploySuccess(data.message || 'Deployment started successfully');
      } else {
        setDeployError(data.details || data.error || 'Deployment failed');
      }
    } catch (error) {
      console.error('Deploy error:', error);
      setDeployError('Network error - could not deploy');
    } finally {
      setIsDeploying(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
      <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        Testing Required
      </h3>

      {/* Ralph Report Card */}
      {report && (
        <div className="mb-4 bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Execution Report</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium ${report.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {report.success ? 'Success' : 'Failed'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-500">Model</div>
              <div className="font-medium text-gray-800 truncate" title={report.model}>
                {report.model.includes('opus') ? 'Opus 4.5' : report.model.includes('sonnet') ? 'Sonnet 4' : report.model}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-500">Duration</div>
              <div className="font-medium text-gray-800">{formatDuration(report.durationMs)}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-500">Cost</div>
              <div className="font-medium text-gray-800">${report.totalCostUsd.toFixed(4)}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-500">Turns</div>
              <div className="font-medium text-gray-800">{report.numTurns}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Token Usage</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                Input: {report.usage.inputTokens.toLocaleString()}
              </span>
              <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                Output: {report.usage.outputTokens.toLocaleString()}
              </span>
              {report.usage.cacheReadTokens > 0 && (
                <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                  Cache Read: {report.usage.cacheReadTokens.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test URL - Primary focus */}
      <div className="mb-4 bg-white rounded-lg p-4 border-2 border-orange-300">
        {isStartingServer ? (
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
            <span className="text-orange-600 font-medium">Starting test server...</span>
          </div>
        ) : testUrl ? (
          <div>
            <label className="text-xs text-orange-600 font-medium block mb-2">Test URL</label>
            <a
              href={testUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-orange-100 px-4 py-3 rounded-lg text-orange-800 hover:bg-orange-200 transition-colors text-lg font-mono font-semibold text-center"
            >
              {testUrl}
              <span className="ml-2 text-sm">↗</span>
            </a>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Click to open in new tab. Server running on branch: <code className="bg-gray-100 px-1 rounded">{branchName}</code>
            </p>
          </div>
        ) : serverError ? (
          <div className="text-center">
            <div className="text-red-500 mb-2">{serverError}</div>
            <button
              onClick={startTestServer}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
            >
              Retry
            </button>
            <div className="mt-3 text-xs text-gray-500">
              <p>Manual test: Open terminal in project directory and run:</p>
              <code className="block bg-gray-100 p-2 rounded mt-1">
                git checkout {branchName} && npm run dev
              </code>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <button
              onClick={startTestServer}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
            >
              Start Test Server
            </button>
          </div>
        )}
      </div>

      {/* Branch Info - Secondary */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-gray-500">Branch:</span>
        <code className="flex-1 bg-white px-2 py-1 rounded border border-orange-200 font-mono text-gray-700 truncate text-xs">
          {branchName}
        </code>
        <button
          onClick={copyBranchName}
          className="px-2 py-1 bg-white border border-orange-200 rounded hover:bg-orange-100 transition-colors"
          title="Copy branch name"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          )}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleMerge}
          disabled={isMerging || isRejecting || isSubmittingChanges}
          className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          {isMerging ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Merging...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve & Merge
            </>
          )}
        </button>
        <button
          onClick={() => setShowChangesModal(true)}
          disabled={isMerging || isRejecting || isSubmittingChanges}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Request Changes
        </button>
        <button
          onClick={handleReject}
          disabled={isMerging || isRejecting || isSubmittingChanges}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {isRejecting ? 'Rejecting...' : 'Reject'}
        </button>
      </div>

      {/* Deploy Section */}
      <div className="mt-4 pt-4 border-t border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-700">Deploy to Production</h4>
            <p className="text-xs text-gray-500">After testing, deploy the changes</p>
          </div>
          <button
            onClick={handleDeploy}
            disabled={isDeploying || isMerging}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors text-sm font-medium flex items-center gap-2"
          >
            {isDeploying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deploying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Deploy
              </>
            )}
          </button>
        </div>
        {deployError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {deployError}
          </div>
        )}
        {deploySuccess && (
          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            {deploySuccess}
          </div>
        )}
      </div>

      {/* Request Changes Modal */}
      {showChangesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Request Changes</h3>
            <p className="text-sm text-gray-600 mb-4">
              Describe what changes you'd like Ralph to make. Be specific about what needs to be fixed or improved.
            </p>
            <textarea
              value={changeRequest}
              onChange={(e) => setChangeRequest(e.target.value)}
              placeholder="E.g., The button should be blue instead of green, add padding to the header, fix the login form validation..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowChangesModal(false);
                  setChangeRequest('');
                }}
                disabled={isSubmittingChanges}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={isSubmittingChanges || !changeRequest.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {isSubmittingChanges ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending to Ralph...
                  </>
                ) : (
                  'Send to Ralph'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
