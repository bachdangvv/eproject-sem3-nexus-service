/**
 * Technical site feasibility assessment queue and evaluation modal section.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
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
  OrderDetailDrawer,
  OrderStatusPill,
  ServiceTypeToken,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import { assessOrder, getOrderDetail, getOrders } from '../../services/operationsApi';
import { ApiError, type OrderDetailView, type OrderView } from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  MAX_ASSESSMENT_NOTE_LENGTH,
  requiresLandlineCheck,
  type OrderRow,
  type TechnicalSectionProps,
} from './technicalTypes';

interface AssessmentFieldErrors {
  distanceOk?: string;
  serverAvailable?: string;
  landlineFeasible?: string;
  note?: string;
}

export function TechnicalAssessmentsSection({
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
  const [lastAssessedOrder, setLastAssessedOrder] = useState<OrderView | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [assessTarget, setAssessTarget] = useState<OrderView | null>(null);
  const [distanceOk, setDistanceOk] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [landlineFeasible, setLandlineFeasible] = useState(false);
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AssessmentFieldErrors>({});
  const [assessError, setAssessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const assessingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPendingOrders = useCallback(
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
        const data = await getOrders({ status: 'Pending' });
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setOrders(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load pending assessment queue.'));
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
        return loadPendingOrders(isSilent);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [loadPendingOrders, refreshTrigger]);

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

  const openAssessDialog = (order: OrderView) => {
    if (order.status !== 'Pending') return;
    setAssessTarget(order);
    setDistanceOk(false);
    setServerAvailable(false);
    setLandlineFeasible(false);
    setNote('');
    setFieldErrors({});
    setAssessError(null);
  };

  const closeAssessDialog = () => {
    if (submitting) return;
    setAssessTarget(null);
    setFieldErrors({});
    setAssessError(null);
  };

  const needsLandline = assessTarget ? requiresLandlineCheck(assessTarget) : false;
  const willBeFeasible =
    distanceOk && serverAvailable && (!needsLandline || landlineFeasible);

  const handleAssessSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (assessingRef.current || submitting || !assessTarget) return;

    const errors: AssessmentFieldErrors = {};
    const trimmedNote = note.trim();

    if (!willBeFeasible && trimmedNote.length === 0) {
      errors.note = 'Enter the reason the order is not feasible.';
    } else if (trimmedNote.length > MAX_ASSESSMENT_NOTE_LENGTH) {
      errors.note = `Assessment note must be ${MAX_ASSESSMENT_NOTE_LENGTH} characters or fewer.`;
    }

    setFieldErrors(errors);
    setAssessError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const targetCode = assessTarget.code;
    assessingRef.current = true;
    setSubmitting(true);
    try {
      const updated = await assessOrder(targetCode, {
        distanceOk,
        serverAvailable,
        landlineFeasible: needsLandline ? landlineFeasible : null,
        note: trimmedNote.length > 0 ? trimmedNote : null,
      });
      if (!isMountedRef.current) return;
      setAssessTarget(null);
      setLastAssessedOrder(updated);
      const outcomeLabel = updated.status === 'NotFeasible' ? 'Not Feasible' : updated.status;
      toast({
        body: `Assessed order ${updated.code}: ${outcomeLabel}.`,
      });
      assessingRef.current = false;
      setSubmitting(false);
      void loadPendingOrders(true);
      if (detailOpen && orderDetail?.order.code === updated.code) {
        void handleOpenDetail(updated.code);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setFieldErrors((prev) => ({
        ...prev,
        distanceOk: serverFields.distanceok ?? prev.distanceOk,
        serverAvailable: serverFields.serveravailable ?? prev.serverAvailable,
        landlineFeasible: serverFields.landlinefeasible ?? prev.landlineFeasible,
        note: serverFields.note ?? prev.note,
      }));
      setAssessError(extractErrorMessage(err, `Could not submit assessment for ${targetCode}.`));
      if (err instanceof ApiError && err.status === 409) {
        void loadPendingOrders(true);
      }
    } finally {
      assessingRef.current = false;
      if (isMountedRef.current) {
        setSubmitting(false);
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
      key: 'landlineRequirement',
      header: 'Landline Requirement',
      width: proportional(1.4, { minWidth: 190 }),
      renderCell: (row) =>
        row.request.type === 'D' ? (
          row.request.hasNexusLandline ? (
            <VStack gap={0.5}>
              <Token size="sm" color="teal" label="Existing Landline" />
              <Text type="supporting">Internet check only</Text>
            </VStack>
          ) : (
            <VStack gap={0.5}>
              <Token size="sm" color="purple" label="Landline Check Required" />
              <Text type="supporting">Landline + Internet check</Text>
            </VStack>
          )
        ) : (
          <Text type="supporting">Not applicable</Text>
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
      width: pixel(175),
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
            label="Assess"
            onClick={() => openAssessDialog(row)}
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
              Evaluate distance and server capacity for every Pending order before connection
              activation.
            </Text>
          </HStack>

          <TextInput
            type="search"
            label="Filter Pending Queue"
            placeholder="Filter by Order ID, customer, city, address, or plan..."
            startIcon={<Icon icon="search" />}
            hasClear
            width={340}
            value={searchInput}
            onChange={setSearchInput}
          />
        </HStack>

        {lastAssessedOrder ? (
          <Banner
            status={lastAssessedOrder.status === 'Feasible' ? 'success' : 'info'}
            container="card"
            collapsible={false}
            isDismissable
            onDismiss={() => setLastAssessedOrder(null)}
            title={`Order ${lastAssessedOrder.code} Assessed`}
            description={
              lastAssessedOrder.status === 'Feasible'
                ? `Marked Feasible for ${lastAssessedOrder.request.customerName}. Ready for connection activation.`
                : `Marked Not Feasible for ${lastAssessedOrder.request.customerName}.`
            }
            endContent={
              lastAssessedOrder.status === 'Feasible' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  label="Go to Connections"
                  onClick={() => navigate(RoutePath.TECHNICAL_CONNECTIONS)}
                />
              ) : undefined
            }
          />
        ) : null}

        <ApiErrorBanner
          title="Assessment queue error"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading && orders.length === 0 ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading pending orders..." />
              <Text type="supporting">Loading Pending orders awaiting feasibility assessment...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<OrderRow>
              aria-label="Pending Feasibility Assessments"
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
                      ? 'No matching pending orders'
                      : 'No pending orders to assess'
                  }
                  description={
                    searchInput.trim()
                      ? 'Try clearing the queue filter to view all Pending orders.'
                      : 'All confirmed orders have already been assessed. New Retail confirmations will appear here.'
                  }
                  icon={<Icon icon="check" />}
                  actions={
                    searchInput.trim() ? (
                      <Button
                        variant="secondary"
                        label="Clear Filter"
                        onClick={() => setSearchInput('')}
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
              label="Pending assessments pagination"
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

      <Dialog
        isOpen={assessTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeAssessDialog();
        }}
        purpose="form"
        width={540}
      >
        <Layout
          header={
            <DialogHeader
              title={assessTarget ? `Assess Feasibility - ${assessTarget.code}` : 'Assess Order'}
              subtitle={
                assessTarget
                  ? `${assessTarget.request.customerName} - ${assessTarget.request.planName}`
                  : 'Complete site feasibility criteria.'
              }
              onOpenChange={(open) => {
                if (!open) closeAssessDialog();
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Assessment submission failed"
                  error={assessError}
                  onDismiss={() => setAssessError(null)}
                />

                {assessTarget ? (
                  <Card variant="muted" padding={4}>
                    <MetadataList columns={2}>
                      <MetadataListItem label="Order ID">
                        <CopyableId value={assessTarget.code} label="Order ID" />
                      </MetadataListItem>
                      <MetadataListItem label="Customer">
                        {assessTarget.request.customerName}
                      </MetadataListItem>
                      <MetadataListItem label="Service Plan">
                        <HStack gap={2} vAlign="center" wrap="wrap">
                          <Text weight="semibold">{assessTarget.request.planName}</Text>
                          <ServiceTypeToken type={assessTarget.request.type} />
                        </HStack>
                      </MetadataListItem>
                      <MetadataListItem label="Territory">
                        City {assessTarget.request.cityCode}
                      </MetadataListItem>
                      <MetadataListItem label="Installation Address">
                        {assessTarget.request.address}
                      </MetadataListItem>
                      <MetadataListItem label="Service Scope">
                        {assessTarget.request.type === 'D'
                          ? assessTarget.request.hasNexusLandline
                            ? 'Existing Nexus PSTN (Internet check only)'
                            : 'Dial-Up + New PSTN check required'
                          : 'Standard distance and server check'}
                      </MetadataListItem>
                    </MetadataList>
                  </Card>
                ) : null}

                <form id="assess-order-form" onSubmit={(e) => void handleAssessSubmit(e)}>
                  <FormLayout>
                    <CheckboxInput
                      label="Distance OK (within service loop limits)"
                      value={distanceOk}
                      onChange={(checked) => {
                        setDistanceOk(checked);
                        const nextFeasible =
                          checked && serverAvailable && (!needsLandline || landlineFeasible);
                        setFieldErrors((prev) => ({
                          ...prev,
                          distanceOk: undefined,
                          note: nextFeasible ? undefined : prev.note,
                        }));
                      }}
                      status={
                        fieldErrors.distanceOk
                          ? { type: 'error', message: fieldErrors.distanceOk }
                          : undefined
                      }
                    />

                    <CheckboxInput
                      label="Server Available (port and capacity available)"
                      value={serverAvailable}
                      onChange={(checked) => {
                        setServerAvailable(checked);
                        const nextFeasible =
                          distanceOk && checked && (!needsLandline || landlineFeasible);
                        setFieldErrors((prev) => ({
                          ...prev,
                          serverAvailable: undefined,
                          note: nextFeasible ? undefined : prev.note,
                        }));
                      }}
                      status={
                        fieldErrors.serverAvailable
                          ? { type: 'error', message: fieldErrors.serverAvailable }
                          : undefined
                      }
                    />

                    {needsLandline ? (
                      <CheckboxInput
                        label="Landline Feasible (Nexus PSTN line feasible)"
                        value={landlineFeasible}
                        onChange={(checked) => {
                          setLandlineFeasible(checked);
                          const nextFeasible = distanceOk && serverAvailable && checked;
                          setFieldErrors((prev) => ({
                            ...prev,
                            landlineFeasible: undefined,
                            note: nextFeasible ? undefined : prev.note,
                          }));
                        }}
                        status={
                          fieldErrors.landlineFeasible
                            ? { type: 'error', message: fieldErrors.landlineFeasible }
                            : undefined
                        }
                      />
                    ) : assessTarget ? (
                      <Text type="supporting">
                        {assessTarget.request.type === 'D'
                          ? 'Existing Nexus PSTN service verified. Only internet distance and server checks apply.'
                          : 'PSTN feasibility check is not required for Broadband or Landline-only orders.'}
                      </Text>
                    ) : null}

                    <Card variant="muted" padding={3}>
                      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                        <Text weight="semibold">Computed Feasibility Outcome</Text>
                        <OrderStatusPill status={willBeFeasible ? 'Feasible' : 'NotFeasible'} />
                      </HStack>
                    </Card>

                    <TextArea
                      label="Assessment Note"
                      placeholder={
                        willBeFeasible
                          ? 'Optional engineering survey remarks...'
                          : 'Required: explain why the order is Not Feasible...'
                      }
                      description={
                        willBeFeasible
                          ? 'Optional when Feasible (up to 500 characters).'
                          : 'Required when Not Feasible (up to 500 characters).'
                      }
                      isRequired={!willBeFeasible}
                      isOptional={willBeFeasible}
                      rows={4}
                      maxLength={MAX_ASSESSMENT_NOTE_LENGTH}
                      value={note}
                      onChange={(value) => {
                        setNote(value);
                        setFieldErrors((prev) => ({ ...prev, note: undefined }));
                      }}
                      status={
                        fieldErrors.note
                          ? { type: 'error', message: fieldErrors.note }
                          : note.trim().length > MAX_ASSESSMENT_NOTE_LENGTH
                            ? {
                              type: 'error',
                              message: `Assessment note must be ${MAX_ASSESSMENT_NOTE_LENGTH} characters or fewer.`,
                            }
                            : undefined
                      }
                    />
                  </FormLayout>
                </form>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
                <Button
                  variant="ghost"
                  label="Cancel"
                  isDisabled={submitting}
                  onClick={closeAssessDialog}
                />
                <Button
                  type="submit"
                  form="assess-order-form"
                  variant="primary"
                  label="Submit Assessment"
                  isLoading={submitting}
                  isDisabled={submitting}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </Card>
  );
}
