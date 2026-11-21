/**
 * Client-side pagination and item focus hook for staff data tables.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS: number[] = [10, 20, 50, 100];

export interface ClientPaginationOptions {
  defaultPageSize?: number;
  resetKey?: string | number;
}

export interface ClientPaginationState<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rowIndexStart: number;
  paginatedItems: T[];
  setPage: (nextPage: number) => void;
  setPageSize: (nextPageSize: number) => void;
  focusItem: (predicate: (item: T) => boolean) => void;
}

export function useClientPagination<T>(
  items: readonly T[],
  options?: ClientPaginationOptions,
): ClientPaginationState<T> {
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const resetKey = options?.resetKey ?? '';

  const [pageSize, setPageSizeState] = useState<number>(defaultPageSize);
  const [pageState, setPageState] = useState<{ page: number; resetKey: string | number }>({
    page: 1,
    resetKey,
  });

  const pendingPredicateRef = useRef<((item: T) => boolean) | null>(null);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const rawPage = pageState.resetKey === resetKey ? pageState.page : 1;
  const page = Math.min(Math.max(1, rawPage), totalPages);
  const startOffset = (page - 1) * pageSize;
  const rowIndexStart = startOffset + 1;

  const paginatedItems = useMemo<T[]>(
    () => items.slice(startOffset, startOffset + pageSize),
    [items, pageSize, startOffset],
  );

  useEffect(() => {
    const predicate = pendingPredicateRef.current;
    if (!predicate) return;
    const index = items.findIndex(predicate);
    if (index >= 0) {
      pendingPredicateRef.current = null;
      const targetPage = Math.floor(index / pageSize) + 1;
      setPageState({ page: targetPage, resetKey });
    }
  }, [items, pageSize, resetKey]);

  const setPage = useCallback(
    (nextPage: number) => {
      setPageState({ page: nextPage, resetKey });
    },
    [resetKey],
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      setPageSizeState(nextPageSize);
      setPageState({ page: 1, resetKey });
    },
    [resetKey],
  );

  const focusItem = useCallback((predicate: (item: T) => boolean) => {
    pendingPredicateRef.current = predicate;
  }, []);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    rowIndexStart,
    paginatedItems,
    setPage,
    setPageSize,
    focusItem,
  };
}
