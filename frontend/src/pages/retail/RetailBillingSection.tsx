import { useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
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
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Token } from '@astryxdesign/core/Token';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  BillingStatusPill,
  CopyableId,
  formatUsd,
  lastPaymentAt,
} from '../../components/StatusViews';
import { PaymentHistory } from '../shared/PaymentHistory';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  getRetailBillingAccount,
  getRetailBillingAccounts,
  recordRetailPayment,
} from '../../services/billingApi';
import { getCities } from '../../services/catalogApi';
import type {
  BillingView,
  CityView,
  RecordPaymentInput,
} from '../../types/nexus';
import {
  computeCollectedAmount,
  validatePositiveCurrency,
} from '../billing/billingTypes';
import {
  extractErrorMessage,
  type RetailSectionProps,
} from './retailTypes';

export type RetailBillingRow = BillingView & Record<string, unknown>;

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Accounts' },
  { value: 'Unpaid', label: 'Unpaid Accounts' },
  { value: 'PartiallyPaid', label: 'Partially Paid' },
  { value: 'Paid', label: 'Fully Settled' },
  { value: 'NotBilled', label: 'Not Billed' },
];

export function RetailBillingSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: RetailSectionProps): JSX.Element {
  const toast = useToast();

  const [accounts, setAccounts] = useState<BillingView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drawer & payment collection state
  const [selectedRecord, setSelectedRecord] = useState<BillingView | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAmountError, setPaymentAmountError] = useState<string | null>(null);
  const [paymentNote, setPaymentNote] = useState('');
  const [collecting, setCollecting] = useState(false);

  const isMountedRef = useRef(true);
  const collectingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    void getCities().then((res) => {
      if (isMountedRef.current) setCities(res);
    }).catch(() => {
      // Non-fatal
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (!cancelled && isMountedRef.current) {
          onRefreshingChange(true);
        }
        return getRetailBillingAccounts({
          q: debouncedSearch || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          cityCode: cityFilter === 'ALL' ? undefined : cityFilter,
        });
      })
      .then((data) => {
        if (!cancelled && isMountedRef.current) {
          setAccounts(data);
          onCountChange(data.length);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && isMountedRef.current) {
          setLoadError(extractErrorMessage(err, 'Failed to load retail billing accounts.'));
        }
      })
      .finally(() => {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cityFilter, debouncedSearch, onCountChange, onRefreshingChange, refreshTrigger, statusFilter]);

  const cityOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Cities' },
      ...cities.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    ],
    [cities],
  );

  const tableRows = useMemo<RetailBillingRow[]>(
    () => accounts.map((a) => ({ ...a })),
    [accounts],
  );

  const pagination = useClientPagination(tableRows, {
    resetKey: `${statusFilter}::${cityFilter}::${debouncedSearch}`,
  });

  const handleOpenAccount = async (rec: BillingView) => {
    setSelectedRecord(rec);
    setDrawerError(null);
    setShowPaymentForm(false);
    setPaymentAmountError(null);
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      const fresh = await getRetailBillingAccount(rec.accountId);
      if (!isMountedRef.current) return;
      setSelectedRecord(fresh);
      setAccounts((prev) =>
        prev.map((item) => (item.accountId === fresh.accountId ? fresh : item)),
      );
    } catch (err) {
      if (!isMountedRef.current) return;
      setDrawerError(extractErrorMessage(err, 'Failed to refresh latest account details.'));
    } finally {
      if (isMountedRef.current) {
        setDrawerLoading(false);
      }
    }
  };

  const handlePaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || collectingRef.current || collecting) return;

    const { value: validatedAmount, error: validationError } =
      validatePositiveCurrency(paymentAmount);
    if (validationError || validatedAmount === null) {
      setPaymentAmountError(validationError ?? 'Please enter a valid positive payment amount.');
      return;
    }

    const prevRecord = selectedRecord;
    collectingRef.current = true;
    setCollecting(true);
    setPaymentAmountError(null);
    setDrawerError(null);

    const input: RecordPaymentInput = {
      amount: validatedAmount,
      channel: 'RetailOutlet',
      note: paymentNote.trim() || 'In-store retail counter collection',
    };

    try {
      const updated = await recordRetailPayment(selectedRecord.accountId, input);
      if (!isMountedRef.current) return;
      const collectedAmount = computeCollectedAmount(prevRecord, updated, validatedAmount);
      setSelectedRecord(updated);
      setAccounts((prev) =>
        prev.map((item) => (item.accountId === updated.accountId ? updated : item)),
      );
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentAmountError(null);
      setPaymentNote('');
      toast({
        body: `Collected in-store payment of ${formatUsd(collectedAmount)} for account ${updated.accountId}${
          updated.status === 'PartiallyPaid'
            ? ` (${formatUsd(updated.dueAmount ?? 0)} remaining)`
            : ''
        }.`,
      });
      collectingRef.current = false;
      setCollecting(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      setDrawerError(extractErrorMessage(err, 'Failed to record in-store payment.'));
    } finally {
      collectingRef.current = false;
      if (isMountedRef.current) {
        setCollecting(false);
      }
    }
  };

  const columns: TableColumn<RetailBillingRow>[] = [
    {
      key: 'accountId',
      header: 'Account ID',
      width: pixel(180),
      renderCell: (r: RetailBillingRow) => <CopyableId value={r.accountId} label="Account ID" />,
    },
    {
      key: 'customer',
      header: 'Customer',
      width: proportional(1.5),
      renderCell: (r: RetailBillingRow) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{r.customerName}</Text>
          <Text type="supporting">Order #{r.orderId}</Text>
        </VStack>
      ),
    },
    {
      key: 'plan',
      header: 'Service Plan',
      width: proportional(1.5),
      renderCell: (r: RetailBillingRow) => (
        <VStack gap={0.5}>
          <Text>{r.planName}</Text>
          {r.connectionCount && r.connectionCount > 1 ? (
            <Token size="sm" color="purple" label={`${r.connectionCount} lines (Bulk)`} />
          ) : (
            <Text type="supporting">1 line</Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'amount',
      header: 'Total Invoiced',
      width: pixel(120),
      renderCell: (r: RetailBillingRow) => <Text weight="semibold">{formatUsd(r.totalAmount ?? r.amount)}</Text>,
    },
    {
      key: 'due',
      header: 'Balance Due',
      width: pixel(120),
      renderCell: (r: RetailBillingRow) => {
        const due = r.dueAmount ?? (r.status === 'Paid' ? 0 : r.amount);
        return (
          <Text weight="bold">
            {formatUsd(due)}
          </Text>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(130),
      renderCell: (r: RetailBillingRow) => <BillingStatusPill status={r.status} />,
    },
    {
      key: 'paidAt',
      header: 'Last Payment',
      width: pixel(140),
      renderCell: (r: RetailBillingRow) => {
        const at = lastPaymentAt(r);
        return at ? (
          <Timestamp value={at} format="date" timezoneID="UTC" />
        ) : (
          <Text type="supporting">No payments</Text>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      width: pixel(180),
      align: 'end',
      renderCell: (r: RetailBillingRow) => (
        <HStack gap={2} hAlign="end" wrap="nowrap">
          <Button
            size="sm"
            variant="secondary"
            label="View & Collect"
            onClick={() => void handleOpenAccount(r)}
          />
        </HStack>
      ),
    },
  ];


  const activeDue =
    selectedRecord?.dueAmount ??
    (selectedRecord?.status === 'Paid' ? 0 : selectedRecord?.amount ?? 0);

  return (
    <VStack gap={4}>
      <Card padding={4}>
        <HStack gap={4} wrap="wrap" vAlign="end">
          <HStack gap={3} wrap="wrap">
            <TextInput
              type="search"
              label="Search Connected Accounts"
              placeholder="Search by Account ID, Order ID, customer, phone, or city..."
              startIcon={<Icon icon="search" />}
              hasClear
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <Selector
              label="Billing Status"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Selector
              label="Territory City"
              options={cityOptions}
              value={cityFilter}
              onChange={setCityFilter}
            />
          </HStack>
          <HStack gap={2} vAlign="center">
            <Badge variant="neutral" label={`${tableRows.length} accounts`} />
            {(searchQuery.trim() || statusFilter !== 'ALL' || cityFilter !== 'ALL') && (
              <Button
                size="sm"
                variant="ghost"
                label="Reset Filters"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setCityFilter('ALL');
                }}
              />
            )}
          </HStack>
        </HStack>
      </Card>

      <ApiErrorBanner
        title="Failed to load retail billing records"
        error={loadError}
        onDismiss={() => setLoadError(null)}
      />

      {loading ? (
        <Card padding={6}>
          <VStack gap={3} hAlign="center">
            <Spinner size="lg" label="Loading billing accounts..." />
            <Text type="supporting">Querying active connected accounts from database...</Text>
          </VStack>
        </Card>
      ) : (
        <Card padding={0}>
          <Table<RetailBillingRow>
            aria-label="Retail Billing and Collections Table"
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
                title="No billing accounts match criteria"
                description="Search with different keywords or clear status and city filters."
                icon={<Icon icon="search" />}
              />
            }
          />
          <TablePaginationFooter
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            label="Retail billing pagination"
          />
        </Card>
      )}

      {/* Account Details & Till-Date Collection Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onOpenChange={(open) => {
          if (!collecting) setDrawerOpen(open);
        }}
        label={selectedRecord ? `Account ${selectedRecord.accountId}` : 'Retail Billing Details'}
        width={580}
      >
        <Layout
          header={
            <DrawerHeader
              title={
                selectedRecord
                  ? `Account ${selectedRecord.accountId}`
                  : 'Retail Billing Details'
              }
              subtitle={
                selectedRecord
                  ? `${selectedRecord.customerName} · ${selectedRecord.planName}`
                  : undefined
              }
              endContent={
                selectedRecord ? <BillingStatusPill status={selectedRecord.status} /> : undefined
              }
              onOpenChange={(open) => {
                if (!collecting) setDrawerOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              {drawerLoading && !selectedRecord ? (
                <VStack gap={3} hAlign="center" padding={6}>
                  <Spinner size="lg" label="Loading account details..." />
                  <Text type="supporting">Fetching live till-date billing breakdown...</Text>
                </VStack>
              ) : selectedRecord ? (
                <VStack gap={5}>
                  <ApiErrorBanner
                    title="Action Error"
                    error={drawerError}
                    onDismiss={() => setDrawerError(null)}
                  />

                  <MetadataList columns={2} title={<Heading level={4}>Subscription Summary</Heading>}>
                    <MetadataListItem label="Account ID">
                      <CopyableId value={selectedRecord.accountId} label="Account ID" />
                    </MetadataListItem>
                    <MetadataListItem label="Order ID">
                      <CopyableId value={selectedRecord.orderId} label="Order ID" />
                    </MetadataListItem>
                    <MetadataListItem label="Customer Name">
                      {selectedRecord.customerName}
                    </MetadataListItem>
                    <MetadataListItem label="Plan Name">
                      {selectedRecord.planName}
                    </MetadataListItem>
                    <MetadataListItem label="Connection Lines">
                      <Text weight="medium">
                        {selectedRecord.connectionCount && selectedRecord.connectionCount > 1
                          ? `${selectedRecord.connectionCount} lines (Bulk Connection)`
                          : '1 line (Standard Single)'}
                      </Text>
                    </MetadataListItem>
                    <MetadataListItem label="Current Status">
                      <BillingStatusPill status={selectedRecord.status} />
                    </MetadataListItem>
                  </MetadataList>

                  <Divider />

                  {/* Till-Date Detailed Invoicing */}
                  <VStack gap={3}>
                    <HStack hAlign="between" vAlign="center">
                      <Heading level={4}>Till-Date Invoicing Breakdown</Heading>
                      {selectedRecord.invoiceNumber && (
                        <Token size="sm" color="blue" label={`#${selectedRecord.invoiceNumber}`} />
                      )}
                    </HStack>

                    <Card padding={4}>
                      <MetadataList columns={2}>
                        <MetadataListItem label="Billing Period">
                          {selectedRecord.billingPeriodStart ? (
                            <Text>
                              <Timestamp value={selectedRecord.billingPeriodStart} format="date" />
                              {' — '}
                              {selectedRecord.billingPeriodEnd ? (
                                <Timestamp value={selectedRecord.billingPeriodEnd} format="date" />
                              ) : (
                                'Now'
                              )}
                            </Text>
                          ) : (
                            <Text type="supporting">Active Period</Text>
                          )}
                        </MetadataListItem>
                        <MetadataListItem label="Plan Rental">
                          <Text weight="semibold">
                            {formatUsd(selectedRecord.rentalAmount ?? selectedRecord.amount)}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Call Usage Charges">
                          <Text weight="semibold">
                            {formatUsd(selectedRecord.callUsageAmount ?? 0)}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Equipment Fee">
                          <Text weight="semibold">
                            {formatUsd(selectedRecord.equipmentFee ?? 0)}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Gross Subtotal">
                          <Text weight="semibold">
                            {formatUsd(
                              selectedRecord.subtotal ??
                                (selectedRecord.rentalAmount ?? selectedRecord.amount),
                            )}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Recorded Discount">
                          <Text weight="semibold">
                            {selectedRecord.discountPercent && selectedRecord.discountPercent > 0
                              ? `${selectedRecord.discountPercent}% (-${formatUsd(selectedRecord.discountAmount ?? 0)})`
                              : '$0.00 (0%)'}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Government Service Tax (12.24%)">
                          <Text weight="semibold">{formatUsd(selectedRecord.taxAmount ?? 0)}</Text>
                        </MetadataListItem>
                        <MetadataListItem label="Deposit included in this invoice">
                          <Text weight="semibold">
                            {formatUsd(selectedRecord.depositAmount ?? 0)}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Previous Arrears Balance">
                          <Text weight="semibold">
                            {formatUsd(selectedRecord.previousDueBalance ?? 0)}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Total Invoiced Amount">
                          <Text weight="bold">
                            {formatUsd(selectedRecord.totalAmount ?? selectedRecord.amount)}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Total Amount Paid">
                          <Text weight="semibold">
                            {formatUsd(
                              selectedRecord.paidAmount ??
                                (selectedRecord.status === 'Paid' ? selectedRecord.amount : 0),
                            )}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Outstanding Balance Due">
                          <Text weight="bold">
                            {formatUsd(activeDue)}
                          </Text>
                        </MetadataListItem>
                      </MetadataList>
                    </Card>
                  </VStack>

                  {/* Payment Collection Form */}
                  {(selectedRecord.status === 'Unpaid' ||
                    selectedRecord.status === 'PartiallyPaid') &&
                  showPaymentForm ? (
                    <Card padding={4}>
                      <form onSubmit={(e) => void handlePaymentSubmit(e)}>
                        <VStack gap={3}>
                          <HStack hAlign="between" vAlign="center">
                            <Heading level={4}>Collect In-Store Payment</Heading>
                            <Button
                              size="sm"
                              variant="ghost"
                              label="Cancel"
                              onClick={() => setShowPaymentForm(false)}
                            />
                          </HStack>

                          <Text type="supporting">
                            Collect cash or card payment at retail counter. Channel will be stamped
                            as Retail Outlet.
                          </Text>

                          <FormLayout>
                            <TextInput
                              label="Amount to Collect ($)"
                              placeholder={String(activeDue)}
                              inputMode="decimal"
                              hasClear
                              value={paymentAmount}
                              onChange={(val) => {
                                setPaymentAmount(val);
                                if (paymentAmountError) setPaymentAmountError(null);
                              }}
                              status={
                                paymentAmountError
                                  ? { type: 'error', message: paymentAmountError }
                                  : undefined
                              }
                              description={`Outstanding balance: ${formatUsd(activeDue)}. Enter lesser amount for partial settlement.`}
                              isRequired
                            />
                            <TextInput
                              label="Receipt / Register Note"
                              placeholder="e.g. Retail POS #4, Cash Register 1"
                              value={paymentNote}
                              onChange={setPaymentNote}
                              description="Optional cashier note or receipt reference number."
                            />
                          </FormLayout>

                          <HStack hAlign="end" gap={2}>
                            <Button
                              type="submit"
                              variant="primary"
                              label="Process In-Store Collection"
                              isLoading={collecting}
                              isDisabled={collecting}
                            />
                          </HStack>
                        </VStack>
                      </form>
                    </Card>
                  ) : null}

                  <PaymentHistory key={selectedRecord.accountId} record={selectedRecord} />
                </VStack>
              ) : (
                <EmptyState
                  title="No account selected"
                  description="Choose a connected account from the table."
                  icon={<Icon icon="info" />}
                  isCompact
                />
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                <HStack gap={2} wrap="wrap">
                  {selectedRecord && (
                    <Button
                      variant="secondary"
                      label="Refresh Account"
                      isLoading={drawerLoading}
                      isDisabled={drawerLoading || collecting}
                      onClick={() => void handleOpenAccount(selectedRecord)}
                    />
                  )}
                </HStack>
                <HStack gap={2} wrap="wrap">
                  {selectedRecord &&
                  (selectedRecord.status === 'Unpaid' ||
                    selectedRecord.status === 'PartiallyPaid') &&
                  !showPaymentForm ? (
                    <Button
                      variant="primary"
                      label="Collect Payment"
                      isLoading={collecting}
                      isDisabled={collecting || drawerLoading}
                      onClick={() => {
                        setPaymentAmount(String(activeDue));
                        setPaymentAmountError(null);
                        setShowPaymentForm(true);
                      }}
                    />
                  ) : null}
                  <Button
                    variant="ghost"
                    label="Close"
                    onClick={() => setDrawerOpen(false)}
                  />
                </HStack>
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>
    </VStack>
  );
}
