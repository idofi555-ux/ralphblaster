'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DevServerStatus } from '@/types';

interface DevServerControlsProps {
  projectId: string;
  initialStatus: DevServerStatus;
  initialPort: number | null;
}

export default function DevServerControls({
  projectId,
  initialStatus,
  initialPort,
}: DevServerControlsProps) {
  const [status, setStatus] = useState<DevServerStatus>(initialStatus);
  const [port, setPort] = useState<number | null>(initialPort);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll status when starting
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/dev-server`);
      const data = await res.json();
      setStatus(data.status);
      setPort(data.port);
      return data.status;
    } catch {
      return status;
    }
  }, [projectId, status]);

  useEffect(() => {
    if (status === 'STARTING') {
      const interval = setInterval(async () => {
        const newStatus = await pollStatus();
        if (newStatus !== 'STARTING') {
          clearInterval(interval);
          setIsLoading(false);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [status, pollStatus]);

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    setStatus('STARTING');

    try {
      const res = await fetch(`/api/projects/${projectId}/dev-server`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setStatus('ERROR');
        setIsLoading(false);
      } else {
        setStatus('RUNNING');
        setPort(data.port);
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to start server');
      setStatus('ERROR');
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetch(`/api/projects/${projectId}/dev-server`, {
        method: 'DELETE',
      });
      setStatus('STOPPED');
    } catch (err) {
      setError('Failed to stop server');
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors: Record<DevServerStatus, string> = {
    STOPPED: 'bg-gray-400',
    STARTING: 'bg-yellow-400 animate-pulse',
    RUNNING: 'bg-green-500',
    ERROR: 'bg-red-500',
  };

  const statusLabels: Record<DevServerStatus, string> = {
    STOPPED: 'Stopped',
    STARTING: 'Starting...',
    RUNNING: 'Running',
    ERROR: 'Error',
  };

  return (
    <div className="flex items-center gap-3">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-sm text-gray-600">{statusLabels[status]}</span>
      </div>

      {/* Localhost link when running */}
      {status === 'RUNNING' && port && (
        <a
          href={`http://localhost:${port}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800 font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
          localhost:{port}
        </a>
      )}

      {/* Start/Stop button */}
      {status === 'RUNNING' ? (
        <button
          onClick={handleStop}
          disabled={isLoading}
          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Stopping...' : 'Stop'}
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={isLoading || status === 'STARTING'}
          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 transition-colors"
        >
          {isLoading || status === 'STARTING' ? 'Starting...' : 'Start Dev'}
        </button>
      )}

      {/* Error message */}
      {error && (
        <span className="text-xs text-red-600" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
