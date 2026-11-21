/**
 * Customer inquiries ticketing and dynamic FAQ catalog management section.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Code } from '@astryxdesign/core/Code';
import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
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
import { ApiErrorBanner, StatusLabel } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  answerQuery,
  closeQuery,
  createQuery,
  getFaqCatalog,
  getQueries,
} from '../../services/customerQueriesApi';
import { getCustomers } from '../../services/operationsApi';
import {
  ApiError,
  type CustomerQueryCategory,
  type CustomerQueryStatus,
  type CustomerQueryView,
  type CustomerView,
  type FaqItemView,
} from '../../types/nexus';

type CustomerQueryRow = CustomerQueryView & Record<string, unknown>;
type QueriesViewMode = 'inquiries' | 'faq';

export interface CustomerQueriesSectionProps {
  refreshTrigger: number;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
  portalRole?: 'Admin' | 'Retail';
}

const QUERY_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'Answered', label: 'Answered' },
  { value: 'Closed', label: 'Closed' },
];

const QUERY_CATEGORY_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'Billing', label: 'Billing' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Plan', label: 'Plan' },
  { value: 'General', label: 'General' },
];

const QUERY_CATEGORY_FORM_OPTIONS: Array<{ value: CustomerQueryCategory; label: string }> = [
  { value: 'Billing', label: 'Billing' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Plan', label: 'Plan' },
  { value: 'General', label: 'General' },
];

const CATEGORY_ORDER: readonly CustomerQueryCategory[] = [
  'Billing',
  'Technical',
  'Plan',
  'General',
];

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

function renderQueryStatus(status: CustomerQueryStatus) {
  switch (status) {
    case 'Open':
      return <StatusLabel variant="warning" label="Open" />;
    case 'Answered':
      return <StatusLabel variant="success" label="Answered" />;
    case 'Closed':
      return <StatusLabel variant="neutral" label="Closed" />;
  }
}

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.detail || err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function CustomerQueriesSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
  portalRole = 'Retail',
}: CustomerQueriesSectionProps): JSX.Element {
  const toast = useToast();

  const [activeView, setActiveView] = useState<QueriesViewMode>('inquiries');

  const [queries, setQueries] = useState<CustomerQueryView[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItemView[]>([]);
  const [customers, setCustomers] = useState<CustomerView[]>([]);

  // Inquiries filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // FAQ filters
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('ALL');
  const [faqSearchInput, setFaqSearchInput] = useState('');
  const [debouncedFaqSearch, setDebouncedFaqSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);

  // Create Query modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerLookupQuery, setCustomerLookupQuery] = useState('');
  const [createCustomerId, setCreateCustomerId] = useState<string>('');
  const [createCategory, setCreateCategory] = useState<CustomerQueryCategory>('Billing');
  const [createSubject, setCreateSubject] = useState('');
  const [createQuestion, setCreateQuestion] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Answer / Promote to FAQ modal
  const [answerTarget, setAnswerTarget] = useState<CustomerQueryView | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerIsFaq, setAnswerIsFaq] = useState(false);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // Close confirmation dialog
  const [closeTarget, setCloseTarget] = useState<CustomerQueryView | null>(null);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  // Detail inspection drawer
  const [detailTarget, setDetailTarget] = useState<CustomerQueryView | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const faqSeqRef = useRef(0);
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

  const trimmedFaqSearch = faqSearchInput.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFaqSearch(trimmedFaqSearch), 300);
    return () => window.clearTimeout(timer);
  }, [trimmedFaqSearch]);

  useEffect(() => {
    let cancelled = false;
    getCustomers()
      .then((list) => {
        if (!cancelled && isMountedRef.current) {
          setCustomers(list);
        }
      })
      .catch(() => {
        // Non-fatal
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    const trimmed = customerLookupQuery.trim();
    const timer = window.setTimeout(() => {
      getCustomers(trimmed || undefined)
        .then((list) => {
          if (isMountedRef.current) {
            setCustomers(list);
          }
        })
        .catch(() => {
          // Non-fatal
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerLookupQuery, isCreateOpen]);

  const fetchQueries = useCallback(
    async (status: string, category: string, silent = false) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const data = await getQueries({
          status: status === 'ALL' ? undefined : status,
          category: category === 'ALL' ? undefined : category,
        });
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setQueries(data);
        if (activeView === 'inquiries') {
          onCountChange(data.length);
        }
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractError(err, 'Failed to load customer queries.'));
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [activeView, onCountChange, onRefreshingChange],
  );

  const fetchFaqCatalog = useCallback(
    async (category: string, silent = false) => {
      if (!isMountedRef.current) return;
      const seq = ++faqSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setFaqLoading(true);
      }
      setFaqError(null);

      try {
        const data = await getFaqCatalog(category === 'ALL' ? undefined : category);
        if (!isMountedRef.current || seq !== faqSeqRef.current) return;
        setFaqItems(data);
        if (activeView === 'faq') {
          onCountChange(data.length);
        }
      } catch (err) {
        if (!isMountedRef.current || seq !== faqSeqRef.current) return;
        setFaqError(extractError(err, 'Failed to load dynamic FAQ catalog.'));
      } finally {
        if (isMountedRef.current && seq === faqSeqRef.current) {
          setFaqLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [activeView, onCountChange, onRefreshingChange],
  );

  useEffect(() => {
    const isSilent = hasLoadedOnceRef.current && refreshTrigger > 0;
    hasLoadedOnceRef.current = true;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled && isMountedRef.current) {
        return fetchQueries(statusFilter, categoryFilter, isSilent);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [categoryFilter, fetchQueries, refreshTrigger, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled && isMountedRef.current) {
        return fetchFaqCatalog(faqCategoryFilter, refreshTrigger > 0);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [faqCategoryFilter, fetchFaqCatalog, refreshTrigger]);

  useEffect(() => {
    if (activeView === 'inquiries') {
      onCountChange(queries.length);
    } else {
      onCountChange(faqItems.length);
    }
  }, [activeView, faqItems.length, onCountChange, queries.length]);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: String(c.id),
        label: `${c.code} · ${c.name} (${c.phone})`,
      })),
    [customers],
  );

  const filteredQueries = useMemo<CustomerQueryRow[]>(() => {
    const needle = debouncedSearch.toLowerCase();
    return queries
      .filter((q) => {
        if (!needle) return true;
        return (
          String(q.id).includes(needle) ||
          q.customerName.toLowerCase().includes(needle) ||
          q.subject.toLowerCase().includes(needle) ||
          q.category.toLowerCase().includes(needle) ||
          q.question.toLowerCase().includes(needle) ||
          (q.answer ? q.answer.toLowerCase().includes(needle) : false)
        );
      })
      .map((q) => ({ ...q }));
  }, [debouncedSearch, queries]);

  const pagination = useClientPagination(filteredQueries, {
    resetKey: `${statusFilter}::${categoryFilter}::${debouncedSearch}`,
  });

  const filteredFaqs = useMemo(() => {
    const needle = debouncedFaqSearch.toLowerCase();
    return faqItems.filter((item) => {
      if (!needle) return true;
      return (
        item.subject.toLowerCase().includes(needle) ||
        item.question.toLowerCase().includes(needle) ||
        item.answer.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      );
    });
  }, [debouncedFaqSearch, faqItems]);

  const groupedFaqs = useMemo(() => {
    const groups = new Map<string, FaqItemView[]>();
    for (const cat of CATEGORY_ORDER) {
      groups.set(cat, []);
    }
    for (const item of filteredFaqs) {
      const existing = groups.get(item.category);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(item.category, [item]);
      }
    }
    return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
  }, [filteredFaqs]);

  const openCreateDialog = () => {
    setCreateCustomerId(customers[0] ? String(customers[0].id) : '');
    setCreateCategory('Billing');
    setCreateSubject('');
    setCreateQuestion('');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openAnswerDialog = (row: CustomerQueryView) => {
    setAnswerTarget(row);
    setAnswerText(row.answer ?? '');
    setAnswerIsFaq(row.isFaq);
    setAnswerError(null);
  };

  const handleCreateQuery = async (e: FormEvent) => {
    e.preventDefault();
    if (createSubmitting) return;
    setCreateError(null);

    const parsedCustomerId = Number(createCustomerId);
    if (!Number.isInteger(parsedCustomerId) || parsedCustomerId < 1) {
      setCreateError('Select a customer for this inquiry.');
      return;
    }

    const trimmedSubject = createSubject.trim();
    if (!trimmedSubject) {
      setCreateError('Subject is required.');
      return;
    }
    if (trimmedSubject.length > 200) {
      setCreateError('Subject must not exceed 200 characters.');
      return;
    }

    const trimmedQuestion = createQuestion.trim();
    if (!trimmedQuestion) {
      setCreateError('Customer question is required.');
      return;
    }
    if (trimmedQuestion.length > 1000) {
      setCreateError('Question must not exceed 1000 characters.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const created = await createQuery({
        customerId: parsedCustomerId,
        subject: trimmedSubject,
        category: createCategory,
        question: trimmedQuestion,
      });
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      setActiveView('inquiries');
      toast({ body: `Logged inquiry #${created.id}: ${created.subject}` });
      pagination.focusItem((r) => r.id === created.id);
      await fetchQueries(statusFilter, categoryFilter, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setCreateError(extractError(err, 'Failed to log customer inquiry.'));
    } finally {
      if (isMountedRef.current) {
        setCreateSubmitting(false);
      }
    }
  };

  const handleAnswerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!answerTarget || answerSubmitting) return;
    setAnswerError(null);

    const trimmedAnswer = answerText.trim();
    if (!trimmedAnswer) {
      setAnswerError('Official staff answer is required.');
      return;
    }
    if (trimmedAnswer.length > 2000) {
      setAnswerError('Answer must not exceed 2000 characters.');
      return;
    }

    setAnswerSubmitting(true);
    try {
      const updated = await answerQuery(answerTarget.id, {
        answer: trimmedAnswer,
        isFaq: answerIsFaq,
      });
      if (!isMountedRef.current) return;
      setAnswerTarget(null);
      if (detailTarget?.id === updated.id) {
        setDetailTarget(updated);
      }
      toast({
        body: updated.isFaq
          ? `Answered inquiry #${updated.id} and published to Dynamic FAQ Catalog.`
          : `Answered inquiry #${updated.id}.`,
      });
      await Promise.all([
        fetchQueries(statusFilter, categoryFilter, true),
        fetchFaqCatalog(faqCategoryFilter, true),
      ]);
    } catch (err) {
      if (!isMountedRef.current) return;
      setAnswerError(extractError(err, 'Failed to record answer.'));
    } finally {
      if (isMountedRef.current) {
        setAnswerSubmitting(false);
      }
    }
  };

  const handleConfirmClose = async () => {
    if (!closeTarget || closeSubmitting) return;
    setCloseSubmitting(true);
    try {
      const updated = await closeQuery(closeTarget.id);
      if (!isMountedRef.current) return;
      setCloseTarget(null);
      if (detailTarget?.id === updated.id) {
        setDetailTarget(updated);
      }
      toast({ body: `Closed inquiry #${updated.id}.` });
      await fetchQueries(statusFilter, categoryFilter, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(extractError(err, 'Failed to close customer inquiry.'));
      setCloseTarget(null);
    } finally {
      if (isMountedRef.current) {
        setCloseSubmitting(false);
      }
    }
  };

  const columns: TableColumn<CustomerQueryRow>[] = [
    {
      key: 'id',
      header: 'ID',
      width: pixel(80),
      renderCell: (row) => <Code>{`#${row.id}`}</Code>,
    },
    {
      key: 'customer',
      header: 'Customer',
      width: proportional(1.2, { minWidth: 160 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.customerName}</Text>
          <Text type="supporting">{`CUS-${String(row.customerId).padStart(6, '0')}`}</Text>
        </VStack>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: pixel(120),
      renderCell: (row) => (
        <Token
          size="sm"
          color={getCategoryColor(row.category)}
          label={row.category}
        />
      ),
    },
    {
      key: 'subject',
      header: 'Subject & Question',
      width: proportional(2.1, { minWidth: 230 }),
      renderCell: (row) => (
        <VStack gap={1}>
          <HStack gap={1.5} vAlign="center" wrap="wrap">
            <Text weight="medium">{row.subject}</Text>
            {row.isFaq && <Token size="sm" color="green" label="FAQ Published" />}
          </HStack>
          <Text type="supporting" maxLines={2}>
            {row.question}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (row) => renderQueryStatus(row.status),
    },
    {
      key: 'createdAt',
      header: 'Logged',
      width: pixel(145),
      renderCell: (row) => <Timestamp value={row.createdAt} format="relative" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(220),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={1.5} hAlign="end" wrap="nowrap">
          <Button
            size="sm"
            variant="ghost"
            label="View"
            onClick={() => setDetailTarget(row)}
          />
          {row.status !== 'Closed' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                label={row.status === 'Answered' ? 'Edit FAQ' : 'Answer'}
                onClick={() => openAnswerDialog(row)}
              />
              <Button
                size="sm"
                variant="ghost"
                label="Close"
                onClick={() => setCloseTarget(row)}
              />
            </>
          )}
        </HStack>
      ),
    },
  ];

  const hasInquiryFilters =
    statusFilter !== 'ALL' || categoryFilter !== 'ALL' || Boolean(searchInput);
  const hasFaqFilters = faqCategoryFilter !== 'ALL' || Boolean(faqSearchInput);

  return (
    <Card padding={5}>
      <VStack gap={5}>
        {/* Top Switcher + CTA */}
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <SegmentedControl
            label="Queries and FAQ View"
            value={activeView}
            onChange={(val) => setActiveView(val as QueriesViewMode)}
          >
            <SegmentedControlItem value="inquiries" label="Customer Inquiries" />
            <SegmentedControlItem value="faq" label="Dynamic FAQ Catalog" />
          </SegmentedControl>

          <Button
            variant="primary"
            label="Log Customer Query"
            onClick={openCreateDialog}
          />
        </HStack>

        {activeView === 'inquiries' ? (
          <VStack gap={4}>
            <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
              <HStack gap={3} vAlign="end" wrap="wrap">
                <Selector
                  label="Status"
                  options={QUERY_STATUS_FILTER_OPTIONS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <Selector
                  label="Category"
                  options={QUERY_CATEGORY_FILTER_OPTIONS}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                />
                <TextInput
                  type="search"
                  label="Search Inquiries"
                  placeholder="Subject, customer, question..."
                  value={searchInput}
                  onChange={setSearchInput}
                  hasClear
                />
              </HStack>

              <HStack gap={2} vAlign="center" wrap="wrap">
                {hasInquiryFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    label="Reset filters"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setCategoryFilter('ALL');
                      setSearchInput('');
                    }}
                  />
                )}
                <Text type="supporting" hasTabularNumbers>
                  {`Total: ${filteredQueries.length} quer${filteredQueries.length === 1 ? 'y' : 'ies'}`}
                </Text>
              </HStack>
            </HStack>

            <ApiErrorBanner
              title="Failed to load customer queries"
              error={loadError}
              onDismiss={() => setLoadError(null)}
            />

            {loading ? (
              <Center padding={8}>
                <VStack gap={3} hAlign="center">
                  <Spinner size="lg" label="Loading customer queries..." />
                  <Text type="supporting">
                    {`Fetching ${portalRole} support inquiries...`}
                  </Text>
                </VStack>
              </Center>
            ) : filteredQueries.length === 0 ? (
              <EmptyState
                title="No customer inquiries found"
                description={
                  hasInquiryFilters
                    ? 'No inquiries match the selected Status, Category, or search text.'
                    : 'Log a new customer inquiry to track responses and build the FAQ catalog.'
                }
                icon={<Icon icon="info" />}
                actions={
                  <Button
                    variant="primary"
                    label="Log Customer Query"
                    onClick={openCreateDialog}
                  />
                }
              />
            ) : (
              <VStack gap={3}>
                <Table<CustomerQueryRow>
                  aria-label="Customer Support Inquiries"
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
                  label="Customer queries pagination"
                />
              </VStack>
            )}
          </VStack>
        ) : (
          <VStack gap={4}>
            <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
              <HStack gap={3} vAlign="end" wrap="wrap">
                <Selector
                  label="FAQ Category"
                  options={QUERY_CATEGORY_FILTER_OPTIONS}
                  value={faqCategoryFilter}
                  onChange={setFaqCategoryFilter}
                />
                <TextInput
                  type="search"
                  label="Search FAQ Catalog"
                  placeholder="Filter topics, questions, answers..."
                  value={faqSearchInput}
                  onChange={setFaqSearchInput}
                  hasClear
                />
              </HStack>

              <HStack gap={2} vAlign="center" wrap="wrap">
                {hasFaqFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    label="Reset filters"
                    onClick={() => {
                      setFaqCategoryFilter('ALL');
                      setFaqSearchInput('');
                    }}
                  />
                )}
                <Text type="supporting" hasTabularNumbers>
                  {`Published: ${filteredFaqs.length} topic${filteredFaqs.length === 1 ? '' : 's'}`}
                </Text>
              </HStack>
            </HStack>

            <ApiErrorBanner
              title="Failed to load FAQ catalog"
              error={faqError}
              onDismiss={() => setFaqError(null)}
            />

            {faqLoading ? (
              <Center padding={8}>
                <VStack gap={3} hAlign="center">
                  <Spinner size="lg" label="Loading FAQ catalog..." />
                  <Text type="supporting">Loading published FAQ topics...</Text>
                </VStack>
              </Center>
            ) : groupedFaqs.length === 0 ? (
              <EmptyState
                title="No published FAQ topics"
                description={
                  hasFaqFilters
                    ? 'No published FAQ entries match your filter criteria.'
                    : 'Answer an inquiry and check "Publish to Dynamic FAQ Catalog" to populate topics.'
                }
                icon={<Icon icon="info" />}
              />
            ) : (
              <VStack gap={5}>
                {groupedFaqs.map(([category, items]) => (
                  <VStack key={category} gap={3}>
                    <HStack gap={2} vAlign="center">
                      <Token
                        size="sm"
                        color={getCategoryColor(category)}
                        label={category}
                      />
                      <Heading level={3}>{`${category} Topics (${items.length})`}</Heading>
                    </HStack>

                    <Grid columns={{ minWidth: 320, max: 2 }} gap={4}>
                      {items.map((item) => (
                        <Card key={item.id} padding={4} variant="muted">
                          <VStack gap={2}>
                            <HStack hAlign="between" vAlign="center" gap={2}>
                              <Token
                                size="sm"
                                color={getCategoryColor(item.category)}
                                label={item.category}
                              />
                              <Code>{`FAQ #${item.id}`}</Code>
                            </HStack>
                            <Heading level={4}>{item.subject}</Heading>
                            <Text weight="medium">{item.question}</Text>
                            <Divider />
                            <Text type="supporting">{item.answer}</Text>
                          </VStack>
                        </Card>
                      ))}
                    </Grid>
                  </VStack>
                ))}
              </VStack>
            )}
          </VStack>
        )}
      </VStack>

      {/* Log Customer Query Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onOpenChange={(open) => {
          if (!createSubmitting) setIsCreateOpen(open);
        }}
        purpose="form"
        width={540}
      >
        <Layout
          header={
            <DialogHeader
              title="Log Customer Inquiry"
              subtitle="Record a customer question for Billing, Technical, Plan, or General support."
              onOpenChange={(open) => {
                if (!createSubmitting) setIsCreateOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Could not log inquiry"
                  error={createError}
                  onDismiss={() => setCreateError(null)}
                />
                <form id="create-query-form" onSubmit={handleCreateQuery}>
                  <FormLayout>
                    <TextInput
                      type="search"
                      label="Lookup Customer in Server Directory"
                      placeholder="Type CUS code, name, or phone to search all customers..."
                      startIcon={<Icon icon="search" />}
                      hasClear
                      value={customerLookupQuery}
                      onChange={setCustomerLookupQuery}
                      width="100%"
                    />

                    <Selector
                      label="Customer"
                      hasSearch
                      searchPlaceholder="Search customers..."
                      placeholder="Select subscriber..."
                      isRequired
                      options={customerOptions}
                      value={createCustomerId}
                      onChange={setCreateCustomerId}
                      width="100%"
                    />

                    <Selector
                      label="Category"
                      isRequired
                      options={QUERY_CATEGORY_FORM_OPTIONS}
                      value={createCategory}
                      onChange={(val) => setCreateCategory(val as CustomerQueryCategory)}
                      width="100%"
                    />

                    <TextInput
                      label="Subject"
                      placeholder="e.g. Service Tax Rate Inquiry"
                      value={createSubject}
                      onChange={setCreateSubject}
                      isRequired
                      width="100%"
                    />

                    <TextArea
                      label="Customer Question"
                      placeholder="Enter the subscriber's question..."
                      value={createQuestion}
                      onChange={setCreateQuestion}
                      rows={4}
                      maxLength={1000}
                      isRequired
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
                  isDisabled={createSubmitting}
                  onClick={() => setIsCreateOpen(false)}
                />
                <Button
                  type="submit"
                  form="create-query-form"
                  variant="primary"
                  label="Log Inquiry"
                  isLoading={createSubmitting}
                  isDisabled={createSubmitting}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* Answer & Promote to FAQ Dialog */}
      <Dialog
        isOpen={Boolean(answerTarget)}
        onOpenChange={(open) => {
          if (!answerSubmitting && !open) setAnswerTarget(null);
        }}
        purpose="form"
        width={560}
      >
        <Layout
          header={
            <DialogHeader
              title={
                answerTarget
                  ? `Respond to Inquiry #${answerTarget.id}`
                  : 'Respond to Inquiry'
              }
              subtitle="Provide an official answer and optionally publish to the public FAQ catalog."
              onOpenChange={(open) => {
                if (!answerSubmitting && !open) setAnswerTarget(null);
              }}
            />
          }
          content={
            <LayoutContent>
              {answerTarget && (
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not save answer"
                    error={answerError}
                    onDismiss={() => setAnswerError(null)}
                  />

                  <Card padding={4} variant="muted">
                    <MetadataList columns={2}>
                      <MetadataListItem label="Customer">
                        {answerTarget.customerName}
                      </MetadataListItem>
                      <MetadataListItem label="Category">
                        {answerTarget.category}
                      </MetadataListItem>
                      <MetadataListItem label="Subject">
                        {answerTarget.subject}
                      </MetadataListItem>
                      <MetadataListItem label="Question">
                        {answerTarget.question}
                      </MetadataListItem>
                    </MetadataList>
                  </Card>

                  <form id="answer-query-form" onSubmit={handleAnswerSubmit}>
                    <FormLayout>
                      <TextArea
                        label="Staff Answer"
                        placeholder="Enter the official answer..."
                        value={answerText}
                        onChange={setAnswerText}
                        rows={4}
                        maxLength={2000}
                        isRequired
                        width="100%"
                      />

                      <CheckboxInput
                        label="Publish to Dynamic FAQ Catalog"
                        description="Marks IsFaq = true so this Q&A appears in the public /api/faq catalog (without customer PII)."
                        value={answerIsFaq}
                        onChange={setAnswerIsFaq}
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
                  isDisabled={answerSubmitting}
                  onClick={() => setAnswerTarget(null)}
                />
                <Button
                  type="submit"
                  form="answer-query-form"
                  variant="primary"
                  label="Save Answer"
                  isLoading={answerSubmitting}
                  isDisabled={answerSubmitting}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* Close Inquiry Confirmation */}
      <AlertDialog
        isOpen={Boolean(closeTarget)}
        onOpenChange={(open) => {
          if (!closeSubmitting && !open) setCloseTarget(null);
        }}
        title={closeTarget ? `Close Inquiry #${closeTarget.id}?` : 'Close Inquiry?'}
        description={
          closeTarget
            ? `Closing "${closeTarget.subject}" marks it as Closed. Closed inquiries cannot be re-answered later, though any published FAQ item stays active.`
            : ''
        }
        actionLabel="Close Inquiry"
        actionVariant="destructive"
        isActionLoading={closeSubmitting}
        onAction={handleConfirmClose}
      />

      {/* Inquiry Detail Drawer */}
      <Drawer
        isOpen={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
        label={detailTarget ? `Inquiry #${detailTarget.id}` : 'Inquiry Details'}
        width={540}
      >
        <Layout
          header={
            <DrawerHeader
              title={detailTarget ? detailTarget.subject : 'Inquiry Details'}
              subtitle={
                detailTarget
                  ? `${detailTarget.customerName} · ${detailTarget.category}`
                  : undefined
              }
              endContent={detailTarget ? renderQueryStatus(detailTarget.status) : undefined}
              onOpenChange={(open) => {
                if (!open) setDetailTarget(null);
              }}
            />
          }
          content={
            <LayoutContent>
              {detailTarget && (
                <VStack gap={4}>
                  <MetadataList columns={2} title={<Heading level={4}>Inquiry Record</Heading>}>
                    <MetadataListItem label="Inquiry ID">
                      <Code>{`#${detailTarget.id}`}</Code>
                    </MetadataListItem>
                    <MetadataListItem label="Category">
                      <Token
                        size="sm"
                        color={getCategoryColor(detailTarget.category)}
                        label={detailTarget.category}
                      />
                    </MetadataListItem>
                    <MetadataListItem label="Customer">
                      {detailTarget.customerName}
                    </MetadataListItem>
                    <MetadataListItem label="FAQ Visibility">
                      <Token
                        size="sm"
                        color={detailTarget.isFaq ? 'green' : 'gray'}
                        label={detailTarget.isFaq ? 'Published in FAQ' : 'Internal Only'}
                      />
                    </MetadataListItem>
                    <MetadataListItem label="Created At">
                      <Timestamp value={detailTarget.createdAt} format="date_time" />
                    </MetadataListItem>
                    <MetadataListItem label="Answered At">
                      {detailTarget.answeredAt ? (
                        <Timestamp value={detailTarget.answeredAt} format="date_time" />
                      ) : (
                        'Not answered yet'
                      )}
                    </MetadataListItem>
                    <MetadataListItem label="Answered By">
                      {detailTarget.answeredByName || '—'}
                    </MetadataListItem>
                  </MetadataList>

                  <CollapsibleGroup type="multiple" defaultValue={['question', 'answer']}>
                    <VStack gap={2}>
                      <Card padding={3} variant="muted">
                        <Collapsible trigger="Customer Question" value="question">
                          <Text type="body">{detailTarget.question}</Text>
                        </Collapsible>
                      </Card>
                      <Card padding={3} variant="muted">
                        <Collapsible trigger="Official Answer" value="answer">
                          <Text type="body">
                            {detailTarget.answer || 'No official answer has been recorded yet.'}
                          </Text>
                        </Collapsible>
                      </Card>
                    </VStack>
                  </CollapsibleGroup>
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="between" gap={2} wrap="wrap">
                <HStack gap={2}>
                  {detailTarget && detailTarget.status !== 'Closed' && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        label={detailTarget.status === 'Answered' ? 'Edit Answer / FAQ' : 'Answer'}
                        onClick={() => openAnswerDialog(detailTarget)}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        label="Close Inquiry"
                        onClick={() => setCloseTarget(detailTarget)}
                      />
                    </>
                  )}
                </HStack>
                <Button
                  variant="ghost"
                  label="Done"
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
