import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  OrderDetailDrawer,
  ServiceTypeToken,
  formatUsd,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import {
  connectOrderWithEquipment,
  getTechnicalEquipment,
} from '../../services/inventoryApi';
import { getOrderDetail, getOrders } from '../../services/operationsApi';
import {
  ApiError,
  type EquipmentStockView,
  type OrderDetailView,
  type OrderView,
} from '../../types/nexus';
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

  const [equipmentList, setEquipmentList] = useState<EquipmentStockView[]>([]);
  const [activationTarget, setActivationTarget] = useState<OrderView | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('none');
  const [activationError, setActivationError] = useState<string | null>(null);

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

  const loadEquipment = useCallback(async () => {
    try {
      const eq = await getTechnicalEquipment();
      if (isMountedRef.current) {
        setEquipmentList(eq);
      }
    } catch {
      // Non-blocking for connections queue
    }
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
        const [data] = await Promise.all([
          getOrders({ status: 'Feasible' }),
          loadEquipment(),
        ]);
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
    [loadEquipment, onCountChange, onRefreshingChange],
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

  const handleOpenActivation = (order: OrderView) => {
    setActivationTarget(order);
    setActivationError(null);

    // Auto-suggest equipment matching service type
    const matching = equipmentList.find((eq) => {
      if (!eq.active) return false;
      const lowerName = eq.name.toLowerCase();
      if (order.request.type === 'B') {
        return lowerName.includes('router') || lowerName.includes('optical') || lowerName.includes('gpon');
      }
      if (order.request.type === 'D') {
        return lowerName.includes('modem') || lowerName.includes('adsl');
      }
      if (order.request.type === 'T') {
        return lowerName.includes('handset') || lowerName.includes('phone') || lowerName.includes('telephone');
      }
      return false;
    });

    setSelectedProductId(matching ? String(matching.id) : 'none');
  };

  const handleConfirmActivation = async () => {
    if (!activationTarget || connectingRef.current || activatingCode !== null) return;
    connectingRef.current = true;
    setActivatingCode(activationTarget.code);
    setActivationError(null);
    setActionError(null);

    try {
      const prodId =
        selectedProductId && selectedProductId !== 'none'
          ? Number(selectedProductId)
          : null;

      const activated = await connectOrderWithEquipment(activationTarget.code, {
        productId: prodId,
      });

      if (!isMountedRef.current) return;
      setLastActivatedOrder(activated);
      toast({
        body: activated.accountId
          ? `Connected ${activated.code} - Account ID ${activated.accountId}`
          : `Connected order ${activated.code}.`,
      });

      setActivationTarget(null);
      void loadFeasibleOrders(true);

      if (detailOpen && orderDetail?.order.code === activated.code) {
        void handleOpenDetail(activated.code);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg = extractErrorMessage(
        err,
        `Could not activate connection for order ${activationTarget.code}.`,
      );
      setActivationError(msg);
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

  const selectedEquipment = useMemo(() => {
    if (!selectedProductId || selectedProductId === 'none') return null;
    return equipmentList.find((eq) => String(eq.id) === selectedProductId) ?? null;
  }, [equipmentList, selectedProductId]);

  const equipmentOptions = useMemo(() => {
    return [
      {
        value: 'none',
        label: 'None (No equipment allocated / Customer provided)',
        description: 'Provision line without issuing hardware inventory.',
      },
      ...equipmentList
        .filter((eq) => eq.active)
        .map((eq) => ({
          value: String(eq.id),
          label: `${eq.name} · ${eq.quantityInStock} in stock`,
          description: `Available: ${eq.quantityInStock} units | Fee: ${formatUsd(eq.replacementPrice)}`,
        })),
    ];
  }, [equipmentList]);

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
            onClick={() => handleOpenActivation(row)}
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
              Activate Feasible orders to allocate equipment, assign a permanent 16-character Account ID, and enable
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

      {/* Equipment Allocation & Connection Activation Dialog */}
      <Dialog
        isOpen={activationTarget !== null}
        onOpenChange={(open) => {
          if (!open && activatingCode === null) {
            setActivationTarget(null);
            setActivationError(null);
          }
        }}
        purpose="form"
        width={480}
      >
        <Layout
          header={
            <DialogHeader
              title={
                activationTarget
                  ? `Activate Connection · ${activationTarget.code}`
                  : 'Activate Connection'
              }
              subtitle="Provision subscriber line, assign hardware equipment, and allocate 16-character Account ID."
              onOpenChange={(open) => {
                if (!open && activatingCode === null) {
                  setActivationTarget(null);
                  setActivationError(null);
                }
              }}
            />
          }
          content={
            <LayoutContent>
              {activationTarget && (
                <VStack gap={4}>
                  <Card padding={4} variant="muted">
                    <MetadataList columns={2} title={<Heading level={4}>Subscription Summary</Heading>}>
                      <MetadataListItem label="Customer">
                        {activationTarget.request.customerName}
                      </MetadataListItem>
                      <MetadataListItem label="City Territory">
                        City {activationTarget.request.cityCode}
                      </MetadataListItem>
                      <MetadataListItem label="Service Plan">
                        {activationTarget.request.planName}
                      </MetadataListItem>
                      <MetadataListItem label="Service Type">
                        <ServiceTypeToken type={activationTarget.request.type} />
                      </MetadataListItem>
                      <MetadataListItem label="Installation Site">
                        {activationTarget.request.address}
                      </MetadataListItem>
                      <MetadataListItem label="Account Preview">
                        <Code>{`${activationTarget.request.type}${activationTarget.request.cityCode}############`}</Code>
                      </MetadataListItem>
                    </MetadataList>
                  </Card>

                  <ApiErrorBanner
                    title="Activation failed"
                    error={activationError}
                    onDismiss={() => setActivationError(null)}
                  />

                  <VStack gap={3}>
                    <Heading level={4}>Equipment Allocation</Heading>
                    <Text type="supporting">
                      Select subscriber terminal hardware to allocate from technical inventory upon line activation.
                    </Text>

                    <Selector
                      label="Equipment to Allocate"
                      placeholder="Select hardware or None..."
                      options={equipmentOptions}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
                    />

                    {selectedEquipment ? (
                      <Card padding={3} variant="muted">
                        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                          <VStack gap={0.5}>
                            <Text weight="semibold">{selectedEquipment.name}</Text>
                            <Text type="supporting">{selectedEquipment.description}</Text>
                          </VStack>
                          <HStack gap={2} vAlign="center">
                            <Token
                              size="sm"
                              color={
                                selectedEquipment.quantityInStock >= 10
                                  ? 'green'
                                  : selectedEquipment.quantityInStock > 0
                                    ? 'teal'
                                    : 'red'
                              }
                              label={
                                selectedEquipment.quantityInStock > 0
                                  ? `${selectedEquipment.quantityInStock} in stock`
                                  : 'Out of Stock'
                              }
                            />
                            <Token
                              size="sm"
                              color="gray"
                              label={`Fee: ${formatUsd(selectedEquipment.replacementPrice)}`}
                            />
                          </HStack>
                        </HStack>
                      </Card>
                    ) : null}
                  </VStack>
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
                <Button
                  variant="ghost"
                  label="Cancel"
                  isDisabled={activatingCode !== null}
                  onClick={() => {
                    setActivationTarget(null);
                    setActivationError(null);
                  }}
                />
                <Button
                  variant="primary"
                  label="Confirm & Activate"
                  isLoading={activatingCode !== null}
                  isDisabled={activatingCode !== null}
                  onClick={() => void handleConfirmActivation()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

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
