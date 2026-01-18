'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
} from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import TicketCard from './TicketCard';
import CreateTicketModal from './CreateTicketModal';
import TicketDetailModal from './TicketDetailModal';
import SkeletonCard from './SkeletonCard';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { Ticket, Column, TicketStatus } from '@/types';

const COLUMNS: Column[] = [
  { id: 'BACKLOG', title: 'Backlog', color: 'gray' },
  { id: 'UP_NEXT', title: 'Up Next', color: 'yellow' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'purple' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'blue' },
  { id: 'IN_TESTING', title: 'In Testing', color: 'orange' },
  { id: 'COMPLETED', title: 'Completed', color: 'green' },
];

export default function KanbanBoard({ projectId }: { projectId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      callback: () => setIsCreateModalOpen(true),
      description: 'Create new ticket',
    },
    {
      key: 'Escape',
      callback: () => {
        setSelectedTicket(null);
        setIsCreateModalOpen(false);
      },
      description: 'Close modal',
    },
    {
      key: 'r',
      callback: () => fetchTickets(),
      description: 'Refresh tickets',
    },
  ], !isCreateModalOpen && !selectedTicket);

  useEffect(() => {
    fetchTickets();
  }, [projectId]);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tickets?projectId=${projectId}`);
      const data = await res.json();
      setTickets(data);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    setOverId(null);

    if (!over) return;

    const ticketId = active.id as string;
    const newStatus = over.id as string;

    if (!COLUMNS.some((col) => col.id === newStatus)) return;

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus as TicketStatus } : t))
    );

    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      fetchTickets();
    }
  };

  const handleDragCancel = () => {
    setActiveTicket(null);
    setOverId(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center px-4 py-4 bg-white border-b border-gray-200">
          <div className="h-6 w-24 bg-gray-200 rounded animate-shimmer" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-shimmer" />
        </div>

        {/* Columns Skeleton */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map((column) => (
              <div
                key={column.id}
                className="w-72 flex-shrink-0 bg-gray-100 rounded-xl p-3"
                style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="h-5 w-20 bg-gray-200 rounded animate-shimmer" />
                  <div className="h-5 w-6 bg-gray-200 rounded-full animate-shimmer" />
                </div>
                <div className="space-y-3">
                  {[...Array(column.id === 'BACKLOG' ? 3 : column.id === 'IN_PROGRESS' ? 2 : 1)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700">
          {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
        </h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <KeyboardShortcutsHelp />
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 sm:flex-none bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            + New Ticket
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tickets={tickets.filter((t) => t.status === column.id)}
                onTicketClick={setSelectedTicket}
                isOver={overId === column.id}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTicket ? (
            <TicketCard ticket={activeTicket} onClick={() => {}} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {isCreateModalOpen && (
        <CreateTicketModal
          projectId={projectId}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={fetchTickets}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => {
            fetchTickets();
            fetch(`/api/tickets/${selectedTicket.id}`)
              .then((res) => res.json())
              .then((data) => setSelectedTicket(data))
              .catch(() => setSelectedTicket(null));
          }}
        />
      )}
    </div>
  );
}
