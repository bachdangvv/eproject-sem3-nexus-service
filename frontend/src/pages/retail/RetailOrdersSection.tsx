import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
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
import { getOrderDetail, getOrders, submitFeedback } from '../../services/operationsApi';
import type { OrderDetailView, OrderView } from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  FEEDBACK_RATING_OPTIONS,
  isValidOrderCode,
  ORDER_STATUS_FILTER_ITEMS,
  type OrderRow,
  type OrderStatusFilter,
  type RetailSectionProps,
} from './retailTypes';

interface FeedbackFieldErrors {
  rating?: string;
  comment?: string;
}

export function RetailOrdersSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: RetailSectionProps): JSX.Element {
  const toast = useToast();

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

  const [feedbackOrder, setFeedbackOrder] = useState<OrderView | null>(null);
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackFieldErrors, setFeedbackFieldErrors] = useState<FeedbackFieldErrors>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const submittingFeedbackRef = useRef(false);

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
        setLoadError(extractErrorMessage(err, 'Failed to load retail orders.'));
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

  const openFeedbackDialog = (order: OrderView) => {
    if (order.status !== 'Connected') return;
    setFeedbackOrder(order);
    setFeedbackRating('5');
    setFeedbackComment('');
    setFeedbackFieldErrors({});
    setFeedbackError(null);
  };

  const handleFeedbackSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingFeedbackRef.current || submittingFeedback || !feedbackOrder) return;

    const errors: FeedbackFieldErrors = {};
    const parsedRating = Number(feedbackRating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      errors.rating = 'Select a rating between 1 and 5.';
    }

    const trimmedComment = feedbackComment.trim();
    if (!trimmedComment) {
      errors.comment = 'Feedback comment is required.';
    } else if (trimmedComment.length > 600) {
      errors.comment = 'Feedback comment must be 600 characters or fewer.';
    }

    setFeedbackFieldErrors(errors);
    setFeedbackError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const targetCode = feedbackOrder.code;
    submittingFeedbackRef.current = true;
    setSubmittingFeedback(true);
    try {
      await submitFeedback(targetCode, {
        rating: parsedRating,
        comment: trimmedComment,
      });
      if (!isMountedRef.current) return;
      setFeedbackOrder(null);
      toast({
        body: `Recorded ${parsedRating}/5 feedback for order ${targetCode}.`,
      });
      if (detailOpen && orderDetail?.order.code === targetCode) {
        void handleOpenDetail(targetCode);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setFeedbackFieldErrors((prev) => ({
        ...prev,
        rating: serverFields.rating ?? prev.rating,
        comment: serverFields.comment ?? prev.comment,
      }));
      setFeedbackError(extractErrorMessage(err, 'Could not record customer feedback.'));
    } finally {
      submittingFeedbackRef.current = false;
      if (isMountedRef.current) {
        setSubmittingFeedback(false);
      }
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
      width: proportional(1.5, { minWidth: 120 }),
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
      width: proportional(1.3, { minWidth: 120 }),
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
      width: pixel(148),
      renderCell: (row) => <Timestamp value={row.createdAt} format="date_time" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(180),
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
            label="Feedback"
            isDisabled={row.status !== 'Connected'}
            tooltip={
              row.status !== 'Connected'
                ? 'Feedback can only be recorded after the order is Connected.'
                : undefined
            }
            onClick={() => openFeedbackDialog(row)}
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
            <SegmentedControl
              label="Filter orders by status"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as OrderStatusFilter)}
            >
              {ORDER_STATUS_FILTER_ITEMS.map((item) => (
                <SegmentedControlItem
                  key={item.value}
                  value={item.value}
                  label={item.label}
                />
              ))}
            </SegmentedControl>
            <Badge variant="neutral" label={`${filteredOrders.length} total`} />
          </HStack>

          <TextInput
            type="search"
            label="Search Orders"
            placeholder="Filter by Order ID, customer, plan, or Account ID..."
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
              <Text type="supporting">Loading retail service orders...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<OrderRow>
              aria-label="Retail Service Orders"
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
                      : 'No confirmed orders have been placed yet. Confirm a service request to generate an Order ID.'
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
              label="Retail orders pagination"
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
        isOpen={feedbackOrder !== null}
        onOpenChange={(open) => {
          if (!open && !submittingFeedback) setFeedbackOrder(null);
        }}
        purpose="form"
        width={520}
      >
        <Layout
          header={
            <DialogHeader
              title={
                feedbackOrder ? `Record Feedback · ${feedbackOrder.code}` : 'Record Feedback'
              }
              subtitle={
                feedbackOrder
                  ? `${feedbackOrder.request.customerName} — ${feedbackOrder.request.planName}`
                  : 'Submit customer rating and comments for a Connected order.'
              }
              onOpenChange={(open) => {
                if (!open && !submittingFeedback) setFeedbackOrder(null);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Could not submit feedback"
                  error={feedbackError}
                  onDismiss={() => setFeedbackError(null)}
                />

                <form id="record-feedback-form" onSubmit={(e) => void handleFeedbackSubmit(e)}>
                  <FormLayout>
                    <RadioList
                      orientation="horizontal"
                      label="Customer Satisfaction Rating (1–5)"
                      description="1 = Poor, 2 = Fair, 3 = Good, 4 = Very Good, 5 = Excellent"
                      isRequired
                      value={feedbackRating}
                      onChange={(value) => {
                        setFeedbackRating(value);
                        setFeedbackFieldErrors((prev) => ({ ...prev, rating: undefined }));
                      }}
                      status={
                        feedbackFieldErrors.rating
                          ? { type: 'error', message: feedbackFieldErrors.rating }
                          : undefined
                      }
                    >
                      {FEEDBACK_RATING_OPTIONS.map((option) => (
                        <RadioListItem
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        />
                      ))}
                    </RadioList>

                    <TextArea
                      label="Feedback Comment"
                      placeholder="Summarize customer satisfaction with installation, connection stability, and service..."
                      isRequired
                      rows={4}
                      maxLength={600}
                      value={feedbackComment}
                      onChange={(value) => {
                        setFeedbackComment(value);
                        setFeedbackFieldErrors((prev) => ({ ...prev, comment: undefined }));
                      }}
                      status={
                        feedbackFieldErrors.comment
                          ? { type: 'error', message: feedbackFieldErrors.comment }
                          : feedbackComment.trim().length > 600
                            ? {
                              type: 'error',
                              message: 'Feedback comment must be 600 characters or fewer.',
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
                  isDisabled={submittingFeedback}
                  onClick={() => setFeedbackOrder(null)}
                />
                <Button
                  type="submit"
                  form="record-feedback-form"
                  variant="primary"
                  label="Submit Feedback"
                  isLoading={submittingFeedback}
                  isDisabled={submittingFeedback}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </Card>
  );
}
