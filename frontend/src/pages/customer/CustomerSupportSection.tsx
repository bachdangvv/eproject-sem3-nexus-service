/**
 * Customer support queries, plan change requests, FAQ catalog, and order feedback (/customer/support).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { Token, type TokenColor } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  OrderStatusPill,
  PlanChangeStatusPill,
  QueryStatusPill,
  ServiceTypeToken,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { formatPlanPriceWithCycle } from '../../data/tariffs';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  createPlanChange,
  createQuery,
  getConnections,
  getOrders,
  getPlanChanges,
  getProfile,
  getQueries,
  submitFeedback,
} from '../../services/customerApi';
import { getFaqCatalog } from '../../services/customerQueriesApi';
import { getPublicPlans } from '../../services/publicApi';
import type {
  ConnectionLifecycleView,
  CustomerProfileView,
  CustomerQueryCategory,
  CustomerQueryView,
  FaqItemView,
  OrderView,
  PlanChangeRequestView,
  PlanView,
} from '../../types/nexus';
import {
  FEEDBACK_RATING_OPTIONS,
  QUERY_CATEGORY_OPTIONS,
  extractErrorMessage,
  type CustomerQueryRow,
  type CustomerSectionProps,
  type OrderRow,
  type PlanChangeRow,
} from './customerTypes';

type SupportTab = 'queries' | 'plan-changes' | 'faq' | 'feedback';

function getCategoryColor(category: string): TokenColor {
  switch (category) {
    case 'Billing':
      return 'blue';
    case 'Technical':
      return 'purple';
    case 'Plan':
      return 'teal';
    default:
      return 'gray';
  }
}

export function CustomerSupportSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: CustomerSectionProps): JSX.Element {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SupportTab>('queries');
  const [queries, setQueries] = useState<CustomerQueryView[]>([]);
  const [planChanges, setPlanChanges] = useState<PlanChangeRequestView[]>([]);
  const [connections, setConnections] = useState<ConnectionLifecycleView[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItemView[]>([]);
  const [profile, setProfile] = useState<CustomerProfileView | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Query form state
  const [querySubject, setQuerySubject] = useState('');
  const [queryCategory, setQueryCategory] = useState<CustomerQueryCategory>('Billing');
  const [queryQuestion, setQueryQuestion] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);
  const [submittingQuery, setSubmittingQuery] = useState(false);

  // Plan change form state
  const [selectedConnId, setSelectedConnId] = useState('');
  const [targetPlanId, setTargetPlanId] = useState('');
  const [planChangeNote, setPlanChangeNote] = useState('');
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  const [submittingPlanChange, setSubmittingPlanChange] = useState(false);

  // FAQ filter state
  const [faqCategory, setFaqCategory] = useState('ALL');
  const [faqSearch, setFaqSearch] = useState('');

  // Order feedback fallback form state
  const [selectedOrderCode, setSelectedOrderCode] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [submittedCodes, setSubmittedCodes] = useState<Record<string, boolean>>({});

  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const seqRef = useRef(0);

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
        const [queryList, pcList, connList, orderList, planList, faqList, profileData] =
          await Promise.all([
            getQueries(),
            getPlanChanges(),
            getConnections(),
            getOrders(),
            getPublicPlans(),
            getFaqCatalog(),
            getProfile(),
          ]);
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setQueries(queryList);
        setPlanChanges(pcList);
        setConnections(connList);
        setOrders(orderList);
        setPlans(planList);
        setFaqItems(faqList);
        setProfile(profileData);
        onCountChange(queryList.length + pcList.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load customer support data.'));
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

  const activeConnections = useMemo(
    () => connections.filter((c) => c.status === 'Active'),
    [connections],
  );

  const selectedConnection = useMemo(
    () => activeConnections.find((c) => String(c.id) === selectedConnId) ?? null,
    [activeConnections, selectedConnId],
  );

  const currentPlanIdForSelected = useMemo(() => {
    if (!selectedConnection) return null;
    const orderMatch = orders.find((o) => o.accountId === selectedConnection.accountId);
    if (orderMatch) return orderMatch.request.planId;
    const planMatch = plans.find(
      (p) =>
        p.type === selectedConnection.type &&
        p.name.toLowerCase() === selectedConnection.planName.toLowerCase(),
    );
    return planMatch?.id ?? null;
  }, [orders, plans, selectedConnection]);

  const targetPlanOptions = useMemo(() => {
    if (!selectedConnection) return [];
    return plans
      .filter(
        (p) =>
          p.active &&
          p.type === selectedConnection.type &&
          p.id !== currentPlanIdForSelected,
      )
      .map((p) => ({
        value: String(p.id),
        label: `${p.name} (${formatPlanPriceWithCycle(p.price, p.validityMonths)})`,
      }));
  }, [currentPlanIdForSelected, plans, selectedConnection]);

  const selectedHasPendingPlanChange = useMemo(() => {
    if (!selectedConnection) return false;
    return planChanges.some(
      (pc) => pc.connectionId === selectedConnection.id && pc.status === 'Pending',
    );
  }, [planChanges, selectedConnection]);

  const connectionOptions = useMemo(
    () =>
      activeConnections.map((c) => ({
        value: String(c.id),
        label: `${c.accountId} — ${c.planName}`,
      })),
    [activeConnections],
  );

  const connectedOrders = useMemo(
    () => orders.filter((o) => o.status === 'Connected'),
    [orders],
  );

  const connectedOrderOptions = useMemo(
    () =>
      connectedOrders.map((o) => ({
        value: o.code,
        label: `${o.code} — ${o.request.planName}`,
      })),
    [connectedOrders],
  );

  const filteredFaq = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    return faqItems.filter((item) => {
      if (faqCategory !== 'ALL' && item.category !== faqCategory) return false;
      if (!q) return true;
      return (
        item.subject.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      );
    });
  }, [faqCategory, faqItems, faqSearch]);

  const queryRows = useMemo<CustomerQueryRow[]>(
    () => queries.map((q) => ({ ...q })),
    [queries],
  );
  const queryPagination = useClientPagination(queryRows);

  const planChangeRows = useMemo<PlanChangeRow[]>(
    () => planChanges.map((pc) => ({ ...pc })),
    [planChanges],
  );
  const planChangePagination = useClientPagination(planChangeRows);

  const connectedOrderRows = useMemo<OrderRow[]>(
    () => connectedOrders.map((o) => ({ ...o })),
    [connectedOrders],
  );
  const connectedOrderPagination = useClientPagination(connectedOrderRows);

  const plansById = useMemo(() => {
    const map = new Map<number, PlanView>();
    for (const p of plans) {
      map.set(p.id, p);
    }
    return map;
  }, [plans]);

  const handleQuerySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingQuery || isSuspended) return;
    setQueryError(null);

    if (!querySubject.trim()) {
      setQueryError('Subject is required.');
      return;
    }
    if (querySubject.trim().length > 200) {
      setQueryError('Subject must be 200 characters or fewer.');
      return;
    }
    if (!queryQuestion.trim()) {
      setQueryError('Question details are required.');
      return;
    }

    setSubmittingQuery(true);
    try {
      const created = await createQuery({
        subject: querySubject.trim(),
        category: queryCategory,
        question: queryQuestion.trim(),
      });
      if (!isMountedRef.current) return;
      setQuerySubject('');
      setQueryQuestion('');
      toast({ body: `Support query #${created.id} submitted.` });
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setQueryError(extractErrorMessage(err, 'Could not submit customer query.'));
    } finally {
      if (isMountedRef.current) {
        setSubmittingQuery(false);
      }
    }
  };

  const handlePlanChangeSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingPlanChange || isSuspended) return;
    setPlanChangeError(null);

    const connId = Number(selectedConnId);
    const nextPlanId = Number(targetPlanId);
    if (!selectedConnection || !Number.isFinite(connId) || connId <= 0) {
      setPlanChangeError('Select an active connection.');
      return;
    }
    if (!Number.isFinite(nextPlanId) || nextPlanId <= 0) {
      setPlanChangeError('Select a target service plan.');
      return;
    }

    setSubmittingPlanChange(true);
    try {
      const created = await createPlanChange({
        connectionId: connId,
        targetPlanId: nextPlanId,
        note: planChangeNote.trim() || null,
      });
      if (!isMountedRef.current) return;
      setSelectedConnId('');
      setTargetPlanId('');
      setPlanChangeNote('');
      toast({ body: `Plan change request #${created.id} submitted.` });
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setPlanChangeError(extractErrorMessage(err, 'Could not submit plan change request.'));
    } finally {
      if (isMountedRef.current) {
        setSubmittingPlanChange(false);
      }
    }
  };

  const handleFeedbackSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingFeedback || isSuspended) return;
    setFeedbackError(null);

    if (!selectedOrderCode) {
      setFeedbackError('Select a connected order.');
      return;
    }
    if (!feedbackComment.trim()) {
      setFeedbackError('Please enter your feedback comment.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await submitFeedback(selectedOrderCode, {
        rating: Number(feedbackRating) || 5,
        comment: feedbackComment.trim(),
      });
      if (!isMountedRef.current) return;
      setSubmittedCodes((prev) => ({ ...prev, [selectedOrderCode]: true }));
      setFeedbackComment('');
      toast({ body: `Feedback submitted for order ${selectedOrderCode}.` });
      setSelectedOrderCode('');
    } catch (err) {
      if (!isMountedRef.current) return;
      setFeedbackError(extractErrorMessage(err, 'Could not submit order feedback.'));
    } finally {
      if (isMountedRef.current) {
        setSubmittingFeedback(false);
      }
    }
  };

  const queryColumns: TableColumn<CustomerQueryRow>[] = [
    {
      key: 'id',
      header: 'Ticket #',
      width: pixel(90),
      renderCell: (q) => <Text weight="semibold">#{q.id}</Text>,
    },
    {
      key: 'subject',
      header: 'Subject & Question',
      width: proportional(1.8, { minWidth: 220 }),
      renderCell: (q) => (
        <VStack gap={1}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{q.subject}</Text>
            {q.isFaq && <Token size="sm" color="teal" label="FAQ Published" />}
          </HStack>
          <Text type="supporting">{q.question}</Text>
        </VStack>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: pixel(110),
      renderCell: (q) => (
        <Token size="sm" color={getCategoryColor(q.category)} label={q.category} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (q) => <QueryStatusPill status={q.status} />,
    },
    {
      key: 'answer',
      header: 'Staff Response',
      width: proportional(1.5, { minWidth: 200 }),
      renderCell: (q) =>
        q.answer ? (
          <VStack gap={0.5}>
            <Text>{q.answer}</Text>
            <Text type="supporting">
              {q.answeredByName ? `By ${q.answeredByName}` : 'Staff response'}
              {q.answeredAt ? ' · ' : ''}
              {q.answeredAt && <Timestamp value={q.answeredAt} format="date" />}
            </Text>
          </VStack>
        ) : (
          <Text type="supporting">Awaiting response</Text>
        ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      width: pixel(135),
      renderCell: (q) => <Timestamp value={q.createdAt} format="date" />,
    },
  ];

  const planChangeColumns: TableColumn<PlanChangeRow>[] = [
    {
      key: 'id',
      header: 'Req #',
      width: pixel(85),
      renderCell: (pc) => <Text weight="semibold">#{pc.id}</Text>,
    },
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(245),
      renderCell: (pc) =>
        pc.accountId ? (
          <CopyableId value={pc.accountId} label="Account ID" />
        ) : (
          <Text type="supporting">Conn #{pc.connectionId}</Text>
        ),
    },
    {
      key: 'currentPlan',
      header: 'Current Plan',
      width: proportional(1.2, { minWidth: 150 }),
      renderCell: (pc) => (
        <VStack gap={0.5}>
          <Text>{pc.currentPlanName}</Text>
          <Text type="supporting">
            {formatPlanPriceWithCycle(
              pc.currentPlanPrice,
              plansById.get(pc.currentPlanId)?.validityMonths,
            )}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'targetPlan',
      header: 'Requested Plan',
      width: proportional(1.2, { minWidth: 150 }),
      renderCell: (pc) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{pc.targetPlanName}</Text>
          <Text type="supporting">
            {formatPlanPriceWithCycle(
              pc.targetPlanPrice,
              plansById.get(pc.targetPlanId)?.validityMonths,
            )}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (pc) => <PlanChangeStatusPill status={pc.status} />,
    },
    {
      key: 'note',
      header: 'Note & Review',
      width: proportional(1.3, { minWidth: 170 }),
      renderCell: (pc) => (
        <VStack gap={0.5}>
          <Text type="supporting">{pc.note || '-'}</Text>
          {pc.reviewedByName && (
            <Text type="supporting">
              Reviewed by {pc.reviewedByName}
              {pc.reviewedAt ? ' · ' : ''}
              {pc.reviewedAt && <Timestamp value={pc.reviewedAt} format="date" />}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'requestedAt',
      header: 'Requested',
      width: pixel(135),
      renderCell: (pc) => <Timestamp value={pc.requestedAt} format="date" />,
    },
  ];

  const connectedOrderColumns: TableColumn<OrderRow>[] = [
    {
      key: 'code',
      header: 'Order Code',
      width: pixel(205),
      renderCell: (o) => <CopyableId value={o.code} label="Order Code" />,
    },
    {
      key: 'plan',
      header: 'Service Plan',
      width: proportional(1.4),
      renderCell: (o) => (
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text weight="semibold">{o.request.planName}</Text>
          <ServiceTypeToken type={o.request.type} />
        </HStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(135),
      renderCell: (o) => <OrderStatusPill status={o.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      width: pixel(140),
      align: 'end',
      renderCell: (o) => (
        <Button
          size="sm"
          variant="secondary"
          label={submittedCodes[o.code] ? 'Rated' : 'Select'}
          isDisabled={isSuspended || Boolean(submittedCodes[o.code])}
          onClick={() => setSelectedOrderCode(o.code)}
        />
      ),
    },
  ];

  return (
    <VStack gap={5}>
      <ApiErrorBanner
        title="Failed to load support workspace"
        error={loadError}
        onDismiss={() => setLoadError(null)}
      />

      {isSuspended && (
        <Banner
          status="warning"
          container="card"
          collapsible={false}
          title="Account Suspended"
          description="Your account is suspended. Submitting new queries, plan change requests, or order feedback is disabled until an administrator reactivates your account."
        />
      )}

      <Card padding={4}>
        <SegmentedControl
          label="Support and plan change sections"
          value={activeTab}
          onChange={(val) => setActiveTab(val as SupportTab)}
        >
          <SegmentedControlItem value="queries" label="Customer Queries" />
          <SegmentedControlItem value="plan-changes" label="Plan Changes" />
          <SegmentedControlItem value="faq" label="FAQ Catalog" />
          <SegmentedControlItem value="feedback" label="Order Feedback" />
        </SegmentedControl>
      </Card>

      {activeTab === 'queries' && (
        <Grid columns={{ minWidth: 320, max: 2 }} gap={5} align="start">
          <Card padding={5}>
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2}>Submit a Query</Heading>
                <Text type="supporting">
                  Ask our billing, technical, or plan specialists for assistance.
                </Text>
              </VStack>

              <ApiErrorBanner
                title="Query submission failed"
                error={queryError}
                onDismiss={() => setQueryError(null)}
              />

              <form onSubmit={(e) => void handleQuerySubmit(e)}>
                <FormLayout>
                  <TextInput
                    label="Subject"
                    placeholder="e.g. Monthly invoice breakdown"
                    isRequired
                    isDisabled={isSuspended || submittingQuery}
                    value={querySubject}
                    onChange={setQuerySubject}
                  />
                  <Selector
                    label="Category"
                    isRequired
                    isDisabled={isSuspended || submittingQuery}
                    options={QUERY_CATEGORY_OPTIONS}
                    value={queryCategory}
                    onChange={(val) => setQueryCategory(val as CustomerQueryCategory)}
                  />
                  <TextArea
                    label="Question"
                    placeholder="Describe your question or issue..."
                    rows={4}
                    maxLength={1000}
                    isRequired
                    isDisabled={isSuspended || submittingQuery}
                    value={queryQuestion}
                    onChange={setQueryQuestion}
                  />
                  <HStack gap={2}>
                    <Button
                      type="submit"
                      variant="primary"
                      label="Submit Query"
                      isLoading={submittingQuery}
                      isDisabled={isSuspended || submittingQuery}
                    />
                  </HStack>
                </FormLayout>
              </form>
            </VStack>
          </Card>

          <Card padding={5}>
            <VStack gap={4}>
              <HStack gap={2} vAlign="center">
                <Heading level={2}>My Queries</Heading>
                <Badge variant="neutral" label={queries.length} />
              </HStack>

              {loading && queries.length === 0 ? (
                <Center padding={6}>
                  <Spinner size="lg" label="Loading customer queries..." />
                </Center>
              ) : (
                <>
                  <Table<CustomerQueryRow>
                    aria-label="Customer Queries Table"
                    density="compact"
                    dividers="rows"
                    hasHover
                    idKey="id"
                    columns={queryColumns}
                    data={queryPagination.paginatedItems}
                    rowIndexStart={queryPagination.rowIndexStart}
                    rowCount={queryPagination.totalItems}
                    emptyState={
                      <EmptyState
                        title="No queries submitted"
                        description="Use the form to submit a question to Nexus Support."
                        icon={<Icon icon="info" />}
                        isCompact
                      />
                    }
                  />
                  <TablePaginationFooter
                    page={queryPagination.page}
                    pageSize={queryPagination.pageSize}
                    totalItems={queryPagination.totalItems}
                    onPageChange={queryPagination.setPage}
                    onPageSizeChange={queryPagination.setPageSize}
                    label="Customer queries pagination"
                  />
                </>
              )}
            </VStack>
          </Card>
        </Grid>
      )}

      {activeTab === 'plan-changes' && (
        <Grid columns={{ minWidth: 320, max: 2 }} gap={5} align="start">
          <Card padding={5}>
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2}>Request Plan Change</Heading>
                <Text type="supporting">
                  Migrate an active connection to another active plan of the same service type.
                </Text>
              </VStack>

              {activeConnections.length === 0 && !loading && (
                <Banner
                  status="info"
                  container="card"
                  collapsible={false}
                  title="No Active Connections"
                  description="Plan change requests require an Active connection."
                />
              )}

              {selectedHasPendingPlanChange && (
                <Banner
                  status="warning"
                  container="card"
                  collapsible={false}
                  title="Pending Request Exists"
                  description="This connection already has a pending plan change request awaiting review."
                />
              )}

              <ApiErrorBanner
                title="Plan change submission failed"
                error={planChangeError}
                onDismiss={() => setPlanChangeError(null)}
              />

              <form onSubmit={(e) => void handlePlanChangeSubmit(e)}>
                <FormLayout>
                  <Selector
                    label="Active Connection"
                    placeholder="Select an active connection"
                    isRequired
                    isDisabled={
                      isSuspended || activeConnections.length === 0 || submittingPlanChange
                    }
                    options={connectionOptions}
                    value={selectedConnId}
                    onChange={(val) => {
                      setSelectedConnId(val);
                      setTargetPlanId('');
                      setPlanChangeError(null);
                    }}
                  />
                  <Selector
                    label="Target Service Plan"
                    placeholder={
                      selectedConnection
                        ? 'Select a replacement plan'
                        : 'Select a connection first'
                    }
                    isRequired
                    isDisabled={
                      isSuspended ||
                      !selectedConnection ||
                      targetPlanOptions.length === 0 ||
                      submittingPlanChange
                    }
                    options={targetPlanOptions}
                    value={targetPlanId}
                    onChange={setTargetPlanId}
                  />
                  <TextArea
                    label="Request Note (Optional)"
                    placeholder="Reason for upgrade or tariff change..."
                    rows={3}
                    maxLength={500}
                    isOptional
                    isDisabled={isSuspended || submittingPlanChange}
                    value={planChangeNote}
                    onChange={setPlanChangeNote}
                  />
                  <HStack gap={2}>
                    <Button
                      type="submit"
                      variant="primary"
                      label="Request Plan Change"
                      isLoading={submittingPlanChange}
                      isDisabled={
                        isSuspended ||
                        submittingPlanChange ||
                        activeConnections.length === 0 ||
                        selectedHasPendingPlanChange
                      }
                    />
                  </HStack>
                </FormLayout>
              </form>
            </VStack>
          </Card>

          <Card padding={5}>
            <VStack gap={4}>
              <HStack gap={2} vAlign="center">
                <Heading level={2}>Plan Change History</Heading>
                <Badge variant="neutral" label={planChanges.length} />
              </HStack>

              {loading && planChanges.length === 0 ? (
                <Center padding={6}>
                  <Spinner size="lg" label="Loading plan change requests..." />
                </Center>
              ) : (
                <>
                  <Table<PlanChangeRow>
                    aria-label="Customer Plan Change Requests"
                    density="compact"
                    dividers="rows"
                    hasHover
                    idKey="id"
                    columns={planChangeColumns}
                    data={planChangePagination.paginatedItems}
                    rowIndexStart={planChangePagination.rowIndexStart}
                    rowCount={planChangePagination.totalItems}
                    emptyState={
                      <EmptyState
                        title="No plan change requests"
                        description="Submitted plan migrations will appear here with review status."
                        icon={<Icon icon="info" />}
                        isCompact
                      />
                    }
                  />
                  <TablePaginationFooter
                    page={planChangePagination.page}
                    pageSize={planChangePagination.pageSize}
                    totalItems={planChangePagination.totalItems}
                    onPageChange={planChangePagination.setPage}
                    onPageSizeChange={planChangePagination.setPageSize}
                    label="Customer plan changes pagination"
                  />
                </>
              )}
            </VStack>
          </Card>
        </Grid>
      )}

      {activeTab === 'faq' && (
        <Card padding={5}>
          <VStack gap={4}>
            <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
              <HStack gap={2} vAlign="center">
                <Heading level={2}>FAQ Catalog</Heading>
                <Badge variant="neutral" label={filteredFaq.length} />
              </HStack>
              <HStack gap={3} vAlign="end" wrap="wrap">
                <SegmentedControl
                  label="Filter FAQ by category"
                  value={faqCategory}
                  onChange={setFaqCategory}
                  size="sm"
                >
                  <SegmentedControlItem value="ALL" label="All" />
                  <SegmentedControlItem value="Billing" label="Billing" />
                  <SegmentedControlItem value="Technical" label="Technical" />
                  <SegmentedControlItem value="Plan" label="Plan" />
                  <SegmentedControlItem value="General" label="General" />
                </SegmentedControl>
                <TextInput
                  type="search"
                  label="Search FAQ"
                  placeholder="Search questions or answers..."
                  hasClear
                  value={faqSearch}
                  onChange={setFaqSearch}
                />
              </HStack>
            </HStack>

            {filteredFaq.length === 0 ? (
              <EmptyState
                title="No matching FAQ articles"
                description="Try clearing your search or selecting All categories."
                icon={<Icon icon="info" />}
                isCompact
              />
            ) : (
              <CollapsibleGroup type="multiple" hasDividers>
                {filteredFaq.map((item) => (
                  <Collapsible
                    key={item.id}
                    trigger={
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Token
                          size="sm"
                          color={getCategoryColor(item.category)}
                          label={item.category}
                        />
                        <Text weight="semibold">{item.question}</Text>
                      </HStack>
                    }
                  >
                    <VStack gap={1}>
                      <Text type="eyebrow">{item.subject}</Text>
                      <Text type="body">{item.answer}</Text>
                    </VStack>
                  </Collapsible>
                ))}
              </CollapsibleGroup>
            )}
          </VStack>
        </Card>
      )}

      {activeTab === 'feedback' && (
        <Grid columns={{ minWidth: 320, max: 2 }} gap={5} align="start">
          <Card padding={5}>
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2}>Submit Order Feedback</Heading>
                <Text type="supporting">
                  Rate any connected service order on a 1-to-5 scale.
                </Text>
              </VStack>

              <ApiErrorBanner
                title="Feedback submission failed"
                error={feedbackError}
                onDismiss={() => setFeedbackError(null)}
              />

              <form onSubmit={(e) => void handleFeedbackSubmit(e)}>
                <FormLayout>
                  <Selector
                    label="Connected Order"
                    placeholder="Select a connected order"
                    isRequired
                    isDisabled={
                      isSuspended || connectedOrders.length === 0 || submittingFeedback
                    }
                    options={connectedOrderOptions}
                    value={selectedOrderCode}
                    onChange={(val) => {
                      setSelectedOrderCode(val);
                      setFeedbackError(null);
                    }}
                  />
                  <Selector
                    label="Rating"
                    isRequired
                    isDisabled={isSuspended || submittingFeedback}
                    options={FEEDBACK_RATING_OPTIONS}
                    value={feedbackRating}
                    onChange={setFeedbackRating}
                  />
                  <TextArea
                    label="Comment"
                    placeholder="Share your feedback on installation and service quality..."
                    rows={3}
                    maxLength={600}
                    isRequired
                    isDisabled={isSuspended || submittingFeedback}
                    value={feedbackComment}
                    onChange={setFeedbackComment}
                  />
                  <HStack gap={2}>
                    <Button
                      type="submit"
                      variant="primary"
                      label="Submit Feedback"
                      isLoading={submittingFeedback}
                      isDisabled={
                        isSuspended || submittingFeedback || connectedOrders.length === 0
                      }
                    />
                  </HStack>
                </FormLayout>
              </form>
            </VStack>
          </Card>

          <Card padding={5}>
            <VStack gap={4}>
              <HStack gap={2} vAlign="center">
                <Heading level={2}>Connected Orders</Heading>
                <Badge variant="neutral" label={connectedOrders.length} />
              </HStack>
              <Table<OrderRow>
                aria-label="Connected Orders for Feedback"
                density="compact"
                dividers="rows"
                hasHover
                idKey="code"
                columns={connectedOrderColumns}
                data={connectedOrderPagination.paginatedItems}
                rowIndexStart={connectedOrderPagination.rowIndexStart}
                rowCount={connectedOrderPagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No connected orders yet"
                    description="Feedback becomes available once an order is Connected."
                    icon={<Icon icon="info" />}
                    isCompact
                  />
                }
              />
              <TablePaginationFooter
                page={connectedOrderPagination.page}
                pageSize={connectedOrderPagination.pageSize}
                totalItems={connectedOrderPagination.totalItems}
                onPageChange={connectedOrderPagination.setPage}
                onPageSizeChange={connectedOrderPagination.setPageSize}
                label="Connected orders feedback pagination"
              />
            </VStack>
          </Card>
        </Grid>
      )}
    </VStack>
  );
}
