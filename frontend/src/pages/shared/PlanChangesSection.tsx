import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
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
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { formatPlanPriceWithCycle } from '../../data/tariffs';
import { useClientPagination } from '../../hooks/useClientPagination';
import { getPlans } from '../../services/catalogApi';
import {
  approvePlanChange,
  getConnections,
  getPlanChanges,
  rejectPlanChange,
  submitPlanChange,
} from '../../services/operationsApi';
import {
  ApiError,
  type ConnectionLifecycleView,
  type PlanChangeRequestView,
  type PlanChangeStatus,
  type PlanView,
  type ServiceTypeCode,
} from '../../types/nexus';

type PlanChangeRow = PlanChangeRequestView & Record<string, unknown>;

export interface PlanChangesSectionProps {
  roleMode: 'retail' | 'admin' | 'technical';
  refreshTrigger: number;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Request Statuses' },
  { value: 'Pending', label: 'Pending Review' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.detail || err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

function renderPlanChangeStatus(status: PlanChangeStatus) {
  switch (status) {
    case 'Pending':
      return <StatusLabel variant="warning" label="Pending" />;
    case 'Approved':
      return <StatusLabel variant="success" label="Approved" />;
    case 'Rejected':
      return <StatusLabel variant="error" label="Rejected" />;
  }
}

export function PlanChangesSection({
  roleMode,
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: PlanChangesSectionProps): JSX.Element {
  const toast = useToast();

  const [requests, setRequests] = useState<PlanChangeRequestView[]>([]);
  const [connections, setConnections] = useState<ConnectionLifecycleView[]>([]);
  const [allPlans, setAllPlans] = useState<PlanView[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Retail Submit Modal state
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedTargetPlanId, setSelectedTargetPlanId] = useState<string>('');
  const [submitNote, setSubmitNote] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Admin Review Modals state
  const [approveTarget, setApproveTarget] = useState<PlanChangeRequestView | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PlanChangeRequestView | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Detail inspection drawer
  const [detailTarget, setDetailTarget] = useState<PlanChangeRequestView | null>(null);

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

  const plans = useMemo(() => allPlans.filter((p) => p.active), [allPlans]);
  const plansById = useMemo(
    () => new Map(allPlans.map((p) => [p.id, p])),
    [allPlans],
  );

  const fetchCatalogOptions = useCallback(async () => {
    try {
      const [fetchedPlans, activeConnections] = await Promise.all([
        getPlans(),
        roleMode === 'retail' ? getConnections({ status: 'Active' }) : Promise.resolve([]),
      ]);
      if (!isMountedRef.current) return;
      setAllPlans(fetchedPlans);
      if (roleMode === 'retail') {
        setConnections(activeConnections);
      }
    } catch {
      // Non-fatal on mount; user sees error if opening modal without options
    }
  }, [roleMode]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getPlans(),
      roleMode === 'retail' ? getConnections({ status: 'Active' }) : Promise.resolve([]),
    ])
      .then(([fetchedPlans, activeConnections]) => {
        if (cancelled || !isMountedRef.current) return;
        setAllPlans(fetchedPlans);
        if (roleMode === 'retail') {
          setConnections(activeConnections);
        }
      })
      .catch(() => {
        // Non-fatal on mount; user sees error if opening modal without options
      });
    return () => {
      cancelled = true;
    };
  }, [roleMode]);

