'use client';

import { useDroppable } from '@dnd-kit/core';
import TicketCard from './TicketCard';
import type { Ticket, Column } from '@/types';

const colorClasses: Record<string, { bg: string; border: string; text: string; headerBg: string }> = {
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', headerBg: 'bg-gray-100' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', headerBg: 'bg-yellow-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', headerBg: 'bg-purple-100' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', headerBg: 'bg-blue-100' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', headerBg: 'bg-orange-100' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', headerBg: 'bg-green-100' },
};

interface KanbanColumnProps {
  column: Column;
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
  isOver?: boolean;
}

export default function KanbanColumn({ column, tickets, onTicketClick, isOver: isOverProp }: KanbanColumnProps) {
  const { setNodeRef, isOver: isOverDroppable } = useDroppable({
    id: column.id,
  });

  const isOver = isOverProp || isOverDroppable;
  const colors = colorClasses[column.color] || colorClasses.gray;

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 rounded-xl border shadow-sm flex flex-col transition-all duration-200 ${
        isOver
          ? 'border-blue-400 ring-2 ring-blue-200 shadow-md'
          : `${colors.border} ${colors.bg}`
      }`}
      style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}
    >
      {/* Column Header */}
      <div className={`px-4 py-3 rounded-t-xl ${isOver ? 'bg-blue-50' : colors.headerBg}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-sm ${isOver ? 'text-blue-700' : colors.text}`}>
            {column.title}
          </h3>
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              isOver
                ? 'bg-blue-500 text-white'
                : 'bg-white/70 ' + colors.text
            }`}
          >
            {tickets.length}
          </span>
        </div>
      </div>

      {/* Tickets List */}
      <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${isOver ? 'bg-blue-50/50' : ''}`}>
        {tickets.length === 0 ? (
          <div className={`flex items-center justify-center h-24 text-sm rounded-lg border-2 border-dashed ${
            isOver ? 'border-blue-300 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-400'
          }`}>
            {isOver ? 'Drop here' : 'No tickets'}
          </div>
        ) : (
          tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
            />
          ))
        )}
      </div>
    </div>
  );
}
