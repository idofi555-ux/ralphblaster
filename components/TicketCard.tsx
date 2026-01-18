'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Ticket } from '@/types';

const priorityColors = {
  LOW: 'bg-gray-200 text-gray-700',
  MEDIUM: 'bg-yellow-200 text-yellow-800',
  HIGH: 'bg-red-200 text-red-800',
};

const ralphStatusColors = {
  LAUNCHING: 'bg-yellow-500',
  RUNNING: 'bg-blue-500 animate-pulse',
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
};

const ralphStatusLabels = {
  LAUNCHING: 'Launching...',
  RUNNING: 'Running',
  COMPLETED: 'Done',
  FAILED: 'Failed',
};

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
}

export default function TicketCard({ ticket, onClick, isDragging = false }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: ticket.id,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const dragging = isDragging || isBeingDragged;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (!dragging) onClick();
      }}
      className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${
        dragging
          ? 'shadow-xl border-blue-400 ring-2 ring-blue-200 opacity-90 rotate-2 scale-105'
          : 'shadow-sm border-gray-200 hover:shadow-md hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-gray-800 text-sm line-clamp-2">{ticket.title}</h4>
        {ticket.ralphStatus && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${ralphStatusColors[ticket.ralphStatus]}`}
              title={`Ralph: ${ralphStatusLabels[ticket.ralphStatus]}`}
            />
          </div>
        )}
      </div>

      <p className="text-gray-500 text-xs line-clamp-2 mb-3">{ticket.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[ticket.priority]}`}>
            {ticket.priority}
          </span>
          {ticket.prdContent && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              PRD
            </span>
          )}
        </div>
        {ticket.ralphStatus && (
          <span className={`text-xs ${
            ticket.ralphStatus === 'COMPLETED' ? 'text-green-600' :
            ticket.ralphStatus === 'FAILED' ? 'text-red-600' :
            ticket.ralphStatus === 'RUNNING' ? 'text-blue-600' :
            'text-yellow-600'
          }`}>
            {ralphStatusLabels[ticket.ralphStatus]}
          </span>
        )}
      </div>
    </div>
  );
}
