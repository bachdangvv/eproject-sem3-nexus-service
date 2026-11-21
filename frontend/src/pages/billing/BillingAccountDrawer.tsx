import { useMemo, useState, type FormEvent, type JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Code } from '@astryxdesign/core/Code';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Divider } from '@astryxdesign/core/Divider';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
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
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import type {
  BillingStatus,
  BillingView,
  CreateInvoiceInput,
  InvoiceItemView,
  PaymentItemView,
  RecordPaymentInput,
  RefundDepositInput,
} from '../../types/nexus';
import {
  formatCityLabel,
  parseAccountIdMetadata,
  validateNonNegativeCurrency,
  validateNonNegativeInt,
  validatePositiveCurrency,
} from './billingTypes';

export interface BillingAccountDrawerProps {
  record: BillingView | null;
  citiesByCode: Record<string, string>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  actionLoading?: boolean;
  error?: string | null;
  onDismissError?: () => void;
  onRefresh?: (accountId: string) => void;
  onCreateBill?: (accountId: string, input?: CreateInvoiceInput) => Promise<void> | void;
  onRecordPayment?: (accountId: string, input?: RecordPaymentInput) => Promise<void> | void;
  onRefundDeposit?: (accountId: string, input?: RefundDepositInput) => Promise<void> | void;
}

interface InvoiceFormErrors {
  localMins?: string;
  stdMins?: string;
  mobileMins?: string;
  equipFee?: string;
  periodEnd?: string;
}

