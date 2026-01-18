'use client';

import { useEffect, useState, useRef } from 'react';
import type { RalphStatus } from '@/types';

interface RalphProgressProps {
  ticketId: string;
  status: RalphStatus;
}

interface ProgressData {
  status: RalphStatus;
  phase?: string;
  message?: string;
  logs?: string;
  fullLogs?: string;
  duration?: number;
  error?: string;
}

const statusConfig = {
  LAUNCHING: {
    label: 'Launching',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    pulseColor: 'bg-yellow-400',
  },
  RUNNING: {
    label: 'Running',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    pulseColor: 'bg-blue-400',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    pulseColor: 'bg-green-400',
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    pulseColor: 'bg-red-400',
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

export default function RalphProgress({ ticketId, status: initialStatus }: RalphProgressProps) {
  const [status, setStatus] = useState<RalphStatus>(initialStatus);
  const [logs, setLogs] = useState<string>('');
  const [phase, setPhase] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && isExpanded) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  useEffect(() => {
    if (initialStatus === 'RUNNING' || initialStatus === 'LAUNCHING') {
      const eventSource = new EventSource(`/api/tickets/${ticketId}/ralph-status`);

      eventSource.onmessage = (event) => {
        try {
          const data: ProgressData = JSON.parse(event.data);

          if (data.error) {
            console.error('SSE error:', data.error);
            return;
          }

          if (data.status) {
            setStatus(data.status);
          }

          if (data.phase) {
            setPhase(data.phase);
          }

          if (data.message) {
            setMessage(data.message);
          }

          if (data.duration !== undefined) {
            setDuration(data.duration);
          }

          // Handle logs
          if (data.fullLogs) {
            setLogs(data.fullLogs);
          } else if (data.logs) {
            setLogs((prev) => prev + data.logs);
          }

          // Close connection if complete
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            eventSource.close();
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [ticketId, initialStatus]);

  const config = statusConfig[status];
  const isActive = status === 'RUNNING' || status === 'LAUNCHING';

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${config.pulseColor}`} />
            {isActive && (
              <div className={`absolute inset-0 w-3 h-3 rounded-full ${config.pulseColor} animate-ping opacity-75`} />
            )}
          </div>

          <div>
            <span className={`font-semibold ${config.color}`}>
              Ralph: {config.label}
            </span>
            {phase && phase !== status && (
              <span className="text-gray-500 text-sm ml-2">- {phase}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {duration > 0 && (
            <span className="text-sm text-gray-500">
              {formatDuration(duration)}
            </span>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message */}
      {message && isExpanded && (
        <div className="px-4 pb-2">
          <p className={`text-sm ${config.color}`}>{message}</p>
        </div>
      )}

      {/* Logs */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          <div className="bg-gray-900 max-h-80 overflow-y-auto">
            {logs ? (
              <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap p-4">
                {logs}
                <div ref={logsEndRef} />
              </pre>
            ) : (
              <div className="p-4 text-gray-500 text-sm text-center">
                {isActive ? 'Waiting for output...' : 'No logs available'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer messages */}
      {status === 'COMPLETED' && (
        <div className="px-4 py-3 bg-green-100 border-t border-green-200">
          <p className="text-green-700 text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ralph has completed the implementation. The ticket has moved to &quot;In Testing&quot;.
          </p>
        </div>
      )}

      {status === 'FAILED' && (
        <div className="px-4 py-3 bg-red-100 border-t border-red-200">
          <p className="text-red-700 text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ralph encountered an error. Check the logs above for details.
          </p>
        </div>
      )}
    </div>
  );
}
