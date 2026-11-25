/**
 * Billing account lookup, invoice generation, and payment settlement workspace section.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
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
import {
  createBillingRecord,
  getBillingAccount,
  recordPayment,
} from '../../services/billingApi';
import {
  ApiError,
  type BillingView,
  type CreateInvoiceInput,
  type RecordPaymentInput,
} from '../../types/nexus';
import { BillingAccountDrawer } from './BillingAccountDrawer';
import {
  computeCollectedAmount,
  formatBillingError,
  formatCityLabel,
  isValidAccountId,
  normalizeAccountId,
  parseAccountIdMetadata,
  type BillingRow,
  type BillingSectionProps,
} from './billingTypes';

export function BillingAccountsSection({
  records,
  selectedAccountId,
  citiesByCode,
  refreshTrigger,
  onRecordUpsert,
  onSelectAccount,
  onCountChange,
  onRefreshingChange,
}: BillingSectionProps): JSX.Element {
  const toast = useToast();

  const [accountInput, setAccountInput] = useState(selectedAccountId ?? '');
  const [inputError, setInputError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [creatingBill, setCreatingBill] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  const activeRecord = useMemo<BillingView | null>(
    () =>
      selectedAccountId
        ? records.find((r) => r.accountId === selectedAccountId) ?? null
        : null,
    [records, selectedAccountId],
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<BillingView | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const drawerSeqRef = useRef(0);
  const generatingBillRef = useRef(false);
  const processingPaymentRef = useRef(false);
  const lastHandledRefreshTriggerRef = useRef(refreshTrigger);
  const targetAccountId = activeRecord?.accountId ?? selectedAccountId;
  const targetAccountIdRef = useRef<string | null>(targetAccountId);

  useEffect(() => {
    targetAccountIdRef.current = targetAccountId;
  }, [targetAccountId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onCountChange(records.length);
  }, [onCountChange, records.length]);

  const performLookup = useCallback(
    async (rawAccountId: string, silent = false, preserveActionError = false) => {
      const normalized = normalizeAccountId(rawAccountId);
      if (!normalized) {
        setInputError('Enter a 16-character Account ID (e.g. B101000000000001).');
        return;
      }

      setAccountInput(normalized);
      if (!isValidAccountId(normalized)) {
        setInputError(
          'Account ID must be 16 characters: D, B, or T followed by 15 digits (e.g. B101000000000001).',
        );
        return;
      }

      const seq = ++requestSeqRef.current;
      setInputError(null);
      setLookupError(null);
      if (!preserveActionError) {
        setActionError(null);
      }
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLookupLoading(true);
      }

      try {
        const account = await getBillingAccount(normalized);
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        onRecordUpsert(account);
        onSelectAccount(account.accountId);
        setDrawerRecord((prev) =>
          prev && prev.accountId === account.accountId ? account : prev,
        );
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLookupError(
          formatBillingError(err, normalized, `Could not retrieve billing account ${normalized}.`),
        );
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setLookupLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [onRecordUpsert, onRefreshingChange, onSelectAccount],
  );

  useEffect(() => {
    if (refreshTrigger <= 0 || refreshTrigger === lastHandledRefreshTriggerRef.current) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled || !isMountedRef.current) return undefined;
      lastHandledRefreshTriggerRef.current = refreshTrigger;
      const targetId = targetAccountIdRef.current;
      if (!targetId) return undefined;
      return performLookup(targetId, true);
    });

    return () => {
      cancelled = true;
    };
  }, [performLookup, refreshTrigger]);

  const handleLookupSubmit = (e: FormEvent) => {
    e.preventDefault();
    void performLookup(accountInput, false);
  };

  const handleCreateBill = async (targetId: string, input?: CreateInvoiceInput) => {
    const normalized = normalizeAccountId(targetId);
    if (!normalized || generatingBillRef.current || processingPaymentRef.current) {
      return;
    }
    generatingBillRef.current = true;
    setCreatingBill(true);
    setActionError(null);
    setDrawerError(null);

    try {
      const updated = await createBillingRecord(normalized, input);
      if (!isMountedRef.current) return;
      onRecordUpsert(updated);
      onSelectAccount(updated.accountId);
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
        setCreatingBill(false);
      }
    }
  };

  const handleRecordPayment = async (targetId: string, input?: RecordPaymentInput) => {
    const normalized = normalizeAccountId(targetId);
    if (
      !normalized ||
      processingPaymentRef.current ||
      generatingBillRef.current
    ) {
      return;
    }
    const prevRecord =
      records.find((r) => r.accountId === normalized) ??
      (drawerRecord?.accountId === normalized ? drawerRecord : null);
    processingPaymentRef.current = true;
    setRecordingPayment(true);
    setActionError(null);
    setDrawerError(null);

    try {
      const updated = await recordPayment(normalized, input);
      if (!isMountedRef.current) return;
      onRecordUpsert(updated);
      onSelectAccount(updated.accountId);
      setDrawerRecord((prev) =>
        prev && prev.accountId === updated.accountId ? updated : prev,
      );
      const collectedAmount = computeCollectedAmount(prevRecord, updated, input?.amount);
      toast({
        body: `Recorded payment of ${formatUsd(collectedAmount)} for ${updated.accountId}${
          updated.status === 'PartiallyPaid'
            ? ` (${formatUsd(updated.dueAmount ?? 0)} remaining)`
            : ''
        }.`,
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
        void performLookup(normalized, true, true);
      }
    } finally {
      processingPaymentRef.current = false;
      if (isMountedRef.current) {
        setRecordingPayment(false);
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

  const parsedMeta = activeRecord ? parseAccountIdMetadata(activeRecord.accountId) : null;
  const activeStep =
    activeRecord?.status === 'Paid'
      ? 2
      : activeRecord?.status === 'Unpaid' || activeRecord?.status === 'PartiallyPaid'
        ? 1
        : 0;
  const activeDue = activeRecord
    ? (activeRecord.dueAmount ?? (activeRecord.status === 'Paid' ? 0 : activeRecord.amount))
    : 0;
  const activePaid = activeRecord
    ? (activeRecord.paidAmount ?? (activeRecord.status === 'Paid' ? activeRecord.amount : 0))
    : 0;

  const recentRows = useMemo<BillingRow[]>(
    () => records.map((rec) => ({ ...rec })),
    [records],
  );
  const pagination = useClientPagination(recentRows);

  const recentColumns: TableColumn<BillingRow>[] = [
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
      header: 'Amount',
      width: pixel(110),
      align: 'end',
      renderCell: (row) => <Text weight="semibold">{formatUsd(row.amount)}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(140),
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
      width: pixel(165),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={2} hAlign="end" wrap="nowrap">
          <Button
            size="sm"
            variant="secondary"
            label="Select"
            onClick={() => {
              setAccountInput(row.accountId);
              setInputError(null);
              setLookupError(null);
              setActionError(null);
              onSelectAccount(row.accountId);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            label="View"
            onClick={() => handleOpenDrawer(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <VStack gap={5}>
      <Card padding={6}>
        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={2}>Account ID Lookup</Heading>
            <Text type="supporting">
              Look up a connected customer account using its 16-character Account ID (e.g.
              B101000000000001). Whitespace and lowercase characters are normalized automatically.
            </Text>
          </VStack>

          <form onSubmit={handleLookupSubmit}>
            <HStack gap={3} vAlign="end" wrap="wrap">
              <TextInput
                type="search"
                label="Account ID (16-char)"
                placeholder="e.g. B101000000000001"
                description="Format: {D|B|T}{3-digit city code}{12-digit serial}"
                startIcon={<Icon icon="search" />}
                hasClear
                isRequired
                width={380}
                value={accountInput}
                onChange={(val) => {
                  setAccountInput(val);
                  if (inputError) setInputError(null);
                }}
                status={inputError ? { type: 'error', message: inputError } : undefined}
              />
              <Button
                type="submit"
                variant="primary"
                label="Look Up Account"
                isLoading={lookupLoading}
                isDisabled={lookupLoading}
              />
            </HStack>
          </form>

          <ApiErrorBanner
            title="Account lookup failed"
            error={lookupError}
            onDismiss={() => setLookupError(null)}
          />

          <ApiErrorBanner
            title="Billing operation failed"
            error={actionError}
            onDismiss={() => setActionError(null)}
          />
        </VStack>
      </Card>

      {lookupLoading && !activeRecord ? (
        <Card padding={6}>
          <Center padding={6}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Looking up account..." />
              <Text type="supporting">Querying live billing status...</Text>
            </VStack>
          </Center>
        </Card>
      ) : activeRecord ? (
        <Card padding={6}>
          <VStack gap={5}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
              <VStack gap={1}>
                <Heading level={2}>Account Billing Summary</Heading>
                <Text type="supporting">
                  Live postpaid billing state and receipt record for {activeRecord.accountId}.
                </Text>
              </VStack>
              <HStack gap={2} vAlign="center" wrap="wrap">
                {parsedMeta ? <ServiceTypeToken type={parsedMeta.serviceType} /> : null}
                <BillingStatusPill status={activeRecord.status} />
              </HStack>
            </HStack>

            <Card padding={4} variant="muted">
              <Stepper
                activeStep={activeStep}
                density="compact"
                label="Account billing lifecycle"
              >
                <Step
                  step={0}
                  label="Connection Active"
                  description="16-char Account ID provisioned"
                />
                <Step
                  step={1}
                  label="Billing Record Created"
                  description="Plan price locked as Unpaid"
                />
                <Step
                  step={2}
                  label="Payment Recorded"
                  description="Full manual payment settled"
                />
              </Stepper>
            </Card>

            <MetadataList columns={2}>
              <MetadataListItem label="Account ID (16-char)">
                <CopyableId value={activeRecord.accountId} label="Account ID" />
              </MetadataListItem>
              <MetadataListItem label="Order ID (11-char)">
                <CopyableId value={activeRecord.orderId} label="Order ID" />
              </MetadataListItem>
              <MetadataListItem label="Customer Name">
                {activeRecord.customerName}
              </MetadataListItem>
              <MetadataListItem label="Service Plan">
                {activeRecord.planName}
              </MetadataListItem>
              <MetadataListItem label="Plan / Billed Amount">
                <Text weight="semibold">{formatUsd(activeRecord.amount)}</Text>
              </MetadataListItem>
              <MetadataListItem label="Billing Status">
                <BillingStatusPill status={activeRecord.status} />
              </MetadataListItem>
              <MetadataListItem label="Amount Due">
                <Text weight="semibold">{formatUsd(activeDue)}</Text>
              </MetadataListItem>
              <MetadataListItem label="Amount Paid">
                <Text weight="semibold">{formatUsd(activePaid)}</Text>
              </MetadataListItem>
              <MetadataListItem label="Territory City">
                {formatCityLabel(parsedMeta?.cityCode, citiesByCode)}
              </MetadataListItem>
              <MetadataListItem label="Paid At (UTC)">
                {activeRecord.paidAt ? (
                  <Timestamp
                    value={activeRecord.paidAt}
                    format="date_time"
                    timezoneID="UTC"
                    isTimezoneShown
                  />
                ) : (
                  <Text type="supporting">Not yet paid</Text>
                )}
              </MetadataListItem>
            </MetadataList>

            <Divider />

            {activeRecord.status === 'NotBilled' ? (
              <Banner
                status="info"
                container="section"
                collapsible={false}
                title="Ready for Invoicing"
                description="Create a billing record to lock the current plan price and transition this account to Unpaid."
              />
            ) : activeRecord.status === 'Unpaid' ? (
              <Banner
                status="warning"
                container="section"
                collapsible={false}
                title="Payment Pending"
                description={`Billing record created. Record payment once funds are received (${formatUsd(activeDue)} due).`}
              />
            ) : activeRecord.status === 'PartiallyPaid' ? (
              <Banner
                status="warning"
                container="section"
                collapsible={false}
                title="Partially Paid"
                description={`Partial payment recorded (${formatUsd(activePaid)} paid). Remaining balance due: ${formatUsd(activeDue)}.`}
              />
            ) : (
              <Banner
                status="success"
                container="section"
                collapsible={false}
                title="Account Paid in Full"
                description="Full manual payment has been recorded and settled for this connection."
              />
            )}

            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                {activeRecord.status === 'NotBilled' ? (
                  <Button
                    variant="primary"
                    label="Create Billing Record"
                    isLoading={creatingBill}
                    isDisabled={creatingBill || recordingPayment}
                    onClick={() => void handleCreateBill(activeRecord.accountId)}
                  />
                ) : null}
                {activeRecord.status === 'Unpaid' || activeRecord.status === 'PartiallyPaid' ? (
                  <Button
                    variant="primary"
                    label={
                      activeRecord.status === 'PartiallyPaid'
                        ? 'Settle Remaining Balance'
                        : 'Record Full Payment'
                    }
                    isLoading={recordingPayment}
                    isDisabled={creatingBill || recordingPayment}
                    onClick={() => void handleRecordPayment(activeRecord.accountId)}
                  />
                ) : null}
                <Button
                  variant="secondary"
                  label="Inspect Details"
                  onClick={() => handleOpenDrawer(activeRecord)}
                />
                <Button
                  variant="ghost"
                  label="Refresh Account"
                  isLoading={lookupLoading}
                  isDisabled={lookupLoading || creatingBill || recordingPayment}
                  onClick={() => void performLookup(activeRecord.accountId, false)}
                />
              </HStack>
            </HStack>
          </VStack>
        </Card>
      ) : (
        <Card padding={6}>
          <EmptyState
            title="No billing account loaded"
            description="Enter a connected 16-character Account ID above and click Look Up Account to view billing details, generate a bill, or record payment."
            icon={<Icon icon="search" />}
          />
        </Card>
      )}

      {recentRows.length > 0 ? (
        <Card padding={6}>
          <VStack gap={4}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <VStack gap={0.5}>
                <Heading level={3}>Recent Session Accounts</Heading>
                <Text type="supporting">
                  Accounts looked up or updated during this browser session.
                </Text>
              </VStack>
              <Badge variant="neutral" label={`${recentRows.length} tracked`} />
            </HStack>

            <Table<BillingRow>
              aria-label="Recent Session Billing Accounts"
              density="compact"
              dividers="rows"
              hasHover
              idKey="accountId"
              columns={recentColumns}
              data={pagination.paginatedItems}
              rowIndexStart={pagination.rowIndexStart}
              rowCount={pagination.totalItems}
            />
            <TablePaginationFooter
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              label="Recent billing accounts pagination"
            />
          </VStack>
        </Card>
      ) : null}

      <BillingAccountDrawer
        record={drawerRecord}
        citiesByCode={citiesByCode}
        isOpen={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        isLoading={drawerLoading}
        actionLoading={creatingBill || recordingPayment}
        error={drawerError}
        onDismissError={() => setDrawerError(null)}
        onRefresh={(id) => void handleRefreshDrawer(id)}
        onCreateBill={(id, input) => void handleCreateBill(id, input)}
        onRecordPayment={(id, input) => void handleRecordPayment(id, input)}
      />
    </VStack>
  );
}