function getRefundTokenColor(status?: string): TokenColor {
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

function renderInvoiceStatusPill(status: string): JSX.Element {
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

export function BillingAccountDrawer({
  record,
  citiesByCode,
  isOpen,
  onOpenChange,
  isLoading = false,
  actionLoading = false,
  error = null,
  onDismissError,
  onRefresh,
  onCreateBill,
  onRecordPayment,
  onRefundDeposit,
}: BillingAccountDrawerProps): JSX.Element {
  const parsedMeta = record ? parseAccountIdMetadata(record.accountId) : null;
  const isLandline = parsedMeta?.serviceType === 'T';

  const activeStep =
    record?.status === 'Paid'
      ? 2
      : record?.status === 'Unpaid' || record?.status === 'PartiallyPaid'
        ? 1
        : 0;

  // Invoice creation form state
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [localMins, setLocalMins] = useState('0');
  const [stdMins, setStdMins] = useState('0');
  const [mobileMins, setMobileMins] = useState('0');
  const [equipFee, setEquipFee] = useState('0');
  const [includeDeposit, setIncludeDeposit] = useState(
    (record?.invoices?.length ?? 0) === 0 && record?.status === 'NotBilled',
  );
  const [periodStart, setPeriodStart] = useState<ISODateString | undefined>(undefined);
  const [periodEnd, setPeriodEnd] = useState<ISODateString | undefined>(undefined);
  const [invoiceErrors, setInvoiceErrors] = useState<InvoiceFormErrors>({});

  // Payment recording form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAmountError, setPaymentAmountError] = useState<string | null>(null);
  const [paymentNote, setPaymentNote] = useState('');

  // Refund disbursement form state
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundNote, setRefundNote] = useState('');

  const accountIdKey = record?.accountId ?? null;
  const [prevAccountId, setPrevAccountId] = useState<string | null>(accountIdKey);
  if (prevAccountId !== accountIdKey) {
    setPrevAccountId(accountIdKey);
    setShowInvoiceForm(false);
    setLocalMins('0');
    setStdMins('0');
    setMobileMins('0');
    setEquipFee('0');
    setIncludeDeposit((record?.invoices?.length ?? 0) === 0 && record?.status === 'NotBilled');
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setInvoiceErrors({});
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentAmountError(null);
    setPaymentNote('');
    setShowRefundForm(false);
    setRefundNote('');
  }

  const effectiveDue = record?.dueAmount ?? (record?.status === 'Paid' ? 0 : record?.amount ?? 0);
  const canDisburseRefund = Boolean(
    onRefundDeposit &&
      record &&
      record.connectionStatus === 'PermanentlyInactive' &&
      record.refundStatus === 'Pending' &&
      (record.refundAmount ?? 0) > 0,
  );

  const invoiceRows = useMemo(
    () =>
      (record?.invoices ?? []) as unknown as (InvoiceItemView & Record<string, unknown>)[],
    [record?.invoices],
  );

  const invoicePagination = useClientPagination(invoiceRows, {
    resetKey: record?.accountId ?? '',
  });

  const paymentRows = useMemo(
    () =>
      (record?.payments ?? []) as unknown as (PaymentItemView & Record<string, unknown>)[],
    [record?.payments],
  );

  const paymentPagination = useClientPagination(paymentRows, {
    resetKey: record?.accountId ?? '',
  });

  const handleGenerateInvoiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!record || !onCreateBill) return;

    const nextErrors: InvoiceFormErrors = {};
    const localCheck = isLandline
      ? validateNonNegativeInt(localMins, 'Local call minutes')
      : { value: 0, error: null };
    if (localCheck.error) nextErrors.localMins = localCheck.error;

    const stdCheck = isLandline
      ? validateNonNegativeInt(stdMins, 'STD call minutes')
      : { value: 0, error: null };
    if (stdCheck.error) nextErrors.stdMins = stdCheck.error;

    const mobileCheck = isLandline
      ? validateNonNegativeInt(mobileMins, 'Mobile messaging minutes')
      : { value: 0, error: null };
    if (mobileCheck.error) nextErrors.mobileMins = mobileCheck.error;

    const equipCheck = validateNonNegativeCurrency(equipFee, 'equipment replacement fee');
    if (equipCheck.error) nextErrors.equipFee = equipCheck.error;

    if (periodStart && periodEnd && periodEnd <= periodStart) {
      nextErrors.periodEnd = 'Billing period end must be after billing period start.';
    }

    setInvoiceErrors(nextErrors);
    if (
      Object.keys(nextErrors).length > 0 ||
      localCheck.value === null ||
      stdCheck.value === null ||
      mobileCheck.value === null ||
      equipCheck.value === null
    ) {
      return;
    }

    const input: CreateInvoiceInput = {
      localMinutes: localCheck.value,
      stdMinutes: stdCheck.value,
      mobileMinutes: mobileCheck.value,
      equipmentFee: equipCheck.value,
      includeDeposit,
      periodStart: periodStart ? `${periodStart}T00:00:00Z` : undefined,
      periodEnd: periodEnd ? `${periodEnd}T00:00:00Z` : undefined,
    };
    await onCreateBill(record.accountId, input);
    setShowInvoiceForm(false);
  };

  const handleRecordPaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!record || !onRecordPayment) return;
    const { value, error: validationError } = validatePositiveCurrency(paymentAmount);
    if (validationError || value === null) {
      setPaymentAmountError(validationError ?? 'Enter a valid positive payment amount.');
      return;
    }
    setPaymentAmountError(null);
    const input: RecordPaymentInput = {
      amount: value,
      channel: 'CityOffice',
      note: paymentNote.trim() || undefined,
    };
    await onRecordPayment(record.accountId, input);
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentNote('');
  };

  const handleRefundSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!record || !onRefundDeposit || !canDisburseRefund) return;
    if (refundNote.trim().length > 500) return;
    await onRefundDeposit(record.accountId, {
      note: refundNote.trim() || undefined,
    });
    setShowRefundForm(false);
    setRefundNote('');
  };

  const invoiceColumns: TableColumn<InvoiceItemView & Record<string, unknown>>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      width: pixel(155),
      renderCell: (inv) => <Code>{inv.invoiceNumber}</Code>,
    },
    {
      key: 'period',
      header: 'Billing Period',
      width: pixel(180),
      renderCell: (inv) => (
        <Text type="supporting">
          <Timestamp value={inv.billingPeriodStart} format="date" />
          {' — '}
          <Timestamp value={inv.billingPeriodEnd} format="date" />
        </Text>
      ),
    },
    {
      key: 'totalAmount',
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
      key: 'paidAmount',
      header: 'Paid',
      width: pixel(90),
      align: 'end',
      renderCell: (inv) => (
        <Text type="supporting" hasTabularNumbers>
          {formatUsd(inv.paidAmount)}
        </Text>
      ),
    },
    {
      key: 'dueAmount',
      header: 'Due',
      width: pixel(90),
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
      renderCell: (inv) => renderInvoiceStatusPill(inv.status),
    },
  ];

  const paymentColumns: TableColumn<PaymentItemView & Record<string, unknown>>[] = [
    {
      key: 'date',
      header: 'Date (UTC)',
      width: proportional(1.5),
      renderCell: (p: PaymentItemView & Record<string, unknown>) => (
        <Timestamp value={p.paidAt} format="date_time" timezoneID="UTC" isTimezoneShown />
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      width: pixel(100),
      renderCell: (p: PaymentItemView & Record<string, unknown>) => (
        <Text weight="semibold">{formatUsd(p.amount)}</Text>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      width: pixel(120),
      renderCell: (p: PaymentItemView & Record<string, unknown>) => (
        <Token
          size="sm"
          color={
            p.channel === 'CustomerPortal'
              ? 'teal'
              : p.channel === 'RetailOutlet'
                ? 'purple'
                : 'blue'
          }
          label={
            p.channel === 'CustomerPortal'
              ? 'Customer Portal'
              : p.channel === 'RetailOutlet'
                ? 'Retail Outlet'
                : 'City Office'
          }
        />
      ),
    },
    {
      key: 'collector',
      header: 'Collector',
      width: pixel(120),
      renderCell: (p: PaymentItemView & Record<string, unknown>) => (
        <Text type="supporting">{p.paidByUsername}</Text>
      ),
    },
    {
      key: 'note',
      header: 'Note',
      width: proportional(1.5),
      renderCell: (p: PaymentItemView & Record<string, unknown>) => (
        <Text type="supporting">{p.note || '—'}</Text>
      ),
    },
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label={record ? `Account ${record.accountId}` : 'Billing Account Details'}
      width={600}
    >
      <Layout
        header={
          <DrawerHeader
            title={record ? `Account ${record.accountId}` : 'Billing Account Details'}
            subtitle={record ? `${record.customerName} - ${record.planName}` : undefined}
            endContent={record ? <BillingStatusPill status={record.status} /> : undefined}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            {isLoading && !record ? (
              <VStack gap={3} hAlign="center" padding={6}>
                <Spinner size="lg" label="Loading billing account..." />
                <Text type="supporting">Retrieving live billing account status...</Text>
              </VStack>
            ) : record ? (
              <VStack gap={5}>
                <ApiErrorBanner
                  title="Billing action failed"
                  error={error}
                  onDismiss={onDismissError}
                />

                <Card padding={4} variant="muted">
                  <Stepper
                    activeStep={activeStep}
                    density="compact"
                    label="Billing lifecycle progress"
                  >
                    <Step
                      step={0}
                      label="Connection Active"
                      description="16-char Account ID provisioned"
                    />
                    <Step
                      step={1}
                      label="Billing Record Created"
                      description="Multi-period financial invoice generated"
                    />
                    <Step
                      step={2}
                      label="Payment Settled"
                      description="Manual payment recorded & locked"
                    />
                  </Stepper>
                </Card>

                <MetadataList columns={2} title={<Heading level={4}>Account Summary</Heading>}>
                  <MetadataListItem label="Account ID (16-char)">
                    <CopyableId value={record.accountId} label="Account ID" />
                  </MetadataListItem>
                  <MetadataListItem label="Order ID (11-char)">
                    <CopyableId value={record.orderId} label="Order ID" />
                  </MetadataListItem>
                  <MetadataListItem label="Customer Name">
                    {record.customerName}
                  </MetadataListItem>
                  <MetadataListItem label="Service Plan">
                    {record.planName}
                  </MetadataListItem>
                  <MetadataListItem label="Service Type">
                    {parsedMeta ? (
                      <ServiceTypeToken type={parsedMeta.serviceType} />
                    ) : (
                      <Text type="supporting">Unknown</Text>
                    )}
                  </MetadataListItem>
                  <MetadataListItem label="Territory City">
                    {formatCityLabel(parsedMeta?.cityCode, citiesByCode)}
                  </MetadataListItem>
                  <MetadataListItem label="Connection Count">
                    <Text weight="medium">
                      {record.connectionCount && record.connectionCount > 1
                        ? `${record.connectionCount} lines (Bulk Order)`
                        : '1 line (Standard)'}
                    </Text>
                  </MetadataListItem>
                  <MetadataListItem label="Billing Status">
                    <BillingStatusPill status={record.status} />
                  </MetadataListItem>
                  <MetadataListItem label="Connection Status">
                    <OrderStatusPill status={record.connectionStatus ?? 'Active'} />
                  </MetadataListItem>
                  <MetadataListItem label="Deposit Refund">
                    <HStack gap={1.5} vAlign="center" wrap="wrap">
                      <Token
                        size="sm"
                        color={getRefundTokenColor(record.refundStatus)}
                        label={record.refundStatus || 'None'}
                      />
                      {(record.refundAmount ?? 0) > 0 && (
                        <Text weight="semibold" hasTabularNumbers>
                          {formatUsd(record.refundAmount ?? 0)}
                        </Text>
                      )}
                      {record.refundedAt && (
                        <Text type="supporting">
                          <Timestamp value={record.refundedAt} format="date_time" timezoneID="UTC" />
                        </Text>
                      )}
                    </HStack>
                  </MetadataListItem>
                </MetadataList>

                <Divider />

                {/* Financial Breakdown Section */}
                <VStack gap={3}>
                  <HStack hAlign="between" vAlign="center">
                    <Heading level={4}>Financial Breakdown (Detailed Invoice)</Heading>
                    {record.invoiceNumber ? (
                      <Token size="sm" color="blue" label={`Invoice #${record.invoiceNumber}`} />
                    ) : null}
                  </HStack>

                  <Card padding={4}>
                    <MetadataList columns={2}>
                      <MetadataListItem label="Billing Period">
                        {record.billingPeriodStart ? (
                          <Text>
                            <Timestamp value={record.billingPeriodStart} format="date" />
                            {' — '}
                            {record.billingPeriodEnd ? (
                              <Timestamp value={record.billingPeriodEnd} format="date" />
                            ) : (
                              'Now'
                            )}
                          </Text>
                        ) : (
                          <Text type="supporting">Initial Billing Cycle</Text>
                        )}
                      </MetadataListItem>
                      <MetadataListItem label="Plan Rental">
                        <Text weight="semibold">
                          {formatUsd(record.rentalAmount ?? record.amount)}
                        </Text>
                      </MetadataListItem>
                      <MetadataListItem label="Call Usage Charges">
                        <VStack gap={1}>
                          <Text weight="semibold">
                            {formatUsd(record.callUsageAmount ?? 0)}
                          </Text>
                          {(record.localMinutes || record.stdMinutes || record.mobileMinutes) ? (
                            <Text type="eyebrow">
                              {[
                                record.localMinutes ? `${record.localMinutes}m local` : null,
                                record.stdMinutes ? `${record.stdMinutes}m STD` : null,
                                record.mobileMinutes ? `${record.mobileMinutes}m mob` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          ) : null}
              </VStack>
                      </MetadataListItem>
                      <MetadataListItem label="Damaged Equipment Fee">
                        <Text weight="semibold">
                          {formatUsd(record.equipmentFee ?? 0)}
                        </Text>
                      </MetadataListItem>
                      <MetadataListItem label="Gross Subtotal">
                        <Text weight="semibold">
                          {formatUsd(record.subtotal ?? (record.rentalAmount ?? record.amount))}
                        </Text>
                      </MetadataListItem>
                      <MetadataListItem label="Bulk Discount">
                        <Text weight="semibold">
                          {record.discountPercent && record.discountPercent > 0
                            ? `${record.discountPercent}% (-${formatUsd(record.discountAmount ?? 0)})`
                            : '$0.00 (0%)'}
                        </Text>
                      </MetadataListItem>
                      <MetadataListItem label="Service Tax (12.24%)">
                        <Text weight="semibold">{formatUsd(record.taxAmount ?? 0)}</Text>
                      </MetadataListItem>
                      <MetadataListItem label="Refundable Security Deposit">
                        <Text weight="semibold">{formatUsd(record.depositAmount ?? 0)}</Text>
                      </MetadataListItem>
                      <MetadataListItem label="Previous Due / Arrears">
                        <Text weight="semibold">
                          {formatUsd(record.previousDueBalance ?? 0)}
                        </Text>
                      </MetadataListItem>
                      <MetadataListItem label="Total Invoiced Amount">
                        <Text weight="bold">{formatUsd(record.totalAmount ?? record.amount)}</Text>
                      </MetadataListItem>
                      <MetadataListItem label="Total Amount Paid">
                        <Text weight="semibold">
                          {formatUsd(
                            record.paidAmount ?? (record.status === 'Paid' ? record.amount : 0),
                          )}
                        </Text>
                      </MetadataListItem>
                      <MetadataListItem label="Current Balance Due">
                        <Text weight="bold">
                          {formatUsd(effectiveDue)}
                        </Text>
                      </MetadataListItem>
                    </MetadataList>
                  </Card>
              </VStack>

                {/* Form to Generate Next / Custom Invoice */}
                {record.status === 'NotBilled' || showInvoiceForm ? (
                  <Card padding={4}>
                    <form onSubmit={(e) => void handleGenerateInvoiceSubmit(e)}>
                      <VStack gap={3}>
                        <HStack hAlign="between" vAlign="center">
                          <Heading level={4}>
                            {record.status === 'NotBilled'
                              ? 'Generate Initial Invoice'
                              : 'Generate Next Period Invoice'}
                          </Heading>
                          {record.status !== 'NotBilled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              label="Cancel"
                              onClick={() => setShowInvoiceForm(false)}
                            />
                          )}
                        </HStack>

                        <Text type="supporting">
                          Calculate plan rental with bulk discount brackets, 12.24% service tax,
                          refundable security deposit, and optional landline call or equipment charges.
                        </Text>

                        <FormLayout>
                          {isLandline && (
                            <>
                              <TextInput
                                label="Local Call Minutes"
                                placeholder="0"
                                inputMode="numeric"
                                value={localMins}
                                onChange={(val) => {
                                  setLocalMins(val);
                                  setInvoiceErrors((prev) => ({ ...prev, localMins: undefined }));
                                }}
                                status={
                                  invoiceErrors.localMins
                                    ? { type: 'error', message: invoiceErrors.localMins }
                                    : undefined
                                }
                                description="Per-minute local call charge per subscriber plan tariff."
                              />
                              <TextInput
                                label="STD Call Minutes"
                                placeholder="0"
                                inputMode="numeric"
                                value={stdMins}
                                onChange={(val) => {
                                  setStdMins(val);
                                  setInvoiceErrors((prev) => ({ ...prev, stdMins: undefined }));
                                }}
                                status={
                                  invoiceErrors.stdMins
                                    ? { type: 'error', message: invoiceErrors.stdMins }
                                    : undefined
                                }
                                description="Per-minute tariff for STD inter-city trunk calls."
                              />
                              <TextInput
                                label="Messaging for Mobiles (Minutes)"
                                placeholder="0"
                                inputMode="numeric"
                                value={mobileMins}
                                onChange={(val) => {
                                  setMobileMins(val);
                                  setInvoiceErrors((prev) => ({ ...prev, mobileMins: undefined }));
                                }}
                                status={
                                  invoiceErrors.mobileMins
                                    ? { type: 'error', message: invoiceErrors.mobileMins }
                                    : undefined
                                }
                                description="Fixed-to-mobile minutes tariff."
                              />
                            </>
                          )}
                          <TextInput
                            label="Damaged Equipment Replacement Fee ($)"
                            placeholder="0.00"
                            inputMode="decimal"
                            value={equipFee}
                            onChange={(val) => {
                              setEquipFee(val);
                              setInvoiceErrors((prev) => ({ ...prev, equipFee: undefined }));
                            }}
                            status={
                              invoiceErrors.equipFee
                                ? { type: 'error', message: invoiceErrors.equipFee }
                                : undefined
                            }
                            description="Fee for customer-damaged modems, routers, or wiring."
                          />
                          <CheckboxInput
                            label="Include Refundable Security Deposit"
                            description="First invoice includes deposit by default; uncheck to omit or check to include on subsequent cycles."
                            value={includeDeposit}
                            onChange={setIncludeDeposit}
                          />
                          <DateInput
                            label="Billing Period Start (Optional)"
                            description="Defaults to current UTC date if omitted."
                            value={periodStart}
                            onChange={(val) => {
                              setPeriodStart(val);
                              setInvoiceErrors((prev) => ({ ...prev, periodEnd: undefined }));
                            }}
                            hasClear
                          />
                          <DateInput
                            label="Billing Period End (Optional)"
                            description="Defaults from plan validity cycle if omitted."
                            value={periodEnd}
                            min={periodStart}
                            onChange={(val) => {
                              setPeriodEnd(val);
                              setInvoiceErrors((prev) => ({ ...prev, periodEnd: undefined }));
                            }}
                            status={
                              invoiceErrors.periodEnd
                                ? { type: 'error', message: invoiceErrors.periodEnd }
                                : undefined
                            }
                            hasClear
                          />
                        </FormLayout>

                        <HStack hAlign="end" gap={2}>
                          <Button
                            type="submit"
                            variant="primary"
                            label={record.status === 'NotBilled' ? 'Generate Invoice' : 'Issue Next Invoice'}
                            isLoading={actionLoading}
                            isDisabled={actionLoading}
                          />
                        </HStack>
              </VStack>
                    </form>
                  </Card>
                ) : null}

                {/* Form to Record Payment */}
                {(record.status === 'Unpaid' || record.status === 'PartiallyPaid') && showPaymentForm ? (
                  <Card padding={4}>
                    <form onSubmit={(e) => void handleRecordPaymentSubmit(e)}>
                      <VStack gap={3}>
                        <HStack hAlign="between" vAlign="center">
                          <Heading level={4}>Record Payment Collection</Heading>
                          <Button
                            size="sm"
                            variant="ghost"
                            label="Cancel"
                            onClick={() => setShowPaymentForm(false)}
                          />
                        </HStack>

                        <FormLayout>
                          <TextInput
                            label="Payment Amount ($)"
                            placeholder={String(effectiveDue)}
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
                            description={`Total balance due is ${formatUsd(effectiveDue)}. Supports partial payment.`}
                            isRequired
                          />
                          <TextInput
                            label="Payment Reference / Note"
                            placeholder="e.g. Cheque #4501, City Office Counter"
                            value={paymentNote}
                            onChange={setPaymentNote}
                            description="Optional receipt number, cheque reference, or teller notes."
                          />
                        </FormLayout>

                        <HStack hAlign="end" gap={2}>
                          <Button
                            type="submit"
                            variant="primary"
                            label="Confirm Payment Collection"
                            isLoading={actionLoading}
                            isDisabled={actionLoading}
                          />
                        </HStack>
              </VStack>
                    </form>
                  </Card>
                ) : null}

                {/* Disburse Security Deposit Refund Form */}
                {canDisburseRefund && showRefundForm ? (
                  <Card padding={4}>
                    <form onSubmit={(e) => void handleRefundSubmit(e)}>
                      <VStack gap={3}>
                        <HStack hAlign="between" vAlign="center">
                          <Heading level={4}>Disburse Security Deposit Refund</Heading>
                          <Button
                            size="sm"
                            variant="ghost"
                            label="Cancel"
                            onClick={() => setShowRefundForm(false)}
                          />
                        </HStack>
                        <Text type="supporting">
                          {`Connection is Permanently Inactive. Confirm refund payout of ${formatUsd(record.refundAmount ?? 0)} to the subscriber.`}
                        </Text>
                        <FormLayout>
                          <TextInput
                            label="Refund Disbursement Note (Optional)"
                            placeholder="e.g. Cheque #8901, Counter refund payout"
                            value={refundNote}
                            onChange={setRefundNote}
                            status={
                              refundNote.trim().length > 500
                                ? {
                                    type: 'error',
                                    message: 'Refund note must be 500 characters or fewer.',
                                  }
                                : undefined
                            }
                            isOptional
                          />
                        </FormLayout>
                        <HStack hAlign="end" gap={2}>
                          <Button
                            type="submit"
                            variant="primary"
                            label="Confirm Refund Disbursement"
                            isLoading={actionLoading}
                            isDisabled={actionLoading}
                          />
                        </HStack>
              </VStack>
                    </form>
                  </Card>
                ) : null}

                {/* Invoice History Table */}
                <VStack gap={3}>
                  <Heading level={4}>Invoice History</Heading>
                  {invoiceRows.length > 0 ? (
                    <VStack gap={3}>
                      <Table<InvoiceItemView & Record<string, unknown>>
                        aria-label="Account Invoice History Table"
                        density="compact"
                        columns={invoiceColumns}
                        data={invoicePagination.paginatedItems}
                        rowIndexStart={invoicePagination.rowIndexStart}
                        rowCount={invoicePagination.totalItems}
                        idKey="id"
                      />
                      <TablePaginationFooter
                        page={invoicePagination.page}
                        pageSize={invoicePagination.pageSize}
                        totalItems={invoicePagination.totalItems}
                        onPageChange={invoicePagination.setPage}
                        onPageSizeChange={invoicePagination.setPageSize}
                        label="Invoice history pagination"
                      />
              </VStack>
                  ) : (
                    <Card padding={4} variant="muted">
                      <Text type="supporting">No invoices generated for this account yet.</Text>
                    </Card>
                  )}
              </VStack>

                {/* Payment History Table */}
                <VStack gap={3}>
                  <Heading level={4}>Payment Collection History</Heading>
                  {paymentRows.length > 0 ? (
                    <VStack gap={3}>
                      <Table<PaymentItemView & Record<string, unknown>>
                        aria-label="Payment Transactions Table"
                        density="compact"
                        columns={paymentColumns}
                        data={paymentPagination.paginatedItems}
                        rowIndexStart={paymentPagination.rowIndexStart}
                        rowCount={paymentPagination.totalItems}
                        idKey="id"
                      />
                      <TablePaginationFooter
                        page={paymentPagination.page}
                        pageSize={paymentPagination.pageSize}
                        totalItems={paymentPagination.totalItems}
                        onPageChange={paymentPagination.setPage}
                        onPageSizeChange={paymentPagination.setPageSize}
                        label="Payment history pagination"
                      />
              </VStack>
                  ) : (
                    <Card padding={4} variant="muted">
                      <Text type="supporting">No payment transactions recorded for this account yet.</Text>
                    </Card>
                  )}
              </VStack>

                <Divider />

                {record.status === 'NotBilled' ? (
                  <Banner
                    status="info"
                    container="section"
                    collapsible={false}
                    title="Ready for Invoicing"
                    description="Create a billing record to compute initial multi-period invoice and transition account to Unpaid."
                  />
                ) : record.status === 'Unpaid' ? (
                  <Banner
                    status="warning"
                    container="section"
                    collapsible={false}
                    title="Payment Pending"
                    description={`Outstanding balance of ${formatUsd(effectiveDue)}. Record manual payment once funds are collected.`}
                  />
                ) : record.status === 'PartiallyPaid' ? (
                  <Banner
                    status="warning"
                    container="section"
                    collapsible={false}
                    title="Partially Paid"
                    description={`Remaining balance of ${formatUsd(effectiveDue)}. Additional payments can be recorded.`}
                  />
                ) : (
                  <Banner
                    status="success"
                    container="section"
                    collapsible={false}
                    title="Account Fully Settled"
                    description="All outstanding balances are fully paid and reconciled."
                  />
                )}
                {record.refundStatus === 'Refunded' ? (
                  <Banner
                    status="success"
                    container="section"
                    collapsible={false}
                    title="Security Deposit Refunded"
                    description={`Refunded ${formatUsd(record.refundAmount ?? 0)} upon permanent connection termination.`}
                  />
                ) : null}
              </VStack>
            ) : (
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Failed to load billing account"
                  error={error}
                  onDismiss={onDismissError}
                />
                <EmptyState
                  title="No account selected"
                  description="Look up or choose a connected account to inspect its billing details."
                  icon={<Icon icon="info" />}
                  isCompact
                />
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
              <HStack gap={2} wrap="wrap">
                {record && onRefresh ? (
                  <Button
                    variant="secondary"
                    label="Refresh Status"
                    isLoading={isLoading}
                    isDisabled={isLoading || actionLoading}
                    onClick={() => onRefresh(record.accountId)}
                  />
                ) : null}
              </HStack>
              <HStack gap={2} wrap="wrap">
                {record && record.status === 'NotBilled' && onCreateBill && !showInvoiceForm ? (
                  <Button
                    variant="primary"
                    label="Generate Bill"
                    isLoading={actionLoading}
                    isDisabled={actionLoading || isLoading}
                    onClick={() => {
                      setIncludeDeposit((record.invoices?.length ?? 0) === 0);
                      setPeriodStart(undefined);
                      setPeriodEnd(undefined);
                      setInvoiceErrors({});
                      setShowInvoiceForm(true);
                    }}
                  />
                ) : null}
                {record && record.status !== 'NotBilled' && onCreateBill && !showInvoiceForm ? (
                  <Button
                    variant="secondary"
                    label="Next Period Bill"
                    isLoading={actionLoading}
                    isDisabled={actionLoading || isLoading}
                    onClick={() => {
                      setIncludeDeposit(false);
                      setPeriodStart(undefined);
                      setPeriodEnd(undefined);
                      setInvoiceErrors({});
                      setShowInvoiceForm(true);
                    }}
                  />
                ) : null}
                {canDisburseRefund && !showRefundForm ? (
                  <Button
                    variant="secondary"
                    label="Disburse Refund"
                    isLoading={actionLoading}
                    isDisabled={actionLoading || isLoading}
                    onClick={() => setShowRefundForm(true)}
                  />
                ) : null}
                {record && (record.status === 'Unpaid' || record.status === 'PartiallyPaid') && onRecordPayment && !showPaymentForm ? (
                  <Button
                    variant="primary"
                    label="Record Payment"
                    isLoading={actionLoading}
                    isDisabled={actionLoading || isLoading}
                    onClick={() => {
                      setPaymentAmount(String(effectiveDue));
                      setPaymentAmountError(null);
                      setShowPaymentForm(true);
                    }}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  label="Close"
                  onClick={() => onOpenChange(false)}
                />
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />
    </Drawer>
  );
}
