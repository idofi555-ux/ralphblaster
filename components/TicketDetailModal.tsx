'use client';

import { useState } from 'react';
import PRDViewer from './PRDViewer';
import RalphProgress from './RalphProgress';
import { useToast } from '@/contexts/ToastContext';
import { useEscapeKey } from '@/hooks/useKeyboardShortcuts';
import type { Ticket, Priority } from '@/types';

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdated: () => void;
}

export default function TicketDetailModal({ ticket, onClose, onUpdated }: TicketDetailModalProps) {
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // Close on Escape key
  useEscapeKey(onClose);
  const [editForm, setEditForm] = useState({
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
  });
  const [isGeneratingPRD, setIsGeneratingPRD] = useState(false);
  const [isStartingRalph, setIsStartingRalph] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const generatePRD = async () => {
    setIsGeneratingPRD(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/generate-prd`, {
        method: 'POST',
      });
      if (res.ok) {
        addToast('PRD generated successfully!', 'success');
        onUpdated();
      } else {
        const data = await res.json();
        const errorMsg = data.details || data.error || 'Failed to generate PRD';
        addToast(errorMsg, 'error', 6000);
      }
    } catch (error) {
      console.error('Failed to generate PRD:', error);
      addToast('Failed to generate PRD. Check your network connection.', 'error');
    } finally {
      setIsGeneratingPRD(false);
    }
  };

  const startRalph = async () => {
    setIsStartingRalph(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/start-ralph`, {
        method: 'POST',
      });
      if (res.ok) {
        addToast('Ralph started! Watch the progress below.', 'success');
        onUpdated();
      } else {
        const data = await res.json();
        const errorMsg = data.details || data.error || 'Failed to start Ralph';
        addToast(errorMsg, 'error', 8000);
      }
    } catch (error) {
      console.error('Failed to start Ralph:', error);
      addToast('Failed to start Ralph', 'error');
    } finally {
      setIsStartingRalph(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setIsEditing(false);
        addToast('Ticket updated successfully', 'success');
        onUpdated();
      } else {
        addToast('Failed to update ticket', 'error');
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
      addToast('Failed to update ticket', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        addToast('Ticket deleted', 'success');
        onClose();
        onUpdated();
      } else {
        addToast('Failed to delete ticket', 'error');
      }
    } catch (error) {
      console.error('Failed to delete ticket:', error);
      addToast('Failed to delete ticket', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const priorityColors = {
    LOW: 'bg-gray-100 text-gray-700 border-gray-300',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    HIGH: 'bg-red-100 text-red-700 border-red-300',
  };

  const statusLabels: Record<string, string> = {
    BACKLOG: 'Backlog',
    UP_NEXT: 'Up Next',
    IN_REVIEW: 'In Review',
    IN_PROGRESS: 'In Progress',
    IN_TESTING: 'In Testing',
    COMPLETED: 'Completed',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-4">
            {isEditing ? (
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="text-xl font-bold text-gray-800 w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-800 truncate">{ticket.title}</h2>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-1 rounded-full border ${priorityColors[ticket.priority]}`}>
                {ticket.priority}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {statusLabels[ticket.status]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700">Description</h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Priority:</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as Priority })}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        title: ticket.title,
                        description: ticket.description,
                        priority: ticket.priority,
                      });
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm">
                {ticket.description}
              </p>
            )}
          </div>

          {/* PRD Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700">Product Requirements Document</h3>
              {!ticket.prdContent && (
                <button
                  onClick={generatePRD}
                  disabled={isGeneratingPRD}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {isGeneratingPRD ? 'Generating...' : 'Generate PRD'}
                </button>
              )}
            </div>
            {ticket.prdContent ? (
              <PRDViewer
                content={ticket.prdContent}
                onRegenerate={generatePRD}
                isRegenerating={isGeneratingPRD}
              />
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <div className="text-4xl mb-2">📄</div>
                <p className="text-gray-500 text-sm">
                  No PRD generated yet. Click &quot;Generate PRD&quot; to create one using Claude.
                </p>
              </div>
            )}
          </div>

          {/* Ralph Execution Section */}
          {ticket.prdContent && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-700">Ralph Execution</h3>
                {!ticket.ralphStatus && (
                  <button
                    onClick={startRalph}
                    disabled={isStartingRalph}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {isStartingRalph ? 'Starting...' : 'Start Ralph'}
                  </button>
                )}
              </div>
              {ticket.ralphStatus ? (
                <RalphProgress ticketId={ticket.id} status={ticket.ralphStatus} />
              ) : (
                <div className="bg-blue-50 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-2">🤖</div>
                  <p className="text-blue-600 text-sm">
                    Ralph is ready to implement this PRD autonomously.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-500 hover:text-red-600 text-sm font-medium"
          >
            Delete Ticket
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
          >
            Close
          </button>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Ticket?</h3>
              <p className="text-gray-600 mb-6 text-sm">
                This will permanently delete &quot;{ticket.title}&quot;. This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
