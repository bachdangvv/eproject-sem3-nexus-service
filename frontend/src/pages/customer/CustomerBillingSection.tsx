/**
 * Customer connections lifecycle, itemized invoices, and online invoice payment (/customer/billing).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
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
  BillingStatusPill,
  CopyableId,
  OrderStatusPill,
  ServiceTypeToken,
  StatusLabel,
  formatUsd,
  lastPaymentAt,
} from '../../components/StatusViews';
import { PaymentHistory } from '../shared/PaymentHistory';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { getBilling, getConnections, getProfile, payBillingOnline } from '../../services/customerApi';
import { getPublicCities } from '../../services/publicApi';
import type {
  BillingStatus,
  BillingView,
  CityView,
  ConnectionLifecycleView,
  CustomerProfileView,
} from '../../types/nexus';
import {
  extractErrorMessage,
  formatCityDisplay,
  validatePositiveCurrency,
  type BillingRow,
  type ConnectionRow,
  type CustomerSectionProps,
  type InvoiceRow,
} from './customerTypes';

type BillingFilter = 'ALL' | BillingStatus;

function getRefundColor(status?: string | null): TokenColor {
  switch (status) {
    case 'Refunded':
    case 'Processed':
      return 'green';
    case 'Pending':
      return 'yellow';
    case 'Forfeited':
      return 'red';
    default:
      return 'gray';
  }
}

function renderInvoiceStatus(status: string): JSX.Element {
  if (
    status === 'Paid' ||
    status === 'PartiallyPaid' ||
    status === 'Unpaid' ||
    status === 'NotBilled'
  ) {
    return <BillingStatusPill status={status as BillingStatus} />;
  }
  if (status === 'RolledOver') {
    return <StatusLabel variant="neutral" label="Rolled Over" />;
  }
  return <StatusLabel variant="neutral" label={status} />;
}

export function CustomerBillingSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: CustomerSectionProps): JSX.Element {
  const toast = useToast();

  const [connections, setConnections] = useState<ConnectionLifecycleView[]>([]);
  const [billingAccounts, setBillingAccounts] = useState<BillingView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);
  const [profile, setProfile] = useState<CustomerProfileView | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<BillingFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Billing Account Drawer state
  const [drawerRecord, setDrawerRecord] = useState<BillingView | null>(null);

  // Online Payment Dialog state
  const [payTarget, setPayTarget] = useState<BillingView | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAmountError, setPayAmountError] = useState<string | null>(null);
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

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
        const [connList, billList, cityList, profileData] = await Promise.all([
          getConnections(),
          getBilling(),
          getPublicCities(),
          getProfile(),
        ]);
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setConnections(connList);
        setBillingAccounts(billList);
        setCities(cityList);
        setProfile(profileData);
        onCountChange(billList.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load connections and billing accounts.'));
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

  const summary = useMemo(() => {
    const activeCount = connections.filter((c) => c.status === 'Active').length;
    const inactiveCount = connections.filter((c) => c.status !== 'Active').length;
    const totalDue = billingAccounts.reduce((acc, b) => acc + (b.dueAmount ?? 0), 0);
    const settledCount = billingAccounts.filter((b) => b.status === 'Paid').length;
    return { activeCount, inactiveCount, totalDue, settledCount };
  }, [billingAccounts, connections]);

  const connectionRows = useMemo<ConnectionRow[]>(
    () => connections.map((c) => ({ ...c })),
    [connections],
  );
  const connPagination = useClientPagination(connectionRows);

  const filteredBilling = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return billingAccounts.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        b.accountId.toLowerCase().includes(q) ||
        b.orderId.toLowerCase().includes(q) ||
        b.planName.toLowerCase().includes(q)
      );
    });
  }, [billingAccounts, searchQuery, statusFilter]);

  const billingRows = useMemo<BillingRow[]>(
    () => filteredBilling.map((b) => ({ ...b })),
    [filteredBilling],
  );
  const billingPagination = useClientPagination(billingRows, {
    resetKey: `${statusFilter}::${searchQuery.trim()}`,
  });

  const drawerInvoiceRows = useMemo<InvoiceRow[]>(
    () => (drawerRecord?.invoices ?? []).map((inv) => ({ ...inv })),
    [drawerRecord?.invoices],
  );
  const invoicePagination = useClientPagination(drawerInvoiceRows, {
    resetKey: drawerRecord?.accountId ?? '',
  });

  const openPayDialog = (record: BillingView) => {
    const due = record.dueAmount ?? (record.status === 'Paid' ? 0 : record.amount);
    setPayTarget(record);
    setPayAmount(due > 0 ? due.toFixed(2) : '');
    setPayAmountError(null);
    setPayNote('');
    setPayError(null);
  };

  const handlePaySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payTarget || paying) return;
    setPayError(null);

    const { value: parsedAmount, error: validationError } = validatePositiveCurrency(payAmount);
    if (validationError || parsedAmount === null) {
      setPayAmountError(validationError ?? 'Enter a valid positive payment amount.');
      return;
    }
    setPayAmountError(null);
    setPaying(true);
    try {
      const updated = await payBillingOnline(payTarget.accountId, {
        invoiceId: payTarget.invoiceId ?? null,
        amount: parsedAmount,
        note: payNote.trim() || null,
      });
      if (!isMountedRef.current) return;
      const prevDue = payTarget.dueAmount ?? 0;
      const nextDue = updated.dueAmount ?? 0;
      const collected = Math.max(0, prevDue - nextDue) || parsedAmount;
      setBillingAccounts((prev) =>
        prev.map((b) => (b.accountId === updated.accountId ? updated : b)),
      );
      if (drawerRecord?.accountId === updated.accountId) {
        setDrawerRecord(updated);
      }
      setPayTarget(null);
      toast({
        body: `Online payment of ${formatUsd(collected)} recorded for account ${updated.accountId}.`,
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setPayError(extractErrorMessage(err, 'Online payment could not be processed.'));
    } finally {
      if (isMountedRef.current) {
        setPaying(false);
      }
    }
  };

  const connectionColumns: TableColumn<ConnectionRow>[] = [
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(245),
      renderCell: (c) => <CopyableId value={c.accountId} label="Account ID" />,
    },
    {
      key: 'plan',
      header: 'Plan & City',
      width: proportional(1.5, { minWidth: 190 }),
      renderCell: (c) => (
        <VStack gap={1}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{c.planName}</Text>
            <ServiceTypeToken type={c.type} />
          </HStack>
          <Text type="supporting">
            Order #{c.orderId} · {formatCityDisplay(c.cityCode, cities)}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Lifecycle Status',
      width: pixel(175),
      renderCell: (c) => <OrderStatusPill status={c.status} />,
    },
    {
      key: 'details',
      header: 'Lifecycle Notes',
      width: proportional(1.3, { minWidth: 160 }),
      renderCell: (c) =>
        c.status === 'TemporarilyInactive' ? (
          <Text type="supporting">{c.suspendReason || 'Temporarily suspended'}</Text>
        ) : c.status === 'PermanentlyInactive' ? (
          <Text type="supporting">
            Terminated {c.terminatedAt ? c.terminatedAt.slice(0, 10) : ''}
          </Text>
        ) : (
          <Text type="supporting">
            Activated <Timestamp value={c.activatedAt} format="date" />
          </Text>
        ),
    },
    {
      key: 'refund',
      header: 'Deposit Refund',
      width: pixel(175),
      renderCell: (c) => (
        <HStack gap={1.5} vAlign="center" wrap="wrap">
          <Token
            size="sm"
            color={getRefundColor(c.refundStatus)}
            label={c.refundStatus || 'None'}
          />
          {(c.refundAmount ?? 0) > 0 && (
            <Text weight="semibold" hasTabularNumbers>
              {formatUsd(c.refundAmount ?? 0)}
            </Text>
          )}
        </HStack>
      ),
    },
  ];

  const billingColumns: TableColumn<BillingRow>[] = [
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(245),
      renderCell: (b) => <CopyableId value={b.accountId} label="Account ID" />,
    },
    {
      key: 'plan',
      header: 'Order & Plan',
      width: proportional(1.5, { minWidth: 190 }),
      renderCell: (b) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{b.planName}</Text>
          <Text type="supporting">
            Order {b.orderId} ·{' '}
            {b.connectionCount && b.connectionCount > 1
              ? `${b.connectionCount} lines (Bulk)`
              : '1 line'}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'total',
      header: 'Total Invoiced',
      width: pixel(120),
      renderCell: (b) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatUsd(b.totalAmount ?? b.amount)}
        </Text>
      ),
    },
    {
      key: 'due',
      header: 'Balance Due',
      width: pixel(120),
      renderCell: (b) => (
        <Text weight="bold" hasTabularNumbers>
          {formatUsd(b.dueAmount ?? (b.status === 'Paid' ? 0 : b.amount))}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Billing Status',
      width: pixel(145),
      renderCell: (b) => <BillingStatusPill status={b.status} />,
    },
    {
      key: 'paidAt',
      header: 'Last Payment',
      width: pixel(135),
      renderCell: (b) => {
        const at = lastPaymentAt(b);
        return at ? (
          <Timestamp value={at} format="date" />
        ) : (
          <Text type="supporting">No payments</Text>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(210),
      align: 'end',
      renderCell: (b) => {
        const canPay = b.status === 'Unpaid' || b.status === 'PartiallyPaid';
        return (
          <HStack gap={2} hAlign="end" wrap="nowrap">
            <Button
              size="sm"
              variant="secondary"
              label="View Invoices"
              onClick={() => setDrawerRecord(b)}
            />
            {canPay && (
              <Button
                size="sm"
                variant="primary"
                label="Pay Online"
                isDisabled={isSuspended}
                onClick={() => openPayDialog(b)}
              />
            )}
          </HStack>
        );
      },
    },
  ];

  const invoiceColumns: TableColumn<InvoiceRow>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      width: pixel(145),
      renderCell: (inv) => <Code>{inv.invoiceNumber}</Code>,
    },
    {
      key: 'period',
      header: 'Period',
      width: pixel(175),
      renderCell: (inv) => (
        <Text type="supporting">
          <Timestamp value={inv.billingPeriodStart} format="date" />
          {' - '}
          <Timestamp value={inv.billingPeriodEnd} format="date" />
        </Text>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      width: pixel(95),
      align: 'end',
      renderCell: (inv) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatUsd(inv.totalAmount)}
        </Text>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      width: pixel(95),
      align: 'end',
      renderCell: (inv) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatUsd(inv.dueAmount)}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(135),
      renderCell: (inv) => renderInvoiceStatus(inv.status),
    },
  ];


  return (
    <VStack gap={5}>
      <ApiErrorBanner
        title="Failed to load billing records"
        error={loadError}
        onDismiss={() => setLoadError(null)}
      />

      {isSuspended && (
        <Banner
          status="warning"
          container="card"
          collapsible={false}
          title="Account Suspended"
          description="Your account is suspended. Online invoice payments are blocked until an administrator reactivates your account."
        />
      )}

      <Grid columns={{ minWidth: 200, max: 4 }} gap={4}>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="eyebrow">Active Connections</Text>
            <Heading level={2}>{summary.activeCount}</Heading>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="eyebrow">Suspended / Terminated</Text>
            <Heading level={2}>{summary.inactiveCount}</Heading>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="eyebrow">Outstanding Balance Due</Text>
            <Heading level={2}>{formatUsd(summary.totalDue)}</Heading>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="eyebrow">Settled Accounts</Text>
            <Heading level={2}>{summary.settledCount}</Heading>
          </VStack>
        </Card>
      </Grid>

      <Card padding={5}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Billing Accounts & Invoices</Heading>
              <Badge variant="neutral" label={filteredBilling.length} />
            </HStack>

            <HStack gap={3} vAlign="end" wrap="wrap">
              <SegmentedControl
                label="Filter billing accounts by status"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as BillingFilter)}
                size="sm"
              >
                <SegmentedControlItem value="ALL" label="All" />
                <SegmentedControlItem value="Unpaid" label="Unpaid" />
                <SegmentedControlItem value="PartiallyPaid" label="Partially Paid" />
                <SegmentedControlItem value="Paid" label="Paid" />
                <SegmentedControlItem value="NotBilled" label="Not Billed" />
              </SegmentedControl>
              <TextInput
                type="search"
                label="Search Billing Accounts"
                placeholder="Account ID, Order ID, or plan..."
                hasClear
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </HStack>
          </HStack>

          {loading && billingAccounts.length === 0 ? (
            <Center padding={6}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading billing accounts..." />
                <Text type="supporting">Loading account invoices and payments...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<BillingRow>
                aria-label="Billing Accounts and Invoices"
                density="compact"
                dividers="rows"
                hasHover
                idKey="accountId"
                columns={billingColumns}
                data={billingPagination.paginatedItems}
                rowIndexStart={billingPagination.rowIndexStart}
                rowCount={billingPagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No billing accounts found"
                    description="Billing records appear once a connection is activated."
                    icon={<Icon icon="search" />}
                    isCompact
                  />
                }
              />
              <TablePaginationFooter
                page={billingPagination.page}
                pageSize={billingPagination.pageSize}
                totalItems={billingPagination.totalItems}
                onPageChange={billingPagination.setPage}
                onPageSizeChange={billingPagination.setPageSize}
                label="Customer billing pagination"
              />
            </>
          )}
        </VStack>
      </Card>

      <Card padding={5}>
        <VStack gap={4}>
          <HStack gap={2} vAlign="center">
            <Heading level={2}>My Connections</Heading>
            <Badge variant="neutral" label={connections.length} />
          </HStack>

          {loading && connections.length === 0 ? (
            <Center padding={6}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading connections..." />
                <Text type="supporting">Loading connection lifecycle records...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<ConnectionRow>
                aria-label="My Connections"
                density="compact"
                dividers="rows"
                hasHover
                idKey="accountId"
                columns={connectionColumns}
                data={connPagination.paginatedItems}
                rowIndexStart={connPagination.rowIndexStart}
                rowCount={connPagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No connections provisioned"
                    description="Activated orders will appear here with their 16-character Account ID."
                    icon={<Icon icon="info" />}
                    isCompact
                  />
                }
              />
              <TablePaginationFooter
                page={connPagination.page}
                pageSize={connPagination.pageSize}
                totalItems={connPagination.totalItems}
                onPageChange={connPagination.setPage}
                onPageSizeChange={connPagination.setPageSize}
                label="Connections pagination"
              />
            </>
          )}
        </VStack>
      </Card>

      <Drawer
        isOpen={drawerRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerRecord(null);
        }}
        label={drawerRecord ? `Account ${drawerRecord.accountId}` : 'Account Invoices'}
        width={600}
      >
        <Layout
          header={
            <DrawerHeader
              title={drawerRecord ? `Account ${drawerRecord.accountId}` : 'Account Invoices'}
              subtitle={drawerRecord ? `${drawerRecord.planName} · Order ${drawerRecord.orderId}` : undefined}
              endContent={drawerRecord ? <BillingStatusPill status={drawerRecord.status} /> : undefined}
              onOpenChange={(open) => {
                if (!open) setDrawerRecord(null);
              }}
            />
          }
          content={
            <LayoutContent>
              {drawerRecord && (
                <VStack gap={5}>
                  <MetadataList columns={2} title={<Heading level={4}>Account & Financial Summary</Heading>}>
                    <MetadataListItem label="Account ID">
                      <CopyableId value={drawerRecord.accountId} label="Account ID" />
                    </MetadataListItem>
                    <MetadataListItem label="Order ID">
                      <CopyableId value={drawerRecord.orderId} label="Order ID" />
                    </MetadataListItem>
                    <MetadataListItem label="Plan Rental">
                      {formatUsd(drawerRecord.rentalAmount ?? drawerRecord.amount)}
                    </MetadataListItem>
                    <MetadataListItem label="Call Usage Charges">
                      {formatUsd(drawerRecord.callUsageAmount ?? 0)}
                    </MetadataListItem>
                    <MetadataListItem label="Equipment Fee">
                      {formatUsd(drawerRecord.equipmentFee ?? 0)}
                    </MetadataListItem>
                    <MetadataListItem label="Recorded Discount">
                      {drawerRecord.discountPercent && drawerRecord.discountPercent > 0
                        ? `${drawerRecord.discountPercent}% (-${formatUsd(drawerRecord.discountAmount ?? 0)})`
                        : '$0.00 (0%)'}
                    </MetadataListItem>
                    <MetadataListItem label="Service Tax (12.24%)">
                      {formatUsd(drawerRecord.taxAmount ?? 0)}
                    </MetadataListItem>
                    <MetadataListItem label="Security Deposit">
                      {formatUsd(drawerRecord.depositAmount ?? 0)}
                    </MetadataListItem>
                    <MetadataListItem label="Previous Arrears">
                      {formatUsd(drawerRecord.previousDueBalance ?? 0)}
                    </MetadataListItem>
                    <MetadataListItem label="Total Invoiced">
                      <Text weight="semibold">{formatUsd(drawerRecord.totalAmount ?? drawerRecord.amount)}</Text>
                    </MetadataListItem>
                    <MetadataListItem label="Total Paid">
                      {formatUsd(drawerRecord.paidAmount ?? 0)}
                    </MetadataListItem>
                    <MetadataListItem label="Balance Due">
                      <Text weight="bold">
                        {formatUsd(drawerRecord.dueAmount ?? (drawerRecord.status === 'Paid' ? 0 : drawerRecord.amount))}
                      </Text>
                    </MetadataListItem>
                  </MetadataList>

                  <Divider />

                  <VStack gap={3}>
                    <Heading level={4}>Invoice History</Heading>
                    <Table<InvoiceRow>
                      aria-label="Customer Invoice History"
                      density="compact"
                      columns={invoiceColumns}
                      data={invoicePagination.paginatedItems}
                      rowIndexStart={invoicePagination.rowIndexStart}
                      rowCount={invoicePagination.totalItems}
                      idKey="id"
                      emptyState={
                        <EmptyState
                          title="No invoices issued yet"
                          description="Invoices will appear here once generated by Billing."
                          icon={<Icon icon="info" />}
                          isCompact
                        />
                      }
                    />
                    <TablePaginationFooter
                      page={invoicePagination.page}
                      pageSize={invoicePagination.pageSize}
                      totalItems={invoicePagination.totalItems}
                      onPageChange={invoicePagination.setPage}
                      onPageSizeChange={invoicePagination.setPageSize}
                      label="Customer invoice history pagination"
                    />
                  </VStack>

                  <Divider />

                  <PaymentHistory key={drawerRecord.accountId} record={drawerRecord} />
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
                {drawerRecord &&
                  (drawerRecord.status === 'Unpaid' ||
                    drawerRecord.status === 'PartiallyPaid') && (
                    <Button
                      variant="primary"
                      label="Pay Online"
                      isDisabled={isSuspended}
                      onClick={() => openPayDialog(drawerRecord)}
                    />
                  )}
                <Button
                  variant="secondary"
                  label="Close"
                  onClick={() => setDrawerRecord(null)}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>

      <Dialog
        isOpen={payTarget !== null}
        onOpenChange={(open) => {
          if (!open && !paying) setPayTarget(null);
        }}
        purpose="form"
        width={480}
      >
        <Layout
          header={
            <DialogHeader
              title="Online Invoice Payment"
              subtitle={
                payTarget
                  ? `Account ${payTarget.accountId}${payTarget.invoiceNumber ? ` · Invoice #${payTarget.invoiceNumber}` : ''}`
                  : undefined
              }
              onOpenChange={(open) => {
                if (!open && !paying) setPayTarget(null);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Payment could not be completed"
                  error={payError}
                  onDismiss={() => setPayError(null)}
                />
                <form id="customer-online-pay-form" onSubmit={(e) => void handlePaySubmit(e)}>
                  <FormLayout>
                    <TextInput
                      label="Payment Amount ($)"
                      inputMode="decimal"
                      hasClear
                      isRequired
                      value={payAmount}
                      onChange={(val) => {
                        setPayAmount(val);
                        setPayAmountError(null);
                      }}
                      description={
                        payTarget
                          ? `Current balance due: ${formatUsd(payTarget.dueAmount ?? payTarget.amount)}. Partial payments are accepted.`
                          : undefined
                      }
                      status={
                        payAmountError
                          ? { type: 'error', message: payAmountError }
                          : undefined
                      }
                    />
                    <TextArea
                      label="Payment Note (Optional)"
                      placeholder="e.g. Online portal payment"
                      rows={2}
                      maxLength={250}
                      isOptional
                      value={payNote}
                      onChange={setPayNote}
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
                  isDisabled={paying}
                  onClick={() => setPayTarget(null)}
                />
                <Button
                  type="submit"
                  form="customer-online-pay-form"
                  variant="primary"
                  label="Submit Payment"
                  isLoading={paying}
                  isDisabled={paying || isSuspended}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </VStack>
  );
}
