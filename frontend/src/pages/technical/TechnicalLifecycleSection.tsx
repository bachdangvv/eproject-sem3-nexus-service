/**
 * Technical subscriber connection lifecycle management section (suspend, reactivate, terminate, and 5-criteria filter).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
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
  ServiceTypeToken,
  StatusLabel,
  formatUsd,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  getConnections,
  reactivateConnection,
  suspendConnection,
  terminateConnection,
} from '../../services/operationsApi';
import type {
  ConnectionLifecycleView,
  ServiceTypeCode,
} from '../../types/nexus';
import { extractErrorMessage, type TechnicalSectionProps } from './technicalTypes';

type ConnectionRow = ConnectionLifecycleView & Record<string, unknown>;

const LIFECYCLE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Lifecycle States' },
  { value: 'Active', label: 'Active Connections' },
  { value: 'TemporarilyInactive', label: 'Temporarily Inactive (Suspended)' },
  { value: 'PermanentlyInactive', label: 'Permanently Inactive (Terminated)' },
];

const SERVICE_TYPE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Service Types' },
  { value: 'B', label: 'Broadband (B)' },
  { value: 'D', label: 'Dial-Up (D)' },
  { value: 'T', label: 'Landline (T)' },
];

export function TechnicalLifecycleSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: TechnicalSectionProps): JSX.Element {
  const toast = useToast();

  const [connections, setConnections] = useState<ConnectionLifecycleView[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Suspend Modal state
  const [suspendTarget, setSuspendTarget] = useState<ConnectionLifecycleView | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);

  // Reactivate Dialog state
  const [reactivateTarget, setReactivateTarget] = useState<ConnectionLifecycleView | null>(null);
  const [reactivateSubmitting, setReactivateSubmitting] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  // Terminate Modal state
  const [terminateTarget, setTerminateTarget] = useState<ConnectionLifecycleView | null>(null);
  const [terminateNote, setTerminateNote] = useState('');
  const [terminateSubmitting, setTerminateSubmitting] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);

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
        setLoadError(extractErrorMessage(err, 'Failed to load subscriber connections.'));
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

  // Action Handlers
  const handleOpenSuspend = (target: ConnectionLifecycleView) => {
    setSuspendTarget(target);
    setSuspendReason('');
    setSuspendError(null);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim() || suspendSubmitting) return;
    setSuspendSubmitting(true);
    setSuspendError(null);
    try {
      const updated = await suspendConnection(suspendTarget.accountId, {
        reason: suspendReason.trim(),
      });
      if (!isMountedRef.current) return;
      toast({ body: `Connection ${updated.accountId} suspended: ${updated.suspendReason}` });
      setSuspendTarget(null);
      void fetchConnections({ status: statusFilter, serviceType: serviceFilter, fromDate, toDate }, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setSuspendError(extractErrorMessage(err, 'Failed to suspend connection.'));
    } finally {
      if (isMountedRef.current) setSuspendSubmitting(false);
    }
  };

  const handleOpenReactivate = (target: ConnectionLifecycleView) => {
    setReactivateTarget(target);
    setReactivateError(null);
  };

  const handleConfirmReactivate = async () => {
    if (!reactivateTarget || reactivateSubmitting) return;
    setReactivateSubmitting(true);
    setReactivateError(null);
    try {
      const updated = await reactivateConnection(reactivateTarget.accountId);
      if (!isMountedRef.current) return;
      toast({ body: `Connection ${updated.accountId} reactivated successfully.` });
      setReactivateTarget(null);
      void fetchConnections({ status: statusFilter, serviceType: serviceFilter, fromDate, toDate }, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setReactivateError(extractErrorMessage(err, 'Failed to reactivate connection.'));
    } finally {
      if (isMountedRef.current) setReactivateSubmitting(false);
    }
  };

  const handleOpenTerminate = (target: ConnectionLifecycleView) => {
    setTerminateTarget(target);
    setTerminateNote('');
    setTerminateError(null);
  };

  const handleConfirmTerminate = async () => {
    if (!terminateTarget || terminateSubmitting) return;
    setTerminateSubmitting(true);
    setTerminateError(null);
    try {
      const updated = await terminateConnection(terminateTarget.accountId, {
        note: terminateNote.trim() || undefined,
      });
      if (!isMountedRef.current) return;
      const refundNotice = updated.refundAmount !== null
        ? `Refund: ${formatUsd(updated.refundAmount)} (${updated.refundStatus})`
        : 'Terminated';
      toast({ body: `Connection ${updated.accountId} permanently terminated. ${refundNotice}` });
      setTerminateTarget(null);
      void fetchConnections({ status: statusFilter, serviceType: serviceFilter, fromDate, toDate }, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setTerminateError(extractErrorMessage(err, 'Failed to terminate connection.'));
    } finally {
      if (isMountedRef.current) setTerminateSubmitting(false);
    }
  };

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
      header: 'Service & Territory',
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
      key: 'auditReason',
      header: 'Reason & Timeline',
      width: proportional(1.8, { minWidth: 180 }),
      renderCell: (row) => {
        if (row.status === 'TemporarilyInactive') {
          return (
            <VStack gap={0.5}>
              <Text weight="medium">{row.suspendReason || 'Suspension in effect'}</Text>
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
              <Text type="supporting">Terminated line</Text>
              {row.terminatedAt && (
                <Text type="supporting">
                  <Timestamp value={row.terminatedAt} format="date_time" />
                </Text>
              )}
            </VStack>
          );
        }
        return (
          <VStack gap={0.5}>
            <Text type="supporting">Active normal operations</Text>
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
                color={(row.refundStatus === 'Pending' || row.refundStatus === 'NeedsReconciliation') ? 'orange' : row.refundStatus === 'None' ? 'gray' : 'green'}
                label={row.refundStatus || 'None'}
              />
            </VStack>
          );
        }
        return <Text type="supporting">—</Text>;
      },
    },
    {
      key: 'actions',
      header: 'Staff Actions',
      width: pixel(200),
      align: 'end',
      renderCell: (row) => {
        if (row.status === 'Active') {
          return (
            <HStack gap={2} hAlign="end" wrap="nowrap">
              <Button
                size="sm"
                variant="secondary"
                label="Suspend"
                onClick={() => handleOpenSuspend(row)}
              />
              <Button
                size="sm"
                variant="destructive"
                label="Terminate"
                onClick={() => handleOpenTerminate(row)}
              />
            </HStack>
          );
        }
        if (row.status === 'TemporarilyInactive') {
          return (
            <HStack gap={2} hAlign="end" wrap="nowrap">
              <Button
                size="sm"
                variant="primary"
                label="Reactivate"
                onClick={() => handleOpenReactivate(row)}
              />
              <Button
                size="sm"
                variant="destructive"
                label="Terminate"
                onClick={() => handleOpenTerminate(row)}
              />
            </HStack>
          );
        }
        return <Token size="sm" color="gray" label="Permanently Closed" />;
      },
    },
  ];

  return (
    <Card padding={5}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <TextInput
              label="Search connections"
              placeholder="Search by Account ID, customer, city, phone..."
              value={searchInput}
              onChange={setSearchInput}
            />
            <Selector
              label="Filter by Status"
              options={LIFECYCLE_STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Selector
              label="Service Type"
              options={SERVICE_TYPE_FILTER_OPTIONS}
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
              <Spinner size="lg" label="Loading subscriber connections..." />
              <Text type="supporting">Fetching lifecycle records...</Text>
            </VStack>
          </Center>
        ) : filteredConnections.length === 0 ? (
          <EmptyState
            title="No connections found"
            description={
              searchInput || statusFilter !== 'ALL'
                ? 'No subscriber connections matched your current filter or query.'
                : 'No provisioned subscriber connections exist in the system.'
            }
            icon={<Icon icon="info" />}
            actions={
              searchInput || statusFilter !== 'ALL' ? (
                <Button
                  variant="secondary"
                  label="Reset Filters"
                  onClick={() => {
                    setSearchInput('');
                    setStatusFilter('ALL');
                  }}
                />
              ) : undefined
            }
          />
        ) : (
          <VStack gap={3}>
            <Table<ConnectionRow>
              aria-label="Subscriber Connection Lifecycle Registry"
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
              label="Technical connections pagination"
            />
          </VStack>
        )}
      </VStack>

      {/* Suspend Connection Modal */}
      <Dialog
        isOpen={Boolean(suspendTarget)}
        onOpenChange={(open) => {
          if (!open && !suspendSubmitting) {
            setSuspendTarget(null);
            setSuspendError(null);
          }
        }}
        purpose="form"
        width={480}
      >
        <Layout
          header={
            <DialogHeader
              title={suspendTarget ? `Suspend Connection · ${suspendTarget.accountId}` : 'Suspend Connection'}
              subtitle="Temporarily place subscriber line on inactive hold."
              onOpenChange={(open) => {
                if (!open && !suspendSubmitting) {
                  setSuspendTarget(null);
                  setSuspendError(null);
                }
              }}
            />
          }
          content={
            <LayoutContent>
              {suspendTarget && (
                <VStack gap={4}>
                  <Banner
                    status="warning"
                    container="card"
                    collapsible={false}
                    title="Temporary Service Suspension"
                    description="Suspending this connection immediately disconnects service access. The connection will transition to Temporarily Inactive state."
                  />

                  <Card padding={4} variant="muted">
                    <MetadataList columns={2}>
                      <MetadataListItem label="Account ID">
                        <Code>{suspendTarget.accountId}</Code>
                      </MetadataListItem>
                      <MetadataListItem label="Customer">
                        {suspendTarget.customerName}
                      </MetadataListItem>
                      <MetadataListItem label="Plan">
                        {suspendTarget.planName}
                      </MetadataListItem>
                      <MetadataListItem label="Service Type">
                        <ServiceTypeToken type={suspendTarget.type as ServiceTypeCode} />
                      </MetadataListItem>
                    </MetadataList>
                  </Card>

                  <ApiErrorBanner
                    title="Suspension failed"
                    error={suspendError}
                    onDismiss={() => setSuspendError(null)}
                  />

                  <TextInput
                    label="Suspension Reason (Required)"
                    placeholder="Enter explicit reason (e.g. Non-payment hold, Seasonal customer request)..."
                    value={suspendReason}
                    onChange={setSuspendReason}
                    isRequired
                    status={
                      suspendReason && !suspendReason.trim()
                        ? { type: 'error', message: 'Reason cannot be blank.' }
                        : undefined
                    }
                  />
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
                  isDisabled={suspendSubmitting}
                  onClick={() => {
                    setSuspendTarget(null);
                    setSuspendError(null);
                  }}
                />
                <Button
                  variant="primary"
                  label="Confirm Suspension"
                  isLoading={suspendSubmitting}
                  isDisabled={!suspendReason.trim() || suspendSubmitting}
                  onClick={() => void handleConfirmSuspend()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* Reactivate Connection Dialog */}
      <Dialog
        isOpen={Boolean(reactivateTarget)}
        onOpenChange={(open) => {
          if (!open && !reactivateSubmitting) {
            setReactivateTarget(null);
            setReactivateError(null);
          }
        }}
        purpose="required"
        width={460}
      >
        <Layout
          header={
            <DialogHeader
              title={reactivateTarget ? `Reactivate Connection · ${reactivateTarget.accountId}` : 'Reactivate Connection'}
              subtitle="Restore line connectivity to Active state."
              onOpenChange={(open) => {
                if (!open && !reactivateSubmitting) {
                  setReactivateTarget(null);
                  setReactivateError(null);
                }
              }}
            />
          }
          content={
            <LayoutContent>
              {reactivateTarget && (
                <VStack gap={4}>
                  <Text>
                    Are you sure you want to restore this subscriber connection to <Text weight="semibold">Active</Text> status? The previous suspension reason will be cleared and network service will be restored immediately.
                  </Text>

                  <Card padding={4} variant="muted">
                    <MetadataList columns={2}>
                      <MetadataListItem label="Account ID">
                        <Code>{reactivateTarget.accountId}</Code>
                      </MetadataListItem>
                      <MetadataListItem label="Customer">
                        {reactivateTarget.customerName}
                      </MetadataListItem>
                      <MetadataListItem label="Previous Reason">
                        {reactivateTarget.suspendReason || 'None'}
                      </MetadataListItem>
                      <MetadataListItem label="Suspended At">
                        {reactivateTarget.suspendedAt ? (
                          <Timestamp value={reactivateTarget.suspendedAt} format="date_time" />
                        ) : '—'}
                      </MetadataListItem>
                    </MetadataList>
                  </Card>

                  <ApiErrorBanner
                    title="Reactivation failed"
                    error={reactivateError}
                    onDismiss={() => setReactivateError(null)}
                  />
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
                  isDisabled={reactivateSubmitting}
                  onClick={() => {
                    setReactivateTarget(null);
                    setReactivateError(null);
                  }}
                />
                <Button
                  variant="primary"
                  label="Confirm Reactivation"
                  isLoading={reactivateSubmitting}
                  isDisabled={reactivateSubmitting}
                  onClick={() => void handleConfirmReactivate()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* Terminate Connection Modal */}
      <Dialog
        isOpen={Boolean(terminateTarget)}
        onOpenChange={(open) => {
          if (!open && !terminateSubmitting) {
            setTerminateTarget(null);
            setTerminateError(null);
          }
        }}
        purpose="form"
        width={520}
      >
        <Layout
          header={
            <DialogHeader
              title={terminateTarget ? `Terminate Connection · ${terminateTarget.accountId}` : 'Terminate Connection'}
              subtitle="Permanently close the line. Billing handles deposit disbursement separately."
              onOpenChange={(open) => {
                if (!open && !terminateSubmitting) {
                  setTerminateTarget(null);
                  setTerminateError(null);
                }
              }}
            />
          }
          content={
            <LayoutContent>
              {terminateTarget && (
                <VStack gap={4}>
                  <Banner
                    status="error"
                    container="card"
                    collapsible={false}
                    title="Irreversible Action"
                    description="Terminating permanently closes the subscriber line. Only verified held deposit becomes refundable. Billing records the actual disbursement; service debt and equipment charges remain separate."
                  />

                  <Card padding={4} variant="muted">
                    <VStack gap={3}>
                      <Heading level={4}>Security Deposit Refund Breakdown</Heading>
                      <MetadataList columns={2}>
                        <MetadataListItem label="Connection Type">
                          <ServiceTypeToken type={terminateTarget.type as ServiceTypeCode} />
                        </MetadataListItem>
                        <MetadataListItem label="Verified Held Deposit">
                          <Text weight="semibold">
                            {formatUsd(
                              terminateTarget.deposit?.balance ?? 0,
                            )}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Unpaid Invoice Dues">
                          <Text color="secondary">Billed separately</Text>
                        </MetadataListItem>
                        <MetadataListItem label="Unsettled Damage Fees">
                          <Text color="secondary">Billed separately</Text>
                        </MetadataListItem>
                      </MetadataList>
                      <Divider />
                      <HStack hAlign="between" vAlign="center" wrap="wrap">
                        <Text type="supporting">Held deposit = verified collected − already refunded. Legacy evidence must be reconciled before refund.</Text>
                        <Token size="sm" color="orange" label={terminateTarget.deposit?.needsReconciliation ? 'Needs Reconciliation' : 'Billing Disburses Separately'} />
                      </HStack>
                    </VStack>
                  </Card>

                  <ApiErrorBanner
                    title="Termination failed"
                    error={terminateError}
                    onDismiss={() => setTerminateError(null)}
                  />

                  <TextInput
                    label="Termination Audit Note (Optional)"
                    placeholder="e.g. Subscriber requested account closure, permanent relocation abroad..."
                    value={terminateNote}
                    onChange={setTerminateNote}
                  />
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
                  isDisabled={terminateSubmitting}
                  onClick={() => {
                    setTerminateTarget(null);
                    setTerminateError(null);
                  }}
                />
                <Button
                  variant="destructive"
                  label="Terminate Connection"
                  isLoading={terminateSubmitting}
                  isDisabled={terminateSubmitting}
                  onClick={() => void handleConfirmTerminate()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </Card>
  );
}
