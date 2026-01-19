'use client';

import { useState, useRef, useEffect } from 'react';

interface PRDGeneratorProps {
  ticketId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function PRDGenerator({ ticketId, onComplete, onCancel }: PRDGeneratorProps) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'generating' | 'complete' | 'error'>('generating');
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState({ input: 0, output: 0, total: 0 });
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    const generate = async () => {
      try {
        const response = await fetch(`/api/tickets/${ticketId}/generate-prd-stream`, {
          method: 'POST',
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to start PRD generation');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'content') {
                  setContent((prev) => prev + data.text);
                } else if (data.type === 'complete') {
                  setTokens({
                    input: data.inputTokens,
                    output: data.outputTokens,
                    total: data.totalTokens,
                  });
                  setStatus('complete');
                } else if (data.type === 'error') {
                  setError(data.error);
                  setStatus('error');
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    };

    generate();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [ticketId]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === 'generating' && (
              <>
                <div className="relative">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-3 h-3 bg-purple-400 rounded-full animate-ping" />
                </div>
                <span className="font-medium text-purple-700">Generating PRD...</span>
              </>
            )}
            {status === 'complete' && (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="font-medium text-green-700">PRD Generated</span>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="font-medium text-red-700">Generation Failed</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{formatTime(elapsed)}</span>
            {tokens.total > 0 && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {tokens.total.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {status === 'generating' && (
          <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 animate-progress" />
          </div>
        )}
      </div>

      {/* Content preview */}
      <div
        ref={contentRef}
        className="max-h-64 overflow-y-auto p-4 bg-gray-50 font-mono text-sm"
      >
        {content ? (
          <pre className="whitespace-pre-wrap text-gray-700">{content}</pre>
        ) : status === 'generating' ? (
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Waiting for Claude to respond...
          </div>
        ) : null}

        {error && (
          <div className="text-red-600 bg-red-50 p-3 rounded-lg mt-2">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center bg-white">
        <div className="text-xs text-gray-400">
          {status === 'generating' && 'Claude is writing your PRD...'}
          {status === 'complete' && `Completed in ${formatTime(elapsed)} • ${tokens.input} input + ${tokens.output} output tokens`}
          {status === 'error' && 'Check your API key and try again'}
        </div>

        <div className="flex gap-2">
          {status === 'generating' && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          {status === 'complete' && (
            <button
              onClick={onComplete}
              className="px-4 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
            >
              Done
            </button>
          )}
          {status === 'error' && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 30%;
            margin-left: 35%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