  const fetchPlanChanges = useCallback(
    async (status: string, silent = false) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const data = await getPlanChanges({
          status: status === 'ALL' ? undefined : status,
        });
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setRequests(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractError(err, 'Failed to load plan change requests.'));
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
        return fetchPlanChanges(statusFilter, isSilent);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPlanChanges, refreshTrigger, statusFilter]);

  const filteredRequests = useMemo<PlanChangeRow[]>(() => {
    const needle = debouncedSearch.toLowerCase();
    return requests
      .filter((req) => {
        if (!needle) return true;
        return (
          String(req.id).includes(needle) ||
          (req.accountId ? req.accountId.toLowerCase().includes(needle) : false) ||
          req.customerName.toLowerCase().includes(needle) ||
          req.currentPlanName.toLowerCase().includes(needle) ||
          req.targetPlanName.toLowerCase().includes(needle) ||
          (req.note ? req.note.toLowerCase().includes(needle) : false) ||
          (req.reviewedByName ? req.reviewedByName.toLowerCase().includes(needle) : false)
        );
      })
      .map((req) => ({ ...req }));
  }, [debouncedSearch, requests]);

  const pagination = useClientPagination(filteredRequests, {
    resetKey: `${statusFilter}::${debouncedSearch}`,
  });

  const selectedConnection = useMemo(
    () => connections.find((c) => String(c.id) === selectedConnectionId) ?? null,
    [connections, selectedConnectionId],
  );

  const connectionOptions = useMemo(
    () =>
      connections.map((c) => ({
        value: String(c.id),
        label: `${c.accountId} — ${c.customerName} (${c.planName})`,
      })),
    [connections],
  );

  const availableTargetPlans = useMemo(() => {
    if (!selectedConnection) return [];
    return plans.filter(
      (p) =>
        p.type === selectedConnection.type &&
        !(p.name === selectedConnection.planName && p.type === selectedConnection.type),
    );
  }, [plans, selectedConnection]);

  const targetPlanOptions = useMemo(
    () =>
      availableTargetPlans.map((p) => ({
        value: String(p.id),
        label: `${p.name} — ${formatPlanPriceWithCycle(p.price, p.validityMonths)} (${p.type})`,
      })),
    [availableTargetPlans],
  );

  const selectedTargetPlan = useMemo(
    () => availableTargetPlans.find((p) => String(p.id) === selectedTargetPlanId) ?? null,
    [availableTargetPlans, selectedTargetPlanId],
  );

  const openSubmitModal = () => {
    if (connections.length === 0 || plans.length === 0) {
      void fetchCatalogOptions();
    }
    const firstConn = connections[0];
    setSelectedConnectionId(firstConn ? String(firstConn.id) : '');
    setSelectedTargetPlanId('');
    setSubmitNote('');
    setSubmitError(null);
    setIsSubmitOpen(true);
  };

  const handleSubmitPlanChange = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLoading) return;
    setSubmitError(null);

    const connId = Number(selectedConnectionId);
    const planId = Number(selectedTargetPlanId);
    if (!Number.isInteger(connId) || connId < 1) {
      setSubmitError('Select an active subscriber connection.');
      return;
    }
    if (!Number.isInteger(planId) || planId < 1) {
      setSubmitError('Select a target service plan.');
      return;
    }
    if (!selectedConnection || !selectedTargetPlan || selectedTargetPlan.type !== selectedConnection.type) {
      setSubmitError('Target plan must match the connection service type.');
      return;
    }
    if (submitNote.trim().length > 500) {
      setSubmitError('Request note must not exceed 500 characters.');
      return;
    }

    setSubmitLoading(true);
    try {
      const created = await submitPlanChange({
        connectionId: connId,
        targetPlanId: planId,
        note: submitNote.trim() || null,
      });
      if (!isMountedRef.current) return;
      setIsSubmitOpen(false);
      toast({
        body: `Plan change #${created.id} submitted for ${created.accountId || created.customerName}`,
      });
      pagination.focusItem((r) => r.id === created.id);
      await fetchPlanChanges(statusFilter, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setSubmitError(extractError(err, 'Failed to submit plan change request.'));
    } finally {
      if (isMountedRef.current) {
        setSubmitLoading(false);
      }
    }
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget || reviewLoading) return;
    setReviewError(null);
    setReviewLoading(true);
    try {
      const updated = await approvePlanChange(approveTarget.id);
      if (!isMountedRef.current) return;
      setApproveTarget(null);
      toast({
        body: `Approved plan change #${updated.id}. Active plan is now ${updated.targetPlanName}.`,
      });
      await fetchPlanChanges(statusFilter, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setReviewError(extractError(err, 'Failed to approve plan change request.'));
    } finally {
      if (isMountedRef.current) {
        setReviewLoading(false);
      }
    }
  };

  const handleConfirmReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectTarget || reviewLoading) return;
    if (rejectNote.trim().length > 500) {
      setReviewError('Rejection note must not exceed 500 characters.');
      return;
    }
    setReviewError(null);
    setReviewLoading(true);
    try {
      const updated = await rejectPlanChange(rejectTarget.id, {
        note: rejectNote.trim() || null,
      });
      if (!isMountedRef.current) return;
      setRejectTarget(null);
      setRejectNote('');
      toast({ body: `Rejected plan change request #${updated.id}.` });
      await fetchPlanChanges(statusFilter, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setReviewError(extractError(err, 'Failed to reject plan change request.'));
    } finally {
      if (isMountedRef.current) {
        setReviewLoading(false);
      }
    }
  };

  const columns: TableColumn<PlanChangeRow>[] = [
    {
      key: 'id',
      header: 'Req ID',
      width: pixel(84),
      renderCell: (row) => <Code>{`#${row.id}`}</Code>,
    },
    {
      key: 'connection',
      header: 'Connection & Customer',
      width: proportional(1.5, { minWidth: 245 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          {row.accountId ? (
            <CopyableId value={row.accountId} label="Account ID" />
          ) : (
            <Code>{`CONN-${row.connectionId}`}</Code>
          )}
          <HStack gap={1.5} vAlign="center" wrap="wrap">
            <Text weight="semibold">{row.customerName}</Text>
            <ServiceTypeToken type={row.serviceType as ServiceTypeCode} />
          </HStack>
        </VStack>
      ),
    },
    {
      key: 'plans',
      header: 'Plan Transition',
      width: proportional(1.8, { minWidth: 210 }),
      renderCell: (row) => {
        const currentPrice = formatPlanPriceWithCycle(
          row.currentPlanPrice,
          plansById.get(row.currentPlanId)?.validityMonths,
        );
        const targetPrice = formatPlanPriceWithCycle(
          row.targetPlanPrice,
          plansById.get(row.targetPlanId)?.validityMonths,
        );
        if (row.status === 'Approved' && row.currentPlanId === row.targetPlanId) {
          return (
            <VStack gap={0.5}>
              <Text weight="medium">
                {`Applied: ${row.targetPlanName} (${targetPrice})`}
              </Text>
              <Token size="sm" color="green" label="Active Plan Updated" />
            </VStack>
          );
        }
        return (
          <VStack gap={0.5}>
            <Text type="supporting">
              {`Current: ${row.currentPlanName} (${currentPrice})`}
            </Text>
            <Text weight="medium">
              {`Target: ${row.targetPlanName} (${targetPrice})`}
            </Text>
          </VStack>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (row) => renderPlanChangeStatus(row.status),
    },
    {
      key: 'note',
      header: 'Note',
      width: proportional(1.2, { minWidth: 150 }),
      renderCell: (row) => (
        <Text type="supporting" maxLines={2}>
          {row.note || '—'}
        </Text>
      ),
    },
    {
      key: 'audit',
      header: 'Timeline',
      width: pixel(195),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text type="supporting">
            Requested <Timestamp value={row.requestedAt} format="date_time" />
          </Text>
          {row.reviewedAt && (
            <Text type="supporting">
              {`By ${row.reviewedByName || 'Staff'} · `}
              <Timestamp value={row.reviewedAt} format="relative" />
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: roleMode !== 'retail' ? pixel(210) : pixel(110),
      align: 'end',
      renderCell: (row) => {
        if (roleMode !== 'retail') {
          if (row.status === 'Pending') {
            return (
              <HStack gap={1.5} hAlign="end" wrap="nowrap">
                <Button
                  size="sm"
                  variant="primary"
                  label="Approve"
                  onClick={() => {
                    setReviewError(null);
                    setApproveTarget(row);
                  }}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  label="Reject"
                  onClick={() => {
                    setReviewError(null);
                    setRejectNote('');
                    setRejectTarget(row);
                  }}
                />
              </HStack>
            );
          }
          return (
            <HStack gap={1.5} hAlign="end" wrap="nowrap">
              <Token size="sm" color="gray" label="Reviewed" />
              <Button
                size="sm"
                variant="ghost"
                label="Details"
                onClick={() => setDetailTarget(row)}
              />
            </HStack>
          );
        }

        return (
          <Button
            size="sm"
            variant="ghost"
            label="Details"
            onClick={() => setDetailTarget(row)}
          />
        );
      },
    },
  ];

  const hasActiveFilters = statusFilter !== 'ALL' || Boolean(searchInput);

  return (
    <Card padding={5}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <Selector
              label="Request Status"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <TextInput
              type="search"
              label="Search Requests"
              placeholder="Account ID, customer, plan, note..."
              value={searchInput}
              onChange={setSearchInput}
              hasClear
            />
          </HStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                label="Reset filters"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchInput('');
                }}
              />
            )}
            <Text type="supporting" hasTabularNumbers>
              {`Total: ${filteredRequests.length} request${filteredRequests.length === 1 ? '' : 's'}`}
            </Text>
            {roleMode === 'retail' && (
              <Button
                variant="primary"
                label="Submit Plan Change"
                onClick={openSubmitModal}
              />
            )}
          </HStack>
        </HStack>

        <ApiErrorBanner
          title="Failed to load plan change requests"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading plan change requests..." />
              <Text type="supporting">Fetching subscriber plan change queue...</Text>
            </VStack>
          </Center>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title="No plan change requests found"
            description={
              hasActiveFilters
                ? 'No plan change requests match your current status or search filters.'
                : roleMode === 'retail'
                  ? 'Submit a new plan change request for an active subscriber connection.'
                  : 'No plan change requests are queued for review.'
            }
            icon={<Icon icon="info" />}
            actions={
              roleMode === 'retail' ? (
                <Button
                  variant="primary"
                  label="Submit Plan Change"
                  onClick={openSubmitModal}
                />
              ) : undefined
            }
          />
        ) : (
          <VStack gap={3}>
            <Table<PlanChangeRow>
              aria-label="Plan Change Requests"
              density="compact"
              dividers="rows"
              hasHover
              idKey="id"
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
              label="Plan changes pagination"
            />
          </VStack>
        )}
      </VStack>

      {/* Retail Submit Plan Change Dialog */}
      {roleMode === 'retail' && (
        <Dialog
          isOpen={isSubmitOpen}
          onOpenChange={(open) => {
            if (!submitLoading) setIsSubmitOpen(open);
          }}
          purpose="form"
          width={540}
        >
          <Layout
            header={
              <DialogHeader
                title="Submit Plan Change Request"
                subtitle="Select an active connection and a new tariff plan for review."
                onOpenChange={(open) => {
                  if (!submitLoading) setIsSubmitOpen(open);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not submit plan change"
                    error={submitError}
                    onDismiss={() => setSubmitError(null)}
                  />

                  <form id="submit-plan-change-form" onSubmit={handleSubmitPlanChange}>
                    <FormLayout>
                      <Selector
                        label="Active Connection"
                        hasSearch
                        searchPlaceholder="Search Account ID or customer..."
                        placeholder="Select active connection..."
                        isRequired
                        options={connectionOptions}
                        value={selectedConnectionId}
                        onChange={(val) => {
                          setSelectedConnectionId(val);
                          setSelectedTargetPlanId('');
                        }}
                        width="100%"
                      />

                      <Selector
                        label="Target Service Plan"
                        hasSearch
                        searchPlaceholder="Search active plans..."
                        placeholder="Select target plan..."
                        emptyText="No other active plans available for this service type"
                        isDisabled={!selectedConnection || availableTargetPlans.length === 0}
                        isRequired
                        options={targetPlanOptions}
                        value={selectedTargetPlanId}
                        onChange={setSelectedTargetPlanId}
                        width="100%"
                      />

                      {selectedConnection && (
                        <Card variant="muted" padding={3}>
                          <MetadataList columns={2}>
                            <MetadataListItem label="Account ID">
                              <CopyableId
                                value={selectedConnection.accountId}
                                label="Account ID"
                              />
                            </MetadataListItem>
                            <MetadataListItem label="Customer">
                              {selectedConnection.customerName}
                            </MetadataListItem>
                            <MetadataListItem label="Current Plan">
                              {selectedConnection.planName}
                            </MetadataListItem>
                            <MetadataListItem label="Target Plan">
                              {selectedTargetPlan
                                ? `${selectedTargetPlan.name} (${formatPlanPriceWithCycle(selectedTargetPlan.price, selectedTargetPlan.validityMonths)})`
                                : 'Select a target plan'}
                            </MetadataListItem>
                          </MetadataList>
                        </Card>
                      )}

                      <TextArea
                        label="Request Note"
                        placeholder="Optional subscriber reason or upgrade context..."
                        value={submitNote}
                        onChange={setSubmitNote}
                        rows={3}
                        maxLength={500}
                        isOptional
                        width="100%"
                      />
                    </FormLayout>
                  </form>
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button
                    variant="ghost"
                    label="Cancel"
                    isDisabled={submitLoading}
                    onClick={() => setIsSubmitOpen(false)}
                  />
                  <Button
                    type="submit"
                    form="submit-plan-change-form"
                    variant="primary"
                    label="Submit Request"
                    isLoading={submitLoading}
                    isDisabled={submitLoading}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Admin / Technical Approve Dialog */}
      {roleMode !== 'retail' && (
        <Dialog
          isOpen={Boolean(approveTarget)}
          onOpenChange={(open) => {
            if (!reviewLoading && !open) setApproveTarget(null);
          }}
          purpose="required"
          width={480}
        >
          <Layout
            header={
              <DialogHeader
                title={approveTarget ? `Approve Request #${approveTarget.id}` : 'Approve Request'}
                subtitle="Confirm service plan upgrade or migration."
                onOpenChange={(open) => {
                  if (!reviewLoading && !open) setApproveTarget(null);
                }}
              />
            }
            content={
              <LayoutContent>
                {approveTarget && (
                  <VStack gap={4}>
                    <ApiErrorBanner
                      title="Approval failed"
                      error={reviewError}
                      onDismiss={() => setReviewError(null)}
                    />
                    <Banner
                      status="info"
                      container="section"
                      collapsible={false}
                      title="Active Plan Update"
                      description={`Approving updates the connection's active plan to ${approveTarget.targetPlanName} (${formatPlanPriceWithCycle(approveTarget.targetPlanPrice, plansById.get(approveTarget.targetPlanId)?.validityMonths)}) and logs an order event.`}
                    />
                    <MetadataList columns={2}>
                      <MetadataListItem label="Account ID">
                        {approveTarget.accountId || `CONN-${approveTarget.connectionId}`}
                      </MetadataListItem>
                      <MetadataListItem label="Customer">
                        {approveTarget.customerName}
                      </MetadataListItem>
                      <MetadataListItem label="Current Plan">
                        {`${approveTarget.currentPlanName} (${formatPlanPriceWithCycle(approveTarget.currentPlanPrice, plansById.get(approveTarget.currentPlanId)?.validityMonths)})`}
                      </MetadataListItem>
                      <MetadataListItem label="Target Plan">
                        {`${approveTarget.targetPlanName} (${formatPlanPriceWithCycle(approveTarget.targetPlanPrice, plansById.get(approveTarget.targetPlanId)?.validityMonths)})`}
                      </MetadataListItem>
                      <MetadataListItem label="Request Note">
                        {approveTarget.note || '—'}
                      </MetadataListItem>
                    </MetadataList>
                  </VStack>
                )}
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button
                    variant="ghost"
                    label="Cancel"
                    isDisabled={reviewLoading}
                    onClick={() => setApproveTarget(null)}
                  />
                  <Button
                    variant="primary"
                    label="Confirm Approval"
                    isLoading={reviewLoading}
                    isDisabled={reviewLoading}
                    onClick={handleConfirmApprove}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Admin / Technical Reject Dialog */}
      {roleMode !== 'retail' && (
        <Dialog
          isOpen={Boolean(rejectTarget)}
          onOpenChange={(open) => {
            if (!reviewLoading && !open) setRejectTarget(null);
          }}
          purpose="form"
          width={480}
        >
          <Layout
            header={
              <DialogHeader
                title={rejectTarget ? `Reject Request #${rejectTarget.id}` : 'Reject Request'}
                subtitle="Provide an optional rejection note for the audit trail."
                onOpenChange={(open) => {
                  if (!reviewLoading && !open) setRejectTarget(null);
                }}
              />
            }
            content={
              <LayoutContent>
                {rejectTarget && (
                  <VStack gap={4}>
                    <ApiErrorBanner
                      title="Rejection failed"
                      error={reviewError}
                      onDismiss={() => setReviewError(null)}
                    />
                    <Banner
                      status="warning"
                      container="section"
                      collapsible={false}
                      title="Review Note Notice"
                      description="If provided, your rejection reason will be recorded as the request decision note."
                    />
                    <MetadataList columns={2}>
                      <MetadataListItem label="Account ID">
                        {rejectTarget.accountId || `CONN-${rejectTarget.connectionId}`}
                      </MetadataListItem>
                      <MetadataListItem label="Customer">
                        {rejectTarget.customerName}
                      </MetadataListItem>
                      <MetadataListItem label="Requested Transition">
                        {`${rejectTarget.currentPlanName} → ${rejectTarget.targetPlanName}`}
                      </MetadataListItem>
                      <MetadataListItem label="Existing Note">
                        {rejectTarget.note || '—'}
                      </MetadataListItem>
                    </MetadataList>
                    <form id="reject-plan-change-form" onSubmit={handleConfirmReject}>
                      <FormLayout>
                        <TextArea
                          label="Rejection Reason / Review Note"
                          placeholder="e.g. Incompatible terminal equipment..."
                          value={rejectNote}
                          onChange={setRejectNote}
                          rows={3}
                          maxLength={500}
                          isOptional
                          width="100%"
                        />
                      </FormLayout>
                    </form>
                  </VStack>
                )}
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button
                    variant="ghost"
                    label="Cancel"
                    isDisabled={reviewLoading}
                    onClick={() => setRejectTarget(null)}
                  />
                  <Button
                    type="submit"
                    form="reject-plan-change-form"
                    variant="destructive"
                    label="Confirm Rejection"
                    isLoading={reviewLoading}
                    isDisabled={reviewLoading}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* Plan Change Details Drawer */}
      <Drawer
        isOpen={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
        label={detailTarget ? `Plan Change #${detailTarget.id}` : 'Plan Change Details'}
        width={500}
      >
        <Layout
          header={
            <DrawerHeader
              title={detailTarget ? `Plan Change #${detailTarget.id}` : 'Plan Change Details'}
              subtitle={detailTarget ? detailTarget.customerName : undefined}
              endContent={detailTarget ? renderPlanChangeStatus(detailTarget.status) : undefined}
              onOpenChange={(open) => {
                if (!open) setDetailTarget(null);
              }}
            />
          }
          content={
            <LayoutContent>
              {detailTarget && (
                <VStack gap={4}>
                  <MetadataList columns={2} title={<Heading level={4}>Request Summary</Heading>}>
                    <MetadataListItem label="Request ID">
                      <Code>{`#${detailTarget.id}`}</Code>
                    </MetadataListItem>
                    <MetadataListItem label="Account ID">
                      {detailTarget.accountId ? (
                        <CopyableId value={detailTarget.accountId} label="Account ID" />
                      ) : (
                        <Code>{`CONN-${detailTarget.connectionId}`}</Code>
                      )}
                    </MetadataListItem>
                    <MetadataListItem label="Customer">
                      {detailTarget.customerName}
                    </MetadataListItem>
                    <MetadataListItem label="Service Type">
                      <ServiceTypeToken type={detailTarget.serviceType as ServiceTypeCode} />
                    </MetadataListItem>
                    <MetadataListItem label="Current Plan">
                      {`${detailTarget.currentPlanName} (${formatPlanPriceWithCycle(detailTarget.currentPlanPrice, plansById.get(detailTarget.currentPlanId)?.validityMonths)})`}
                    </MetadataListItem>
                    <MetadataListItem label="Target Plan">
                      {`${detailTarget.targetPlanName} (${formatPlanPriceWithCycle(detailTarget.targetPlanPrice, plansById.get(detailTarget.targetPlanId)?.validityMonths)})`}
                    </MetadataListItem>
                    <MetadataListItem label="Requested At">
                      <Timestamp value={detailTarget.requestedAt} format="date_time" />
                    </MetadataListItem>
                    <MetadataListItem label="Reviewed By">
                      {detailTarget.reviewedByName || 'Pending review'}
                    </MetadataListItem>
                    {detailTarget.reviewedAt && (
                      <MetadataListItem label="Reviewed At">
                        <Timestamp value={detailTarget.reviewedAt} format="date_time" />
                      </MetadataListItem>
                    )}
                    <MetadataListItem label="Note">
                      {detailTarget.note || '—'}
                    </MetadataListItem>
                  </MetadataList>
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end">
                <Button
                  variant="secondary"
                  label="Close"
                  onClick={() => setDetailTarget(null)}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>
    </Card>
  );
}
