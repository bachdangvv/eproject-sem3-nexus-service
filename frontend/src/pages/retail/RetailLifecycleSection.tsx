/**
 * Retail read-only connection lifecycle tracker and termination refund inspection section.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  ServiceTypeToken,
  StatusLabel,
  formatUsd,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { SECURITY_DEPOSIT_USD } from '../../data/tariffs';
import { useClientPagination } from '../../hooks/useClientPagination';
import { getConnections } from '../../services/operationsApi';
import type {
  ConnectionLifecycleView,
  ServiceTypeCode,
} from '../../types/nexus';
import type { RetailSectionProps } from './retailTypes';

type ConnectionRow = ConnectionLifecycleView & Record<string, unknown>;

const STATUS_FILTER_ITEMS = [
  { value: 'ALL', label: 'All Lifecycle States' },
  { value: 'Active', label: 'Active Connections' },
  { value: 'TemporarilyInactive', label: 'Temporarily Inactive (Suspended)' },
  { value: 'PermanentlyInactive', label: 'Permanently Inactive (Terminated)' },
];

const SERVICE_TYPE_FILTER_ITEMS = [
  { value: 'ALL', label: 'All Service Types' },
  { value: 'B', label: 'Broadband (B)' },
  { value: 'D', label: 'Dial-Up (D)' },
  { value: 'T', label: 'Landline (T)' },
];

export function RetailLifecycleSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: RetailSectionProps): JSX.Element {
  const [connections, setConnections] = useState<ConnectionLifecycleView[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Timeline inspection drawer
  const [timelineTarget, setTimelineTarget] = useState<ConnectionLifecycleView | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const trimmedSearch = searchInput.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(trimmedSearch), 300);
    return () => window.clearTimeout(timer);
  }, [trimmedSearch]);

  const fetchConnections = useCallback(
    async (
      params: { status: string; serviceType: string; fromDate: string; toDate: string },
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
        const data = await getConnections({
          status: params.status === 'ALL' ? undefined : params.status,
          serviceType: params.serviceType === 'ALL' ? undefined : params.serviceType,
          fromDate: params.fromDate.trim() || undefined,
          toDate: params.toDate.trim() || undefined,
        });
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setConnections(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        const msg = err instanceof Error ? err.message : 'Failed to load connections.';
        setLoadError(msg);
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
        return fetchConnections(
          { status: statusFilter, serviceType: serviceFilter, fromDate, toDate },
          isSilent,
        );
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchConnections, fromDate, refreshTrigger, serviceFilter, statusFilter, toDate]);

  const filteredConnections = useMemo<ConnectionRow[]>(() => {
    const needle = debouncedSearch.toLowerCase();
    return connections
      .filter((c) => {
        if (serviceFilter !== 'ALL' && c.type !== serviceFilter) return false;
        if (!needle) return true;
        return (
          c.accountId.toLowerCase().includes(needle) ||
          c.customerName.toLowerCase().includes(needle) ||
          c.customerPhone.toLowerCase().includes(needle) ||
          c.cityCode.toLowerCase().includes(needle) ||
          c.planName.toLowerCase().includes(needle) ||
          String(c.orderId).includes(needle) ||
          (c.suspendReason ? c.suspendReason.toLowerCase().includes(needle) : false)
        );
      })
      .map((c) => ({ ...c }));
  }, [connections, debouncedSearch, serviceFilter]);

  const pagination = useClientPagination(filteredConnections, {
    resetKey: `${statusFilter}::${serviceFilter}::${fromDate}::${toDate}::${debouncedSearch}`,
  });

  const columns: TableColumn<ConnectionRow>[] = [
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(205),
      renderCell: (row) => <CopyableId value={row.accountId} label="Account ID" />,
    },
    {
      key: 'orderId',
      header: 'Order Ref',
      width: pixel(110),
      renderCell: (row) => <Code>{`#${row.orderId}`}</Code>,
    },
    {
      key: 'customer',
      header: 'Customer',
      width: proportional(1.5, { minWidth: 160 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.customerName}</Text>
          <Text type="supporting">{row.customerPhone}</Text>
        </VStack>
      ),
    },
    {
      key: 'plan',
      header: 'Plan & City',
      width: proportional(1.4, { minWidth: 150 }),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text type="body">{row.planName}</Text>
          <HStack gap={1.5} vAlign="center" wrap="wrap">
            <ServiceTypeToken type={row.type as ServiceTypeCode} />
            <Token size="sm" color="gray" label={`City ${row.cityCode}`} />
          </HStack>
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Lifecycle Status',
      width: pixel(160),
      renderCell: (row) => {
        if (row.status === 'Active') return <StatusLabel variant="success" label="Active" />;
        if (row.status === 'TemporarilyInactive') return <StatusLabel variant="warning" label="Suspended" />;
        return <StatusLabel variant="error" label="Terminated" />;
      },
    },
    {
      key: 'reason',
      header: 'Reason / Status Details',
      width: proportional(1.8, { minWidth: 180 }),
      renderCell: (row) => {
        if (row.status === 'TemporarilyInactive') {
          return (
            <VStack gap={0.5}>
              <Text weight="medium">{row.suspendReason || 'Suspension recorded'}</Text>
              {row.suspendedAt && (
                <Text type="supporting">
                  Suspended <Timestamp value={row.suspendedAt} format="relative" />
                </Text>
              )}
            </VStack>
          );
        }
        if (row.status === 'PermanentlyInactive') {
          return (
            <VStack gap={0.5}>
              <Text type="supporting">Terminated subscription</Text>
              {row.terminatedAt && (
                <Text type="supporting">
                  Terminated <Timestamp value={row.terminatedAt} format="date_time" />
                </Text>
              )}
            </VStack>
          );
        }
        return (
          <VStack gap={0.5}>
            <Text type="supporting">Normal service operation</Text>
            {row.activatedAt && (
              <Text type="supporting">
                Activated <Timestamp value={row.activatedAt} format="relative" />
              </Text>
            )}
          </VStack>
        );
      },
    },
    {
      key: 'refund',
      header: 'Deposit Refund',
      width: pixel(150),
      renderCell: (row) => {
        if (row.status === 'PermanentlyInactive') {
          const amount = row.refundAmount !== null && row.refundAmount !== undefined ? row.refundAmount : 0;
          return (
            <VStack gap={0.5}>
              <Text weight="semibold">{formatUsd(amount)}</Text>
              <Token
                size="sm"
                color={row.refundStatus === 'Pending' ? 'orange' : row.refundStatus === 'None' ? 'gray' : 'green'}
                label={row.refundStatus || 'None'}
              />
            </VStack>
          );
        }
        return <Text type="supporting">—</Text>;
      },
    },
    {
      key: 'timelineAction',
      header: 'Overview',
      width: pixel(140),
      align: 'end',
      renderCell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          label="View Timeline"
          onClick={() => setTimelineTarget(row)}
        />
      ),
    },
  ];

  return (
    <Card padding={5}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <TextInput
              label="Search connections"
              placeholder="Search Account ID, customer name, phone, city..."
              value={searchInput}
              onChange={setSearchInput}
            />
            <Selector
              label="Lifecycle Status"
              options={STATUS_FILTER_ITEMS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Selector
              label="Service Type"
              options={SERVICE_TYPE_FILTER_ITEMS}
              value={serviceFilter}
              onChange={setServiceFilter}
            />
            <TextInput
              label="Activated From"
              placeholder="YYYY-MM-DD"
              width={150}
              value={fromDate}
              onChange={setFromDate}
            />
            <TextInput
              label="Activated To"
              placeholder="YYYY-MM-DD"
              width={150}
              value={toDate}
              onChange={setToDate}
            />
          </HStack>
          <HStack gap={2} vAlign="center">
            {(searchInput || statusFilter !== 'ALL' || serviceFilter !== 'ALL' || fromDate || toDate) && (
              <Button
                size="sm"
                variant="ghost"
                label="Reset filters"
                onClick={() => {
                  setSearchInput('');
                  setStatusFilter('ALL');
                  setServiceFilter('ALL');
                  setFromDate('');
                  setToDate('');
                }}
              />
            )}
            <Text type="supporting" hasTabularNumbers>
              {`Total: ${filteredConnections.length} connection${filteredConnections.length === 1 ? '' : 's'}`}
            </Text>
          </HStack>
        </HStack>

        <ApiErrorBanner
          title="Failed to load connections"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading connections..." />
              <Text type="supporting">Fetching subscriber records...</Text>
            </VStack>
          </Center>
        ) : filteredConnections.length === 0 ? (
          <EmptyState
            title="No connections found"
            description={
              searchInput || statusFilter !== 'ALL' || serviceFilter !== 'ALL'
                ? 'No connections match your active search filters.'
                : 'No subscriber connections are registered.'
            }
            icon={<Icon icon="info" />}
          />
        ) : (
          <VStack gap={3}>
            <Table<ConnectionRow>
              aria-label="Retail Subscriber Connections Tracker"
              density="compact"
              dividers="rows"
              hasHover
              idKey="accountId"
              data={pagination.paginatedItems}
              columns={columns}
              rowIndexStart={pagination.rowIndexStart}
              rowCount={pagination.totalItems}
            />
            <TablePaginationFooter
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              label="Retail connections pagination"
            />
          </VStack>
        )}
      </VStack>

      {/* Retail Timeline Overview Drawer */}
      <Drawer
        isOpen={Boolean(timelineTarget)}
        onOpenChange={(open) => {
          if (!open) setTimelineTarget(null);
        }}
        label={timelineTarget ? `Timeline · ${timelineTarget.accountId}` : 'Connection Timeline'}
        width={540}
      >
        <Layout
          header={
            <DrawerHeader
              title={timelineTarget ? `Lifecycle · ${timelineTarget.accountId}` : 'Connection Timeline'}
              subtitle={timelineTarget ? `${timelineTarget.customerName} · ${timelineTarget.planName}` : undefined}
              endContent={
                timelineTarget ? (
                  timelineTarget.status === 'Active' ? (
                    <StatusLabel variant="success" label="Active" />
                  ) : timelineTarget.status === 'TemporarilyInactive' ? (
                    <StatusLabel variant="warning" label="Suspended" />
                  ) : (
                    <StatusLabel variant="error" label="Terminated" />
                  )
                ) : undefined
              }
              onOpenChange={(open) => {
                if (!open) setTimelineTarget(null);
              }}
            />
          }
          content={
            <LayoutContent>
              {timelineTarget && (
                <VStack gap={5}>
                  {/* Stepper Timeline Overview */}
                  <Card padding={4} variant="muted">
                    <Stepper
                      activeStep={
                        timelineTarget.status === 'Active'
                          ? 1
                          : timelineTarget.status === 'TemporarilyInactive'
                            ? 2
                            : 3
                      }
                      density="compact"
                      label="Connection lifecycle milestones"
                    >
                      <Step
                        step={0}
                        label="Provisioned"
                        description={
                          timelineTarget.activatedAt
                            ? new Date(timelineTarget.activatedAt).toLocaleDateString()
                            : 'Activated'
                        }
                      />
                      <Step
                        step={1}
                        label="Active Service"
                        description="Operational line"
                      />
                      {timelineTarget.status === 'TemporarilyInactive' && (
                        <Step
                          step={2}
                          label="Suspended"
                          status="warning"
                          description={timelineTarget.suspendReason || 'Suspension hold'}
                        />
                      )}
                      {timelineTarget.status === 'PermanentlyInactive' && (
                        <Step
                          step={2}
                          label="Terminated"
                          status="error"
                          description="Permanent decommission"
                        />
                      )}
                    </Stepper>
                  </Card>

                  {/* Metadata Summary */}
                  <MetadataList columns={2} title={<Heading level={4}>Subscription Summary</Heading>}>
                    <MetadataListItem label="Account ID">
                      <CopyableId value={timelineTarget.accountId} label="Account ID" />
                    </MetadataListItem>
                    <MetadataListItem label="Order Reference">
                      <Code>{`#${timelineTarget.orderId}`}</Code>
                    </MetadataListItem>
                    <MetadataListItem label="Customer Name">
                      {timelineTarget.customerName}
                    </MetadataListItem>
                    <MetadataListItem label="Customer Phone">
                      {timelineTarget.customerPhone}
                    </MetadataListItem>
                    <MetadataListItem label="Service Plan">
                      {timelineTarget.planName}
                    </MetadataListItem>
                    <MetadataListItem label="Service Type">
                      <ServiceTypeToken type={timelineTarget.type as ServiceTypeCode} />
                    </MetadataListItem>
                    <MetadataListItem label="Territory City">
                      {`City ${timelineTarget.cityCode}`}
                    </MetadataListItem>
                    <MetadataListItem label="Activated At">
                      {timelineTarget.activatedAt ? (
                        <Timestamp value={timelineTarget.activatedAt} format="date_time" />
                      ) : '—'}
                    </MetadataListItem>
                  </MetadataList>

                  {/* Suspension or Termination Details Card */}
                  {timelineTarget.status === 'TemporarilyInactive' && (
                    <Card padding={4} variant="muted">
                      <VStack gap={2}>
                        <HStack gap={2} vAlign="center">
                          <StatusLabel variant="warning" label="Currently Suspended" />
                          {timelineTarget.suspendedAt && (
                            <Text type="supporting">
                              since <Timestamp value={timelineTarget.suspendedAt} format="date_time" />
                            </Text>
                          )}
                        </HStack>
                        <Text weight="medium">
                          {`Reason: ${timelineTarget.suspendReason || 'No reason specified'}`}
                        </Text>
                        <Text type="supporting">
                          Retail Note: Line reactivations require technical dispatch or authorization.
                        </Text>
                      </VStack>
                    </Card>
                  )}

                  {timelineTarget.status === 'PermanentlyInactive' && (
                    <Card padding={4} variant="muted">
                      <VStack gap={3}>
                        <HStack hAlign="between" vAlign="center" wrap="wrap">
                          <Heading level={4}>Deposit Settlement & Termination</Heading>
                          <Token
                            size="sm"
                            color={timelineTarget.refundStatus === 'Pending' ? 'orange' : 'gray'}
                            label={`Refund: ${timelineTarget.refundStatus || 'None'}`}
                          />
                        </HStack>
                        <MetadataList columns={2}>
                          <MetadataListItem label="Terminated At">
                            {timelineTarget.terminatedAt ? (
                              <Timestamp value={timelineTarget.terminatedAt} format="date_time" />
                            ) : '—'}
                          </MetadataListItem>
                          <MetadataListItem label="Base Security Deposit">
                            {formatUsd(
                              SECURITY_DEPOSIT_USD[timelineTarget.type as ServiceTypeCode] ?? 0,
                            )}
                          </MetadataListItem>
                          <MetadataListItem label="Deposit Refund Amount">
                            <Text weight="semibold">
                              {timelineTarget.refundAmount !== null && timelineTarget.refundAmount !== undefined
                                ? formatUsd(timelineTarget.refundAmount)
                                : '$0.00'}
                            </Text>
                          </MetadataListItem>
                          <MetadataListItem label="Settlement Status">
                            {timelineTarget.refundStatus || 'None'}
                          </MetadataListItem>
                        </MetadataList>
                      </VStack>
                    </Card>
                  )}
                </VStack>
              )}
            </LayoutContent>
          }
        />
      </Drawer>
    </Card>
  );
}
