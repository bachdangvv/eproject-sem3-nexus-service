/**
 * Customer service requests, bulk connection estimates, service orders, and order feedback (/customer/orders).
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
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
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
  OrderDetailDrawer,
  OrderStatusPill,
  ServiceTypeToken,
  StatusLabel,
  formatUsd,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { computeBillAmounts, formatPlanPriceWithCycle } from '../../data/tariffs';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  createRequest,
  getOrderDetail,
  getOrders,
  getProfile,
  getRequests,
  submitFeedback,
} from '../../services/customerApi';
import { getPublicCities, getPublicPlans } from '../../services/publicApi';
import type {
  CityView,
  CustomerProfileView,
  FeedbackInput,
  OrderDetailView,
  OrderStatus,
  OrderView,
  PlanView,
  RequestView,
} from '../../types/nexus';
import {
  FEEDBACK_RATING_OPTIONS,
  extractErrorMessage,
  formatCityDisplay,
  type CustomerSectionProps,
  type OrderRow,
  type RequestRow,
} from './customerTypes';

type OrderFilter = 'ALL' | OrderStatus;

export function CustomerOrdersSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: CustomerSectionProps): JSX.Element {
  const toast = useToast();

  const [requests, setRequests] = useState<RequestView[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);
  const [profile, setProfile] = useState<CustomerProfileView | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<OrderFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New Service Request dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [connectionCount, setConnectionCount] = useState(1);
  const [hasNexusLandline, setHasNexusLandline] = useState(false);
  const [addressOverride, setAddressOverride] = useState('');
  const [cityOverride, setCityOverride] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Order Detail drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Feedback state (both drawer inline & row dialog)
  const [feedbackDialogOrder, setFeedbackDialogOrder] = useState<OrderView | null>(null);
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCommentError, setFeedbackCommentError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [submittedFeedbackCodes, setSubmittedFeedbackCodes] = useState<Record<string, boolean>>({});

  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const seqRef = useRef(0);
  const detailSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      const seq = ++seqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const [reqList, orderList, planList, cityList, profileData] = await Promise.all([
          getRequests(),
          getOrders(),
          getPublicPlans(),
          getPublicCities(),
          getProfile(),
        ]);
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setRequests(reqList);
        setOrders(orderList);
        setPlans(planList);
        setCities(cityList);
        setProfile(profileData);
        onCountChange(orderList.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load service requests and orders.'));
      } finally {
        if (isMountedRef.current && seq === seqRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [onCountChange, onRefreshingChange],
  );

  useEffect(() => {
    const silent = hasLoadedRef.current && refreshTrigger > 0;
    hasLoadedRef.current = true;
    void loadData(silent);
  }, [loadData, refreshTrigger]);

  const isSuspended = profile?.status === 'SUSPENDED';

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);
  const plansById = useMemo(() => {
    const map = new Map<number, PlanView>();
    for (const p of plans) {
      map.set(p.id, p);
    }
    return map;
  }, [plans]);

  const selectedPlan = useMemo(
    () => activePlans.find((p) => String(p.id) === selectedPlanId) ?? null,
    [activePlans, selectedPlanId],
  );

  const planOptions = useMemo(
    () =>
      activePlans.map((p) => ({
        value: String(p.id),
        label: `${p.name} (${formatPlanPriceWithCycle(p.price, p.validityMonths)})`,
      })),
    [activePlans],
  );

  const cityOptions = useMemo(
    () =>
      cities.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    [cities],
  );

  const estimate = useMemo(() => {
    if (!selectedPlan) return null;
    return computeBillAmounts({
      connectionType: selectedPlan.type,
      planRentalUsd: selectedPlan.price,
      advancePerConnection: selectedPlan.advancePerConnection,
      connectionCount,
      includeSecurityDeposit: true,
      usageChargesUsd: 0,
      equipmentReplacementUsd: 0,
      previousArrearsUsd: 0,
    });
  }, [connectionCount, selectedPlan]);

  const requestRows = useMemo<RequestRow[]>(
    () => requests.map((r) => ({ ...r })),
    [requests],
  );
  const requestPagination = useClientPagination(requestRows);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        order.code.toLowerCase().includes(q) ||
        order.request.planName.toLowerCase().includes(q) ||
        order.request.cityCode.toLowerCase().includes(q) ||
        (order.accountId ?? '').toLowerCase().includes(q)
      );
    });
  }, [orders, searchQuery, statusFilter]);

  const orderRows = useMemo<OrderRow[]>(
    () => filteredOrders.map((o) => ({ ...o })),
    [filteredOrders],
  );
  const orderPagination = useClientPagination(orderRows, {
    resetKey: `${statusFilter}::${searchQuery.trim()}`,
  });

  const handleOpenCreate = () => {
    setCreateError(null);
    setSelectedPlanId('');
    setConnectionCount(1);
    setHasNexusLandline(false);
    setAddressOverride('');
    setCityOverride(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating || isSuspended) return;
    setCreateError(null);

    const parsedPlanId = Number(selectedPlanId);
    if (!selectedPlan || !Number.isFinite(parsedPlanId) || parsedPlanId <= 0) {
      setCreateError('Please select a service plan.');
      return;
    }

    const safeCount = Math.max(1, Math.min(10000, Math.floor(connectionCount || 1)));
    setCreating(true);
    try {
      const created = await createRequest({
        planId: parsedPlanId,
        hasNexusLandline: selectedPlan.type === 'D' ? hasNexusLandline : false,
        connectionCount: safeCount,
        address: addressOverride.trim() || null,
        cityCode: cityOverride || null,
      });
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      toast({
        body: `Service request #${created.id} submitted for ${created.planName}.`,
      });
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setCreateError(extractErrorMessage(err, 'Could not submit service request.'));
    } finally {
      if (isMountedRef.current) {
        setCreating(false);
      }
    }
  };

  const handleOpenDetail = async (order: OrderView) => {
    const seq = ++detailSeqRef.current;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setFeedbackError(null);
    setOrderDetail(null);
    try {
      const detail = await getOrderDetail(order.code);
      if (!isMountedRef.current || seq !== detailSeqRef.current) return;
      setOrderDetail(detail);
      if (detail.feedback.length > 0) {
        setSubmittedFeedbackCodes((prev) => ({ ...prev, [order.code]: true }));
      }
    } catch (err) {
      if (!isMountedRef.current || seq !== detailSeqRef.current) return;
      setDetailError(extractErrorMessage(err, 'Failed to load order details.'));
    } finally {
      if (isMountedRef.current && seq === detailSeqRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const handleDrawerFeedbackSubmit = async (
    orderCode: string,
    input: FeedbackInput,
  ): Promise<boolean> => {
    if (submittingFeedback) return false;
    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await submitFeedback(orderCode, input);
      if (!isMountedRef.current) return true;
      setSubmittedFeedbackCodes((prev) => ({ ...prev, [orderCode]: true }));
      toast({ body: `Thank you for rating order ${orderCode} (${input.rating}/5).` });
      const refreshed = await getOrderDetail(orderCode);
      if (isMountedRef.current) {
        setOrderDetail(refreshed);
      }
      return true;
    } catch (err) {
      if (!isMountedRef.current) return false;
      setFeedbackError(extractErrorMessage(err, 'Could not submit order feedback.'));
      return false;
    } finally {
      if (isMountedRef.current) {
        setSubmittingFeedback(false);
      }
    }
  };

  const handleDialogFeedbackSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!feedbackDialogOrder || submittingFeedback) return;
    const trimmed = feedbackComment.trim();
    if (!trimmed) {
      setFeedbackCommentError('Please enter a feedback comment.');
      return;
    }
    if (trimmed.length > 600) {
      setFeedbackCommentError('Comment must be 600 characters or fewer.');
      return;
    }
    setFeedbackCommentError(null);
    setFeedbackError(null);
    setSubmittingFeedback(true);
    try {
      await submitFeedback(feedbackDialogOrder.code, {
        rating: Number(feedbackRating) || 5,
        comment: trimmed,
      });
      if (!isMountedRef.current) return;
      const code = feedbackDialogOrder.code;
      setSubmittedFeedbackCodes((prev) => ({ ...prev, [code]: true }));
      setFeedbackDialogOrder(null);
      setFeedbackComment('');
      toast({ body: `Feedback submitted for order ${code}.` });
      if (orderDetail?.order.code === code) {
        const refreshed = await getOrderDetail(code);
        if (isMountedRef.current) {
          setOrderDetail(refreshed);
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setFeedbackError(extractErrorMessage(err, 'Could not submit order feedback.'));
    } finally {
      if (isMountedRef.current) {
        setSubmittingFeedback(false);
      }
    }
  };

  const requestColumns: TableColumn<RequestRow>[] = [
    {
      key: 'id',
      header: 'Request #',
      width: pixel(100),
      renderCell: (r) => <Text weight="semibold">#{r.id}</Text>,
    },
    {
      key: 'planName',
      header: 'Service Plan',
      width: proportional(1.6, { minWidth: 200 }),
      renderCell: (r) => (
        <VStack gap={1}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{r.planName}</Text>
            <ServiceTypeToken type={r.type} />
          </HStack>
          <Text type="supporting">
            {(r.connectionCount ?? 1) > 1
              ? `${r.connectionCount} lines (Bulk)`
              : '1 line'}
            {r.type === 'D'
              ? ` · Landline: ${r.hasNexusLandline ? 'Yes' : 'No'}`
              : ''}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'location',
      header: 'City & Address',
      width: proportional(1.4, { minWidth: 180 }),
      renderCell: (r) => (
        <VStack gap={0.5}>
          <Text weight="medium">{formatCityDisplay(r.cityCode, cities)}</Text>
          <Text type="supporting">{r.address}</Text>
        </VStack>
      ),
    },
    {
      key: 'price',
      header: 'Cycle Price',
      width: pixel(120),
      renderCell: (r) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatPlanPriceWithCycle(r.price, plansById.get(r.planId)?.validityMonths)}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      width: pixel(150),
      renderCell: (r) => <Timestamp value={r.createdAt} format="date_time" />,
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(170),
      renderCell: () => <StatusLabel variant="warning" label="Awaiting Confirmation" />,
    },
  ];

  const orderColumns: TableColumn<OrderRow>[] = [
    {
      key: 'code',
      header: 'Order Code',
      width: pixel(205),
      renderCell: (o) => <CopyableId value={o.code} label="Order Code" />,
    },
    {
      key: 'plan',
      header: 'Service Plan',
      width: proportional(1.5, { minWidth: 190 }),
      renderCell: (o) => (
        <VStack gap={1}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{o.request.planName}</Text>
            <ServiceTypeToken type={o.request.type} />
          </HStack>
          <Text type="supporting">
            City {o.request.cityCode} ·{' '}
            {(o.request.connectionCount ?? 1) > 1
              ? `${o.request.connectionCount} lines`
              : '1 line'}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'price',
      header: 'Cycle Price',
      width: pixel(115),
      renderCell: (o) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatUsd(o.request.price)}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(145),
      renderCell: (o) => <OrderStatusPill status={o.status} />,
    },
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(245),
      renderCell: (o) =>
        o.accountId ? (
          <CopyableId value={o.accountId} label="Account ID" />
        ) : (
          <Text type="supporting">Pending activation</Text>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: pixel(145),
      renderCell: (o) => <Timestamp value={o.createdAt} format="date" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(210),
      align: 'end',
      renderCell: (o) => {
        const alreadySubmitted = Boolean(submittedFeedbackCodes[o.code]);
        return (
          <HStack gap={2} hAlign="end" wrap="nowrap">
            <Button
              size="sm"
              variant="secondary"
              label="View Details"
              onClick={() => void handleOpenDetail(o)}
            />
            <Button
              size="sm"
              variant="ghost"
              label={alreadySubmitted ? 'Rated' : 'Feedback'}
              isDisabled={isSuspended || o.status !== 'Connected' || alreadySubmitted}
              onClick={() => {
                setFeedbackDialogOrder(o);
                setFeedbackRating('5');
                setFeedbackComment('');
                setFeedbackCommentError(null);
                setFeedbackError(null);
              }}
            />
          </HStack>
        );
      },
    },
  ];

  return (
    <VStack gap={5}>
      <ApiErrorBanner
        title="Failed to load orders"
        error={loadError}
        onDismiss={() => setLoadError(null)}
      />

      {isSuspended && (
        <Banner
          status="warning"
          container="card"
          collapsible={false}
          title="Account Suspended"
          description="Your account is suspended. Submitting new service requests or order feedback is disabled until an administrator reactivates your account."
        />
      )}

      <Card padding={4}>
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <VStack gap={0.5}>
            <Heading level={2}>Request New Service Connection</Heading>
            <Text type="supporting">
              Choose an active Dial-Up, Broadband, or Landline plan with security deposit discount previews.
            </Text>
          </VStack>
          <Button
            variant="primary"
            label="New Request"
            isDisabled={isSuspended}
            onClick={handleOpenCreate}
          />
        </HStack>
      </Card>

      <Card padding={5}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Pending Service Requests</Heading>
              <Badge variant="neutral" label={requests.length} />
            </HStack>
          </HStack>

          {loading && requests.length === 0 ? (
            <Center padding={6}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading pending requests..." />
                <Text type="supporting">Loading service requests...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<RequestRow>
                aria-label="Pending Service Requests"
                density="compact"
                dividers="rows"
                hasHover
                idKey="id"
                columns={requestColumns}
                data={requestPagination.paginatedItems}
                rowIndexStart={requestPagination.rowIndexStart}
                rowCount={requestPagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No pending service requests"
                    description="Use New Request above to submit a new service connection request."
                    icon={<Icon icon="info" />}
                    isCompact
                  />
                }
              />
              <TablePaginationFooter
                page={requestPagination.page}
                pageSize={requestPagination.pageSize}
                totalItems={requestPagination.totalItems}
                onPageChange={requestPagination.setPage}
                onPageSizeChange={requestPagination.setPageSize}
                label="Pending service requests pagination"
              />
            </>
          )}
        </VStack>
      </Card>

      <Card padding={5}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Service Orders</Heading>
              <Badge variant="neutral" label={filteredOrders.length} />
            </HStack>

            <HStack gap={3} vAlign="end" wrap="wrap">
              <SegmentedControl
                label="Filter orders by status"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as OrderFilter)}
                size="sm"
              >
                <SegmentedControlItem value="ALL" label="All" />
                <SegmentedControlItem value="Pending" label="Pending" />
                <SegmentedControlItem value="Feasible" label="Feasible" />
                <SegmentedControlItem value="NotFeasible" label="Not Feasible" />
                <SegmentedControlItem value="Connected" label="Connected" />
              </SegmentedControl>
              <TextInput
                type="search"
                label="Search My Orders"
                placeholder="Order code, plan, or account..."
                hasClear
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </HStack>
          </HStack>

          {loading && orders.length === 0 ? (
            <Center padding={6}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading customer orders..." />
                <Text type="supporting">Loading confirmed service orders...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<OrderRow>
                aria-label="Customer Service Orders"
                density="compact"
                dividers="rows"
                hasHover
                idKey="code"
                columns={orderColumns}
                data={orderPagination.paginatedItems}
                rowIndexStart={orderPagination.rowIndexStart}
                rowCount={orderPagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No service orders found"
                    description="Confirmed requests will appear here once processed by Retail."
                    icon={<Icon icon="search" />}
                    isCompact
                  />
                }
              />
              <TablePaginationFooter
                page={orderPagination.page}
                pageSize={orderPagination.pageSize}
                totalItems={orderPagination.totalItems}
                onPageChange={orderPagination.setPage}
                onPageSizeChange={orderPagination.setPageSize}
                label="Customer orders pagination"
              />
            </>
          )}
        </VStack>
      </Card>

      <Dialog
        isOpen={isCreateOpen}
        onOpenChange={(open) => {
          if (!creating) setIsCreateOpen(open);
        }}
        purpose="form"
        width={560}
      >
        <Layout
          header={
            <DialogHeader
              title="New Service Request"
              subtitle="Select an active tariff plan and specify connection lines."
              onOpenChange={(open) => {
                if (!creating) setIsCreateOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Request submission failed"
                  error={createError}
                  onDismiss={() => setCreateError(null)}
                />
                <form id="customer-new-request-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                  <FormLayout>
                    <Selector
                      label="Service Plan"
                      placeholder="Select a service plan"
                      hasSearch
                      searchPlaceholder="Search plan name..."
                      isRequired
                      options={planOptions}
                      value={selectedPlanId}
                      onChange={(val) => {
                        setSelectedPlanId(val);
                        setCreateError(null);
                      }}
                    />

                    <NumberInput
                      label="Number of Connections (Lines)"
                      isIntegerOnly
                      min={1}
                      max={10000}
                      value={connectionCount}
                      onChange={(val) => setConnectionCount(Math.max(1, val || 1))}
                      description="10+ lines in this request qualify for 25%-100% security deposit discounts. Plan rental remains payable in full."
                    />

                    {selectedPlan?.type === 'D' && (
                      <CheckboxInput
                        label="Existing Nexus Landline Available"
                        description="Dial-Up connectivity requires an active Nexus landline."
                        value={hasNexusLandline}
                        onChange={setHasNexusLandline}
                      />
                    )}

                    <Selector
                      label="Service City Override (Optional)"
                      placeholder="Use profile city"
                      hasClear
                      hasSearch
                      isOptional
                      options={cityOptions}
                      value={cityOverride}
                      onChange={setCityOverride}
                    />

                    <TextArea
                      label="Installation Address Override (Optional)"
                      placeholder="Leave blank to use your profile address"
                      rows={2}
                      maxLength={240}
                      isOptional
                      value={addressOverride}
                      onChange={setAddressOverride}
                    />
                  </FormLayout>
                </form>

                {selectedPlan && estimate && (
                  <Card padding={4} variant="muted">
                    <VStack gap={2}>
                      <HStack hAlign="between" vAlign="center">
                        <Text weight="semibold">Deposit & Service Charge Estimate</Text>
                        <Token
                          size="sm"
                          color={estimate.discountPercent > 0 ? 'green' : 'gray'}
                          label={
                            estimate.discountPercent > 0
                              ? `${estimate.discountPercent}% Deposit Discount`
                              : 'Standard Pricing'
                          }
                        />
                      </HStack>
                      <MetadataList columns={2}>
                        <MetadataListItem label="Gross Plan Rental">
                          {formatUsd(estimate.rentalTotalUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Security Deposit">
                          {formatUsd(estimate.securityDepositGrossUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Security Deposit Discount">
                          -{formatUsd(estimate.bulkDiscountAmountUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Service Tax (12.24%)">
                          {formatUsd(estimate.serviceTaxUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Deposit to collect separately">
                          {formatUsd(estimate.netDepositUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Estimated service invoice">
                          {formatUsd(estimate.serviceInvoiceTotalUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Optional advance quote (prepayment)">
                          {estimate.advanceQuote.configured ? formatUsd(estimate.advanceQuote.quotedAmount) : 'Policy not configured'}
                        </MetadataListItem>
                        <MetadataListItem label="Combined estimate across separate charges">
                          <Text weight="bold">{formatUsd(estimate.totalEstimatedUsd)}</Text>
                        </MetadataListItem>
                      </MetadataList>
                      <Text type="supporting">Advance changes payment timing. Only money actually received can settle a service invoice; the quoted advance is not an extra charge in this total.</Text>
                    </VStack>
                  </Card>
                )}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
                <Button
                  variant="ghost"
                  label="Cancel"
                  isDisabled={creating}
                  onClick={() => setIsCreateOpen(false)}
                />
                <Button
                  type="submit"
                  form="customer-new-request-form"
                  variant="primary"
                  label="Submit Request"
                  isLoading={creating}
                  isDisabled={creating || isSuspended}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <OrderDetailDrawer
        detail={orderDetail}
        isOpen={detailOpen}
        onOpenChange={setDetailOpen}
        isLoading={detailLoading}
        error={detailError}
        onSubmitFeedback={handleDrawerFeedbackSubmit}
        feedbackSubmitting={submittingFeedback}
        feedbackError={feedbackError}
        onDismissFeedbackError={() => setFeedbackError(null)}
        isSuspended={isSuspended}
      />

      <Dialog
        isOpen={feedbackDialogOrder !== null}
        onOpenChange={(open) => {
          if (!open && !submittingFeedback) setFeedbackDialogOrder(null);
        }}
        purpose="form"
        width={480}
      >
        <Layout
          header={
            <DialogHeader
              title={
                feedbackDialogOrder
                  ? `Service Feedback: ${feedbackDialogOrder.code}`
                  : 'Service Feedback'
              }
              subtitle="Rate your installation and connection quality."
              onOpenChange={(open) => {
                if (!open && !submittingFeedback) setFeedbackDialogOrder(null);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Feedback submission failed"
                  error={feedbackError}
                  onDismiss={() => setFeedbackError(null)}
                />
                <form
                  id="customer-order-feedback-form"
                  onSubmit={(e) => void handleDialogFeedbackSubmit(e)}
                >
                  <FormLayout>
                    <Selector
                      label="Rating"
                      isRequired
                      options={FEEDBACK_RATING_OPTIONS}
                      value={feedbackRating}
                      onChange={setFeedbackRating}
                    />
                    <TextArea
                      label="Comment"
                      placeholder="Describe your service installation and speed experience..."
                      rows={3}
                      maxLength={600}
                      isRequired
                      value={feedbackComment}
                      onChange={(val) => {
                        setFeedbackComment(val);
                        setFeedbackCommentError(null);
                      }}
                      status={
                        feedbackCommentError
                          ? { type: 'error', message: feedbackCommentError }
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
                  isDisabled={submittingFeedback}
                  onClick={() => setFeedbackDialogOrder(null)}
                />
                <Button
                  type="submit"
                  form="customer-order-feedback-form"
                  variant="primary"
                  label="Submit Feedback"
                  isLoading={submittingFeedback}
                  isDisabled={submittingFeedback || isSuspended}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </VStack>
  );
}
