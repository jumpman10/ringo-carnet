import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
}

function getPaginationItems(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 15,
  onPageChange,
  className = '',
  itemLabel = 'registros',
}) => {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = (safeCurrent - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrent * pageSize, totalItems);

  const pages = getPaginationItems(safeCurrent, totalPages);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono select-none ${className}`}
    >
      <div className="text-neutral-400 text-[11px] text-center sm:text-left">
        Mostrando <span className="text-white font-bold">{startItem}</span> -{' '}
        <span className="text-white font-bold">{endItem}</span> de{' '}
        <span className="text-white font-bold">{totalItems}</span> {itemLabel}
        {totalPages > 1 && (
          <span className="text-neutral-500 ml-2">
            (Pág. {safeCurrent} de {totalPages})
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrent === 1}
            title="Primera página"
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrent - 1)}
            disabled={safeCurrent === 1}
            title="Página anterior"
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-0.5">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-neutral-600 text-xs">
                    ...
                  </span>
                );
              }

              const pageNum = p as number;
              const isActive = pageNum === safeCurrent;

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-7 h-7 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    isActive
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-black text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrent + 1)}
            disabled={safeCurrent === totalPages}
            title="Página siguiente"
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrent === totalPages}
            title="Última página"
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
