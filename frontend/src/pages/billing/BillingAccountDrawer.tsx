import { useState, type FormEvent, type JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
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
import { Spinner } from '@astryxdesign/core/Spinner';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  BillingStatusPill,
  CopyableId,
  ServiceTypeToken,
  formatUsd,
} from '../../components/StatusViews';
import type {
  BillingView,
  CreateInvoiceInput,
  PaymentItemView,
  RecordPaymentInput,
} from '../../types/nexus';
import { formatCityLabel, parseAccountIdMetadata } from './billingTypes';

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
}: BillingAccountDrawerProps): JSX.Element {
  const parsedMeta = record ? parseAccountIdMetadata(record.accountId) : null;
  const isLandline = parsedMeta?.serviceType === 'T';

  const activeStep =
    record?.status === 'Paid' ? 2 : record?.status === 'Unpaid' || record?.status === 'PartiallyPaid' ? 1 : 0;

  // Invoice creation form state
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [localMins, setLocalMins] = useState('0');
  const [stdMins, setStdMins] = useState('0');
  const [mobileMins, setMobileMins] = useState('0');
  const [equipFee, setEquipFee] = useState('0');

  // Payment recording form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const effectiveDue = record?.dueAmount ?? (record?.status === 'Paid' ? 0 : record?.amount ?? 0);

  const handleGenerateInvoiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!record || !onCreateBill) return;
    const input: CreateInvoiceInput = {
      localMinutes: Math.max(0, parseInt(localMins, 10) || 0),
      stdMinutes: Math.max(0, parseInt(stdMins, 10) || 0),
      mobileMinutes: Math.max(0, parseInt(mobileMins, 10) || 0),
      equipmentFee: Math.max(0, parseFloat(equipFee) || 0),
    };
    await onCreateBill(record.accountId, input);
    setShowInvoiceForm(false);
  };

  const handleRecordPaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!record || !onRecordPayment) return;
    const parsedAmount = parseFloat(paymentAmount);
    const input: RecordPaymentInput = {
      amount: !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : effectiveDue,
      channel: 'CityOffice',
      note: paymentNote.trim() || undefined,
    };
    await onRecordPayment(record.accountId, input);
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentNote('');
  };

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
      width: pixel(110),
      renderCell: (p: PaymentItemView & Record<string, unknown>) => (
        <Token
          size="sm"
          color={p.channel === 'RetailOutlet' ? 'purple' : 'blue'}
          label={p.channel === 'RetailOutlet' ? 'Retail Outlet' : 'City Office'}
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
                      <MetadataListItem label="Plan Advance Rental">
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
                                onChange={setLocalMins}
                                description="Unlimited on local plans; $0.55/min beyond base."
                              />
                              <TextInput
                                label="STD Call Minutes"
                                placeholder="0"
                                inputMode="numeric"
                                value={stdMins}
                                onChange={setStdMins}
                                description="Per-minute tariff for STD inter-city trunk calls."
                              />
                              <TextInput
                                label="Messaging for Mobiles (Minutes)"
                                placeholder="0"
                                inputMode="numeric"
                                value={mobileMins}
                                onChange={setMobileMins}
                                description="Fixed-to-mobile minutes tariff."
                              />
                            </>
                          )}
                          <TextInput
                            label="Damaged Equipment Replacement Fee ($)"
                            placeholder="0.00"
                            inputMode="decimal"
                            value={equipFee}
                            onChange={setEquipFee}
                            description="Fee for customer-damaged modems, routers, or wiring."
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
                            value={paymentAmount || String(effectiveDue)}
                            onChange={setPaymentAmount}
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

                {/* Payment History Table */}
                <VStack gap={3}>
                  <Heading level={4}>Payment Collection History</Heading>
                  {record.payments && record.payments.length > 0 ? (
                    <Table<PaymentItemView & Record<string, unknown>>
                      aria-label="Payment Transactions Table"
                      density="compact"
                      columns={paymentColumns}
                      data={record.payments as unknown as (PaymentItemView & Record<string, unknown>)[]}
                      idKey="id"
                    />
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
                    onClick={() => setShowInvoiceForm(true)}
                  />
                ) : null}
                {record && record.status !== 'NotBilled' && onCreateBill && !showInvoiceForm ? (
                  <Button
                    variant="secondary"
                    label="Next Period Bill"
                    isLoading={actionLoading}
                    isDisabled={actionLoading || isLoading}
                    onClick={() => setShowInvoiceForm(true)}
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
