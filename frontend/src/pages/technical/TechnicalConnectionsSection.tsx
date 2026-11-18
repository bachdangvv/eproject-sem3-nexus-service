import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  OrderDetailDrawer,
  ServiceTypeToken,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import { connectOrder, getOrderDetail, getOrders } from '../../services/operationsApi';
import { ApiError, type OrderDetailView, type OrderView } from '../../types/nexus';
import {
  extractErrorMessage,
  type OrderRow,
  type TechnicalSectionProps,
} from './technicalTypes';

export function TechnicalConnectionsSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: TechnicalSectionProps): JSX.Element {
  const toast = useToast();
  const { navigate } = useRouter();

  const [orders, setOrders] = useState<OrderView[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activatingCode, setActivatingCode] = useState<string | null>(null);
  const [lastActivatedOrder, setLastActivatedOrder] = useState<OrderView | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const connectingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadFeasibleOrders = useCallback(
    async (silent = false) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const data = await getOrders({ status: 'Feasible' });
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setOrders(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load Feasible orders queue.'));
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
        return loadFeasibleOrders(isSilent);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [loadFeasibleOrders, refreshTrigger]);

  const filteredOrders = useMemo<OrderRow[]>(() => {
    const needle = searchInput.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (!needle) return true;
        return (
          order.code.toLowerCase().includes(needle) ||
          order.request.customerName.toLowerCase().includes(needle) ||
          order.request.cityCode.toLowerCase().includes(needle) ||
          order.request.address.toLowerCase().includes(needle) ||
          order.request.planName.toLowerCase().includes(needle)
        );
      })
      .map((order) => ({ ...order }));
  }, [orders, searchInput]);

  const pagination = useClientPagination(filteredOrders, {
    resetKey: searchInput.trim().toLowerCase(),
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

  const handleActivateConnection = async (order: OrderView) => {
    if (connectingRef.current || activatingCode !== null) return;
    connectingRef.current = true;
    setActivatingCode(order.code);
    setActionError(null);
    try {
      const activated = await connectOrder(order.code);
      if (!isMountedRef.current) return;
      setLastActivatedOrder(activated);
      toast({
        body: activated.accountId
          ? `Connected ${activated.code} - Account ID ${activated.accountId}`
          : `Connected order ${activated.code}.`,
      });
      connectingRef.current = false;
      setActivatingCode(null);
      void loadFeasibleOrders(true);
      if (detailOpen && orderDetail?.order.code === activated.code) {
        void handleOpenDetail(activated.code);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setActionError(
        extractErrorMessage(err, `Could not activate connection for order ${order.code}.`),
      );
      if (err instanceof ApiError && err.status === 409) {
        void loadFeasibleOrders(true);
      }
    } finally {
      connectingRef.current = false;
      if (isMountedRef.current) {
        setActivatingCode(null);
      }
    }
  };

  const columns: TableColumn<OrderRow>[] = [
    {
      key: 'code',
      header: 'Order ID',
      width: pixel(190),
      renderCell: (row) => <CopyableId value={row.code} label="Order ID" />,
    },
    {
      key: 'customer',
      header: 'Customer & Site',
      width: proportional(1.8, { minWidth: 210 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.request.customerName}</Text>
          <Text type="supporting">
            City {row.request.cityCode} - {row.request.address}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'plan',
      header: 'Service Plan',
      width: proportional(1.3, { minWidth: 155 }),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text type="body">{row.request.planName}</Text>
          <ServiceTypeToken type={row.request.type} />
        </VStack>
      ),
    },
    {
      key: 'accountPreview',
      header: 'Account Format Preview',
      width: pixel(235),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Code>{`${row.request.type}${row.request.cityCode}############`}</Code>
          <Text type="supporting">16-char Account ID on activation</Text>
        </VStack>
      ),
    },
    {
      key: 'createdAt',
      header: 'Placed',
      width: pixel(160),
      renderCell: (row) => <Timestamp value={row.createdAt} format="date_time" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(185),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={2} hAlign="end" wrap="nowrap">
          <Button
            size="sm"
            variant="secondary"
            label="View"
            onClick={() => void handleOpenDetail(row.code)}
          />
          <Button
            size="sm"
            variant="primary"
            label="Activate"
            isLoading={activatingCode === row.code}
            isDisabled={activatingCode !== null}
            onClick={() => void handleActivateConnection(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <Card padding={6}>
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Badge variant="neutral" label={`${filteredOrders.length} total`} />
            <Text type="supporting">
              Activate Feasible orders to assign a permanent 16-character Account ID and enable
              Billing.
            </Text>
          </HStack>

          <TextInput
            type="search"
            label="Filter Activation Queue"
            placeholder="Filter by Order ID, customer, city, address, or plan..."
            startIcon={<Icon icon="search" />}
            hasClear
            width={340}
            value={searchInput}
            onChange={setSearchInput}
          />
        </HStack>

        {lastActivatedOrder && lastActivatedOrder.accountId ? (
          <Banner
            status="success"
            container="card"
            collapsible={false}
            isDismissable
            onDismiss={() => setLastActivatedOrder(null)}
            title={`Connection Activated - ${lastActivatedOrder.code}`}
            description={`Provisioned service for ${lastActivatedOrder.request.customerName} (${lastActivatedOrder.request.planName}).`}
            endContent={
              <HStack gap={3} vAlign="center" wrap="wrap">
                <CopyableId value={lastActivatedOrder.accountId} label="Account ID" />
                {lastActivatedOrder.activatedAt ? (
                  <Timestamp value={lastActivatedOrder.activatedAt} format="date_time" />
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  label="View All Orders"
                  onClick={() => navigate(RoutePath.TECHNICAL_ORDERS)}
                />
              </HStack>
            }
          />
        ) : null}

        <ApiErrorBanner
          title="Connection activation failed"
          error={actionError}
          onDismiss={() => setActionError(null)}
        />

        <ApiErrorBanner
          title="Connections queue error"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading && orders.length === 0 ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading feasible orders..." />
              <Text type="supporting">Loading Feasible orders ready for activation...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<OrderRow>
              aria-label="Feasible Connection Activation Queue"
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
                  title={
                    searchInput.trim()
                      ? 'No matching feasible orders'
                      : 'No feasible orders ready for activation'
                  }
                  description={
                    searchInput.trim()
                      ? 'Try clearing the queue filter to view all Feasible orders.'
                      : 'Orders assessed as Feasible will appear here for connection activation.'
                  }
                  icon={<Icon icon="wrench" />}
                  actions={
                    searchInput.trim() ? (
                      <Button
                        variant="secondary"
                        label="Clear Filter"
                        onClick={() => setSearchInput('')}
                      />
                    ) : (
                      <Button
                        variant="secondary"
                        label="Go to Assessments"
                        onClick={() => navigate(RoutePath.TECHNICAL_ASSESSMENTS)}
                      />
                    )
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
              label="Connection activation queue pagination"
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
