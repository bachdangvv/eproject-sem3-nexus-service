import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
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
  ServiceTypeToken,
  formatUsd,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import {
  createBillingRecord,
  getBillingAccount,
  recordPayment,
} from '../../services/billingApi';
import { ApiError, type BillingView } from '../../types/nexus';
import { BillingAccountDrawer } from './BillingAccountDrawer';
import {
  BILLING_STATUS_FILTER_ITEMS,
  formatBillingError,
  normalizeAccountId,
  parseAccountIdMetadata,
  type BillingRow,
  type BillingSectionProps,
  type BillingStatusFilter,
} from './billingTypes';

export function BillingRegistrySection({
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

  const [statusFilter, setStatusFilter] = useState<BillingStatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<BillingView | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const drawerSeqRef = useRef(0);
  const generatingBillRef = useRef(false);
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

  useEffect(() => {
    onCountChange(records.length);
  }, [onCountChange, records.length]);

  const refreshAllRecords = useCallback(async () => {
    const current = recordsRef.current;
    if (current.length === 0) {
      onRefreshingChange(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    onRefreshingChange(true);
    setActionError(null);
    try {
      const settled = await Promise.allSettled(
        current.map((rec) => getBillingAccount(rec.accountId)),
      );
      if (!isMountedRef.current || seq !== requestSeqRef.current) return;
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
            ? `Failed to refresh session registry (${failures.length} of ${current.length} failed): ${detail}`
            : `Refreshed ${updated.length} of ${current.length} accounts; ${failures.length} failed (${first.accountId}): ${detail}`,
        );
      }
    } catch (err) {
      if (!isMountedRef.current || seq !== requestSeqRef.current) return;
      setActionError(
        formatBillingError(err, 'session accounts', 'Failed to refresh session registry.'),
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

  const summary = useMemo(() => {
    let notBilled = 0;
    let unpaid = 0;
    let paid = 0;
    for (const rec of records) {
      if (rec.status === 'NotBilled') notBilled += 1;
      else if (rec.status === 'Unpaid') unpaid += 1;
      else paid += 1;
    }
    return { total: records.length, notBilled, unpaid, paid };
  }, [records]);

  const filteredRows = useMemo<BillingRow[]>(() => {
    const needle = searchInput.trim().toLowerCase();
    return records
      .filter((rec) => {
        if (statusFilter !== 'ALL' && rec.status !== statusFilter) {
          return false;
        }
        if (!needle) return true;
        return (
          rec.accountId.toLowerCase().includes(needle) ||
          rec.orderId.toLowerCase().includes(needle) ||
          rec.customerName.toLowerCase().includes(needle) ||
          rec.planName.toLowerCase().includes(needle)
        );
      })
      .map((rec) => ({ ...rec }));
  }, [records, searchInput, statusFilter]);

  const pagination = useClientPagination(filteredRows, {
    resetKey: `${statusFilter}::${searchInput.trim().toLowerCase()}`,
  });

  const handleCreateBill = async (accountId: string) => {
    const normalized = normalizeAccountId(accountId);
    if (!normalized || generatingBillRef.current || processingPaymentRef.current) {
      return;
    }
    generatingBillRef.current = true;
    setBusyAccountId(normalized);
    setActionError(null);
    setDrawerError(null);

    try {
      const updated = await createBillingRecord(normalized);
      if (!isMountedRef.current) return;
      onRecordUpsert(updated);
      setDrawerRecord((prev) =>
        prev && prev.accountId === updated.accountId ? updated : prev,
      );
      toast({
        body: `Created billing record for ${updated.accountId} (${formatUsd(updated.amount)}, Unpaid).`,
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg = formatBillingError(
        err,
        normalized,
        `Could not create billing record for ${normalized}.`,
      );
      setActionError(msg);
      if (drawerOpen) {
        setDrawerError(msg);
      }
    } finally {
      generatingBillRef.current = false;
      if (isMountedRef.current) {
        setBusyAccountId(null);
      }
    }
  };

  const handleRecordPayment = async (accountId: string) => {
    const normalized = normalizeAccountId(accountId);
    if (!normalized || processingPaymentRef.current || generatingBillRef.current) {
      return;
    }
    processingPaymentRef.current = true;
    setBusyAccountId(normalized);
    setActionError(null);
    setDrawerError(null);

    try {
      const updated = await recordPayment(normalized);
      if (!isMountedRef.current) return;
      onRecordUpsert(updated);
      setDrawerRecord((prev) =>
        prev && prev.accountId === updated.accountId ? updated : prev,
      );
      toast({
        body: `Recorded full payment of ${formatUsd(updated.amount)} for ${updated.accountId}.`,
      });
    } catch (err) {
      if (!isMountedRef.current) return;
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
    } finally {
      processingPaymentRef.current = false;
      if (isMountedRef.current) {
        setBusyAccountId(null);
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
      width: pixel(235),
      renderCell: (row) => <CopyableId value={row.accountId} label="Account ID" />,
    },
    {
      key: 'orderId',
      header: 'Order ID',
      width: pixel(190),
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
      width: proportional(1.4, { minWidth: 155 }),
      renderCell: (row) => {
        const meta = parseAccountIdMetadata(row.accountId);
        return (
          <VStack gap={1}>
            <Text type="body">{row.planName}</Text>
            {meta ? <ServiceTypeToken type={meta.serviceType} /> : null}
          </VStack>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      width: pixel(110),
      align: 'end',
      renderCell: (row) => <Text weight="semibold">{formatUsd(row.amount)}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(135),
      renderCell: (row) => <BillingStatusPill status={row.status} />,
    },
    {
      key: 'paidAt',
      header: 'Paid At (UTC)',
      width: pixel(195),
      renderCell: (row) =>
        row.paidAt ? (
          <Timestamp value={row.paidAt} format="date_time" timezoneID="UTC" isTimezoneShown />
        ) : (
          <Text type="supporting">Not yet paid</Text>
        ),
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
          {row.status === 'NotBilled' ? (
            <Button
              size="sm"
              variant="primary"
              label="Create Bill"
              isLoading={busyAccountId === row.accountId}
              isDisabled={busyAccountId !== null}
              onClick={() => void handleCreateBill(row.accountId)}
            />
          ) : row.status === 'Unpaid' ? (
            <Button
              size="sm"
              variant="primary"
              label="Record Payment"
              isLoading={busyAccountId === row.accountId}
              isDisabled={busyAccountId !== null}
              onClick={() => void handleRecordPayment(row.accountId)}
            />
          ) : (
            <Button
              size="sm"
              variant="ghost"
              label="Lookup"
              onClick={() => {
                onSelectAccount(row.accountId);
                navigate(RoutePath.BILLING_ACCOUNTS);
              }}
            />
          )}
        </HStack>
      ),
    },
  ];

  return (
    <VStack gap={5}>
      <Grid columns={{ minWidth: 180, max: 4 }} gap={4}>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Tracked Accounts</Text>
            <Heading level={2}>{summary.total}</Heading>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Not Billed</Text>
            <Heading level={2}>{summary.notBilled}</Heading>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Unpaid</Text>
            <Heading level={2}>{summary.unpaid}</Heading>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Paid</Text>
            <Heading level={2}>{summary.paid}</Heading>
          </VStack>
        </Card>
      </Grid>

      <Card padding={6}>
        <VStack gap={5}>
          <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
            <HStack gap={3} vAlign="end" wrap="wrap">
              <Selector
                label="Billing Status"
                options={BILLING_STATUS_FILTER_ITEMS}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as BillingStatusFilter)}
                width={200}
              />
              <Badge variant="neutral" label={`${filteredRows.length} total`} />
            </HStack>

            <TextInput
              type="search"
              label="Filter Session Registry"
              placeholder="Filter by Account ID, Order ID, customer, or plan..."
              startIcon={<Icon icon="search" />}
              hasClear
              width={340}
              value={searchInput}
              onChange={setSearchInput}
            />
          </HStack>

          <ApiErrorBanner
            title="Registry action failed"
            error={actionError}
            onDismiss={() => setActionError(null)}
          />

          <Table<BillingRow>
            aria-label="Billing Session Accounts Registry"
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
                title={
                  records.length === 0
                    ? 'No accounts inspected in this session'
                    : 'No matching billing accounts'
                }
                description={
                  records.length === 0
                    ? 'Look up a connected 16-character Account ID in Account Lookup to add it to this session registry.'
                    : 'Try clearing the search query or switching the billing status filter to All Statuses.'
                }
                icon={<Icon icon="info" />}
                actions={
                  records.length === 0 ? (
                    <Button
                      variant="primary"
                      label="Go to Account Lookup"
                      onClick={() => navigate(RoutePath.BILLING_ACCOUNTS)}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      label="Reset Filters"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setSearchInput('');
                      }}
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
            label="Billing session registry pagination"
          />
        </VStack>
      </Card>

      <BillingAccountDrawer
        record={drawerRecord}
        citiesByCode={citiesByCode}
        isOpen={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        isLoading={drawerLoading}
        actionLoading={busyAccountId !== null}
        error={drawerError}
        onDismissError={() => setDrawerError(null)}
        onRefresh={(id) => void handleRefreshDrawer(id)}
        onCreateBill={(id) => void handleCreateBill(id)}
        onRecordPayment={(id) => void handleRecordPayment(id)}
      />
    </VStack>
  );
}
