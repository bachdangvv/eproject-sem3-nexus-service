import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  OrderDetailDrawer,
  OrderStatusPill,
  ServiceTypeToken,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { getOrderDetail, getOrders } from '../../services/operationsApi';
import type { OrderDetailView, OrderView } from '../../types/nexus';
import {
  extractErrorMessage,
  isValidOrderCode,
  ORDER_STATUS_FILTER_ITEMS,
  type OrderRow,
  type OrderStatusFilter,
  type TechnicalSectionProps,
} from './technicalTypes';

export function TechnicalOrdersSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: TechnicalSectionProps): JSX.Element {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const trimmedSearch = searchInput.trim();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(trimmedSearch);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [trimmedSearch]);

  const exactServerCode = useMemo(
    () => (isValidOrderCode(debouncedSearch) ? debouncedSearch.trim().toUpperCase() : undefined),
    [debouncedSearch],
  );

  const fetchOrders = useCallback(
    async (
      status: OrderStatusFilter,
      exactCode: string | undefined,
      silent = false,
    ) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const data = await getOrders({
          status: status === 'ALL' ? undefined : status,
          code: exactCode,
        });
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setOrders(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load technical orders.'));
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [onCountChange, onRefreshingChange],
  );

  useEffect(() => {
    const isSilent = hasLoadedOnceRef.current && refreshTrigger > 0;
    hasLoadedOnceRef.current = true;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled && isMountedRef.current) {
        return fetchOrders(statusFilter, exactServerCode, isSilent);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [exactServerCode, fetchOrders, refreshTrigger, statusFilter]);

  const filteredOrders = useMemo<OrderRow[]>(() => {
    const needle = trimmedSearch.toLowerCase();
    return orders
      .filter((order) => {
        if (!needle) return true;
        return (
          order.code.toLowerCase().includes(needle) ||
          order.request.customerName.toLowerCase().includes(needle) ||
          order.request.cityCode.toLowerCase().includes(needle) ||
          order.request.address.toLowerCase().includes(needle) ||
          order.request.planName.toLowerCase().includes(needle) ||
          (order.accountId ? order.accountId.toLowerCase().includes(needle) : false)
        );
      })
      .map((order) => ({ ...order }));
  }, [orders, trimmedSearch]);

  const pagination = useClientPagination(filteredOrders, {
    resetKey: `${statusFilter}::${trimmedSearch.toLowerCase()}`,
  });

  const handleOpenDetail = async (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;

    const seq = ++detailSeqRef.current;
    setDetailOpen(true);
    setOrderDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await getOrderDetail(normalized);
      if (!isMountedRef.current || seq !== detailSeqRef.current) return;
      setOrderDetail(detail);
    } catch (err) {
      if (!isMountedRef.current || seq !== detailSeqRef.current) return;
      setDetailError(extractErrorMessage(err, `Could not load details for order ${normalized}.`));
    } finally {
      if (isMountedRef.current && seq === detailSeqRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      detailSeqRef.current += 1;
      setDetailLoading(false);
    }
  };

  const columns: TableColumn<OrderRow>[] = [
    {
      key: 'code',
      header: 'Order ID',
      width: pixel(180),
      renderCell: (row) => <CopyableId value={row.code} label="Order ID" />,
    },
    {
      key: 'customer',
      header: 'Customer',
      width: proportional(1.5, { minWidth: 130 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.request.customerName}</Text>
          <Text type="supporting">City {row.request.cityCode}</Text>
        </VStack>
      ),
    },
    {
      key: 'plan',
      header: 'Service Plan',
      width: proportional(1.3, { minWidth: 125 }),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text type="body">{row.request.planName}</Text>
          <ServiceTypeToken type={row.request.type} />
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(122),
      renderCell: (row) => <OrderStatusPill status={row.status} />,
    },
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(225),
      renderCell: (row) =>
        row.accountId ? (
          <CopyableId value={row.accountId} label="Account ID" />
        ) : (
          <Text type="supporting">Pending activation</Text>
        ),
    },
    {
      key: 'createdAt',
      header: 'Placed',
      width: pixel(150),
      renderCell: (row) => <Timestamp value={row.createdAt} format="date_time" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(100),
      align: 'end',
      renderCell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          label="View"
          onClick={() => void handleOpenDetail(row.code)}
        />
      ),
    },
  ];

  return (
    <Card padding={6}>
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <Selector
              label="Status"
              options={ORDER_STATUS_FILTER_ITEMS}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as OrderStatusFilter)}
              width={200}
            />
            <Badge variant="neutral" label={`${filteredOrders.length} total`} />
          </HStack>

          <TextInput
            type="search"
            label="Search Orders"
            placeholder="Filter by Order ID, customer, address, plan, or Account ID..."
            description="Partial text filters loaded orders; full 11-char Order ID (e.g. B0000000001) queries exact match."
            startIcon={<Icon icon="search" />}
            hasClear
            width={360}
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              if (value === '') {
                setDebouncedSearch('');
              }
            }}
            onEnter={() => setDebouncedSearch(trimmedSearch)}
          />
        </HStack>

        <ApiErrorBanner
          title="Orders lookup error"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading && orders.length === 0 ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading orders..." />
              <Text type="supporting">Loading technical service orders...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<OrderRow>
              aria-label="Technical Service Orders Registry"
              density="compact"
              dividers="rows"
              hasHover
              idKey="code"
              columns={columns}
              data={pagination.paginatedItems}
              rowIndexStart={pagination.rowIndexStart}
              rowCount={pagination.totalItems}
              emptyState={
                <EmptyState
                  title="No matching orders"
                  description={
                    statusFilter !== 'ALL' || trimmedSearch
                      ? 'Try clearing the search query or switching the status filter to All.'
                      : 'No confirmed orders have been placed yet.'
                  }
                  icon={<Icon icon="info" />}
                  actions={
                    statusFilter !== 'ALL' || trimmedSearch ? (
                      <Button
                        variant="secondary"
                        label="Reset Filters"
                        onClick={() => {
                          setStatusFilter('ALL');
                          setSearchInput('');
                          setDebouncedSearch('');
                        }}
                      />
                    ) : undefined
                  }
                />
              }
            />
            <TablePaginationFooter
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              label="Technical orders pagination"
            />
          </>
        )}
      </VStack>

      <OrderDetailDrawer
        detail={orderDetail}
        isOpen={detailOpen}
        onOpenChange={handleDetailOpenChange}
        isLoading={detailLoading}
        error={detailError}
      />
    </Card>
  );
}
