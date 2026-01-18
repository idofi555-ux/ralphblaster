'use client';

import { useState, useEffect } from 'react';

interface UsageSummary {
  totalApiCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedTotalCost: number;
  byType: Record<string, { count: number; cost: number }>;
}

export default function UsageTracker() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/usage?summary=true');
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch usage summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        Loading usage data...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        Failed to load usage data
      </div>
    );
  }

  const prdUsage = summary.byType['PRD_GENERATION'] || { count: 0, cost: 0 };
  const ralphUsage = summary.byType['RALPH_EXECUTION'] || { count: 0, cost: 0 };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Total API Calls</p>
          <p className="text-3xl font-bold text-gray-800">{summary.totalApiCalls}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Total Tokens</p>
          <p className="text-3xl font-bold text-gray-800">
            {(summary.totalInputTokens + summary.totalOutputTokens).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {summary.totalInputTokens.toLocaleString()} in / {summary.totalOutputTokens.toLocaleString()} out
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">API Cost</p>
          <p className="text-3xl font-bold text-green-600">$0.00</p>
          <p className="text-xs text-gray-400 mt-1">Using subscription</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Avg Tokens/Call</p>
          <p className="text-3xl font-bold text-gray-800">
            {summary.totalApiCalls > 0
              ? Math.round((summary.totalInputTokens + summary.totalOutputTokens) / summary.totalApiCalls).toLocaleString()
              : '0'}
          </p>
        </div>
      </div>

      {/* Breakdown by Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Usage Breakdown</h3>

        <div className="space-y-4">
          {/* PRD Generation */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">PRD Generation</p>
                <p className="text-sm text-gray-500">{prdUsage.count} generations</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-green-600">$0.00</p>
              <p className="text-xs text-gray-500">subscription</p>
            </div>
          </div>

          {/* Ralph Execution */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">Ralph Execution</p>
                <p className="text-sm text-gray-500">{ralphUsage.count} runs</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-green-600">$0.00</p>
              <p className="text-xs text-gray-500">subscription</p>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-green-800">Using Claude Subscription</p>
            <p className="text-green-700 mt-1">
              All operations use the Claude CLI with your subscription (Pro/Max). No additional API costs are incurred. Token counts are estimated for informational purposes only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
