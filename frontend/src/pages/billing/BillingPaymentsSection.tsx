/**
 * Billing unpaid and partially paid invoice collection queue section.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type JSX,
} from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  BillingStatusPill,
  CopyableId,
  formatUsd,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import { getBillingAccount, recordPayment } from '../../services/billingApi';
import {
  ApiError,
  type BillingView,
  type RecordPaymentInput,
} from '../../types/nexus';
import { BillingAccountDrawer } from './BillingAccountDrawer';
import {
  computeCollectedAmount,
  formatBillingError,
  isValidAccountId,
  normalizeAccountId,
  type BillingRow,
  type BillingSectionProps,
} from './billingTypes';

export function BillingPaymentsSection({
  records,
  citiesByCode,
  refreshTrigger,
  onRecordUpsert,
  onBatchRefresh,
  onSelectAccount,
  onCountChange,
  onRefreshingChange,
}: BillingSectionProps): JSX.Element {
  const toast = useToast();
  const { navigate } = useRouter();

  const [quickAccountInput, setQuickAccountInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payingAccountId, setPayingAccountId] = useState<string | null>(null);
  const [lastPaymentNotice, setLastPaymentNotice] = useState<{
    record: BillingView;
    collectedAmount: number;
  } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<BillingView | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const batchSeqRef = useRef(0);
  const drawerSeqRef = useRef(0);
  const processingPaymentRef = useRef(false);
  const hasMountedRefreshRef = useRef(false);
  const recordsRef = useRef(records);

  useLayoutEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const unpaidRows = useMemo<BillingRow[]>(
    () =>
      records
        .filter((rec) => rec.status === 'Unpaid' || rec.status === 'PartiallyPaid')
        .map((rec) => ({ ...rec })),
    [records],
  );
  const pagination = useClientPagination(unpaidRows);

  useEffect(() => {
    onCountChange(unpaidRows.length);
  }, [onCountChange, unpaidRows.length]);

  const refreshAllRecords = useCallback(async () => {
    const current = recordsRef.current;
    if (current.length === 0) {
      onRefreshingChange(false);
      return;
    }
    const seq = ++batchSeqRef.current;
    onRefreshingChange(true);
    setActionError(null);
    try {
      const settled = await Promise.allSettled(
        current.map((rec) => getBillingAccount(rec.accountId)),
      );
      if (!isMountedRef.current || seq !== batchSeqRef.current) return;
      const updated: BillingView[] = [];
      const failures: Array<{ accountId: string; reason: unknown }> = [];
      settled.forEach((item, index) => {
        if (item.status === 'fulfilled') {
          updated.push(item.value);
        } else {
          failures.push({
            accountId: current[index]?.accountId ?? 'session accounts',
            reason: item.reason,
          });
        }
      });
      if (updated.length > 0) {
        onBatchRefresh(updated);
        setDrawerRecord((prev) => {
          if (!prev) return prev;
          return updated.find((item) => item.accountId === prev.accountId) ?? prev;
        });
      }
      if (failures.length > 0) {
        const first = failures[0];
        const detail = formatBillingError(
          first.reason,
          first.accountId,
          'Failed to refresh account status.',
        );
        setActionError(
          failures.length === current.length
            ? `Failed to refresh payment queue (${failures.length} of ${current.length} failed): ${detail}`
            : `Refreshed ${updated.length} of ${current.length} accounts; ${failures.length} failed (${first.accountId}): ${detail}`,
        );
      }
    } catch (err) {
      if (!isMountedRef.current || seq !== batchSeqRef.current) return;
      setActionError(
        formatBillingError(err, 'session accounts', 'Failed to refresh payment queue.'),
      );
    } finally {
      if (isMountedRef.current) {
        onRefreshingChange(false);
      }
    }
  }, [onBatchRefresh, onRefreshingChange]);

  useEffect(() => {
    if (!hasMountedRefreshRef.current) {
      hasMountedRefreshRef.current = true;
      return;
    }
    if (refreshTrigger <= 0) return;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled && isMountedRef.current) {
        return refreshAllRecords();
      }
      return undefined;
    });

    return () => {
      cancelled = true;
    };
  }, [refreshAllRecords, refreshTrigger]);

  const handleQuickLookupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeAccountId(quickAccountInput);
    if (!normalized) {
      setInputError('Enter a 16-character Account ID (e.g. B101000000000001).');
      return;
    }
    setQuickAccountInput(normalized);
    if (!isValidAccountId(normalized)) {
      setInputError(
        'Account ID must be 16 characters: D, B, or T followed by 15 digits.',
      );
      return;
    }

    const seq = ++requestSeqRef.current;
    setInputError(null);
    setActionError(null);
    setLookupLoading(true);
    try {
      const account = await getBillingAccount(normalized);
      if (!isMountedRef.current || seq !== requestSeqRef.current) return;
      onRecordUpsert(account);
      onSelectAccount(account.accountId);
      if (account.status !== 'Unpaid' && account.status !== 'PartiallyPaid') {
        setDrawerRecord(account);
        setDrawerError(null);
        setDrawerLoading(false);
        setDrawerOpen(true);
      }
    } catch (err) {
      if (!isMountedRef.current || seq !== requestSeqRef.current) return;
      setActionError(
        formatBillingError(err, normalized, `Could not look up Account ID ${normalized}.`),
      );
    } finally {
      if (isMountedRef.current && seq === requestSeqRef.current) {
        setLookupLoading(false);
      }
    }
  };

  const handleRecordPayment = async (accountId: string, input?: RecordPaymentInput) => {
    const normalized = normalizeAccountId(accountId);
    if (
      !normalized ||
      processingPaymentRef.current ||
      payingAccountId !== null
    ) {
      return false;
    }
    const prevRecord =
      recordsRef.current.find((r) => r.accountId === normalized) ??
      (drawerRecord?.accountId === normalized ? drawerRecord : null);
    processingPaymentRef.current = true;
    setPayingAccountId(normalized);
    setActionError(null);
    setDrawerError(null);

    try {
      const updated = await recordPayment(normalized, input);
      if (!isMountedRef.current) return false;
      onRecordUpsert(updated);
      const collectedAmount = computeCollectedAmount(prevRecord, updated, input?.amount);
      setLastPaymentNotice({ record: updated, collectedAmount });
      setDrawerRecord((prev) =>
        prev && prev.accountId === updated.accountId ? updated : prev,
      );
      toast({
        body: `Recorded payment of ${formatUsd(collectedAmount)} for ${updated.accountId}${
          updated.status === 'PartiallyPaid'
            ? ` (${formatUsd(updated.dueAmount ?? 0)} remaining)`
            : ''
        }.`,
      });
      return true;
    } catch (err) {
      if (!isMountedRef.current) return false;
      const msg = formatBillingError(
        err,
        normalized,
        `Could not record payment for ${normalized}.`,
      );
      setActionError(msg);
      if (drawerOpen) {
        setDrawerError(msg);
      }
      if (err instanceof ApiError && err.status === 409) {
        void getBillingAccount(normalized)
          .then((fresh) => {
            if (!isMountedRef.current) return;
            onRecordUpsert(fresh);
            setDrawerRecord((prev) =>
              prev && prev.accountId === fresh.accountId ? fresh : prev,
            );
          })
          .catch(() => { });
      }
      return false;
    } finally {
      processingPaymentRef.current = false;
      if (isMountedRef.current) {
        setPayingAccountId(null);
      }
    }
  };

  const handleOpenDrawer = (record: BillingView) => {
    drawerSeqRef.current += 1;
    setDrawerRecord(record);
    setDrawerError(null);
    setDrawerLoading(false);
    setDrawerOpen(true);
  };

  const handleRefreshDrawer = async (accountId: string) => {
    const normalized = normalizeAccountId(accountId);
    if (!normalized) return;
    const seq = ++drawerSeqRef.current;
    setDrawerLoading(true);
    setDrawerError(null);
    try {
      const fresh = await getBillingAccount(normalized);
      if (!isMountedRef.current || seq !== drawerSeqRef.current) return;
      setDrawerRecord(fresh);
      onRecordUpsert(fresh);
    } catch (err) {
      if (!isMountedRef.current || seq !== drawerSeqRef.current) return;
      setDrawerError(
        formatBillingError(err, normalized, `Could not refresh account ${normalized}.`),
      );
    } finally {
      if (isMountedRef.current && seq === drawerSeqRef.current) {
        setDrawerLoading(false);
      }
    }
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      drawerSeqRef.current += 1;
      setDrawerLoading(false);
    }
  };

  const columns: TableColumn<BillingRow>[] = [
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(245),
      renderCell: (row) => <CopyableId value={row.accountId} label="Account ID" />,
    },
    {
      key: 'orderId',
      header: 'Order ID',
      width: pixel(205),
      renderCell: (row) => <CopyableId value={row.orderId} label="Order ID" />,
    },
    {
      key: 'customerName',
      header: 'Customer',
      width: proportional(1.4, { minWidth: 150 }),
      renderCell: (row) => <Text weight="semibold">{row.customerName}</Text>,
    },
    {
      key: 'planName',
      header: 'Service Plan',
      width: proportional(1.4, { minWidth: 150 }),
      renderCell: (row) => <Text type="body">{row.planName}</Text>,
    },
    {
      key: 'amount',
      header: 'Amount Due',
      width: pixel(120),
      align: 'end',
      renderCell: (row) => (
        <Text weight="semibold">
          {formatUsd(row.dueAmount ?? (row.status === 'Paid' ? 0 : row.amount))}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(130),
      renderCell: (row) => <BillingStatusPill status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(235),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={2} hAlign="end" wrap="nowrap">
          <Button
            size="sm"
            variant="secondary"
            label="View"
            onClick={() => handleOpenDrawer(row)}
          />
          <Button
            size="sm"
            variant="primary"
            label="Record Payment"
            isLoading={payingAccountId === row.accountId}
            isDisabled={payingAccountId !== null}
            onClick={() => void handleRecordPayment(row.accountId)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <Card padding={6}>
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Pending Payments Queue</Heading>
              <Badge variant="neutral" label={`${unpaidRows.length} pending`} />
            </HStack>
            <Text type="supporting">
              Pull up an Account ID or settle pending Unpaid and Partially Paid billing records.
            </Text>
          </VStack>

          <form onSubmit={(e) => void handleQuickLookupSubmit(e)}>
            <HStack gap={2} vAlign="end" wrap="wrap">
              <TextInput
                type="search"
                label="Quick Account Lookup"
                placeholder="e.g. B101000000000001"
                startIcon={<Icon icon="search" />}
                hasClear
                width={280}
                value={quickAccountInput}
                onChange={(val) => {
                  setQuickAccountInput(val);
                  if (inputError) setInputError(null);
                }}
                status={inputError ? { type: 'error', message: inputError } : undefined}
              />
              <Button
                type="submit"
                variant="secondary"
                label="Look Up Account"
                isLoading={lookupLoading}
                isDisabled={lookupLoading}
              />
            </HStack>
          </form>
        </HStack>

        {lastPaymentNotice ? (
          <Banner
            status="success"
            container="card"
            collapsible={false}
            isDismissable
            onDismiss={() => setLastPaymentNotice(null)}
            title={`Payment ${lastPaymentNotice.record.status === 'Paid' ? 'Settled' : 'Recorded'} - ${lastPaymentNotice.record.accountId}`}
            description={`Recorded ${lastPaymentNotice.record.status === 'Paid' ? 'full' : 'partial'} manual payment of ${formatUsd(lastPaymentNotice.collectedAmount)} for ${lastPaymentNotice.record.customerName}.${
              lastPaymentNotice.record.status === 'PartiallyPaid'
                ? ` Remaining balance: ${formatUsd(lastPaymentNotice.record.dueAmount ?? 0)}.`
                : ''
            }`}
            endContent={
              lastPaymentNotice.record.paidAt ? (
                <Timestamp
                  value={lastPaymentNotice.record.paidAt}
                  format="date_time"
                  timezoneID="UTC"
                  isTimezoneShown
                />
              ) : undefined
            }
          />
        ) : null}

        <ApiErrorBanner
          title="Payment action failed"
          error={actionError}
          onDismiss={() => setActionError(null)}
        />

        <Table<BillingRow>
          aria-label="Unpaid Billing Accounts Queue"
          density="compact"
          dividers="rows"
          hasHover
          idKey="accountId"
          columns={columns}
          data={pagination.paginatedItems}
          rowIndexStart={pagination.rowIndexStart}
          rowCount={pagination.totalItems}
          emptyState={
            <EmptyState
              title="No pending unpaid accounts"
              description="Look up a billed Unpaid or Partially Paid Account ID above or return to Account Lookup to generate a new billing record."
              icon={<Icon icon="check" />}
              actions={
                <Button
                  variant="secondary"
                  label="Go to Account Lookup"
                  onClick={() => navigate(RoutePath.BILLING_ACCOUNTS)}
                />
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
          label="Pending billing accounts pagination"
        />
      </VStack>

      <BillingAccountDrawer
        record={drawerRecord}
        citiesByCode={citiesByCode}
        isOpen={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        isLoading={drawerLoading}
        actionLoading={payingAccountId !== null}
        error={drawerError}
        onDismissError={() => setDrawerError(null)}
        onRefresh={(id) => void handleRefreshDrawer(id)}
        onRecordPayment={handleRecordPayment}
      />
    </Card>
  );
}
