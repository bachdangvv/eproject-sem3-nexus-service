/**
 * Admin and Billing vendor payment settlement ledger section (GET/POST /api/admin/vendor-payments).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, CopyableId, formatUsd } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  createVendorPayment,
  getPurchases,
  getVendorPayments,
} from '../../services/inventoryApi';
import type {
  PurchaseOrderView,
  VendorPaymentInput,
  VendorPaymentMethod,
  VendorPaymentView,
} from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  validatePositiveDecimal,
  VENDOR_PAYMENT_METHOD_OPTIONS,
  type AdminSectionProps,
  type VendorPaymentRow,
} from './adminTypes';

interface VendorPaymentFormState {
  purchaseOrderId: number | 0;
  amountText: string;
  method: VendorPaymentMethod;
  reference: string;
  note: string;
}

interface VendorPaymentFieldErrors {
  purchaseOrderId?: string;
  amount?: string;
  method?: string;
  reference?: string;
  note?: string;
}

const DEFAULT_PAYMENT_FORM: VendorPaymentFormState = {
  purchaseOrderId: 0,
  amountText: '',
  method: 'BankTransfer',
  reference: '',
  note: '',
};

function formatDateTime(raw: string | null): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return raw;
  }
}

export function VendorPaymentsSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [payments, setPayments] = useState<VendorPaymentView[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [poFilter, setPoFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<VendorPaymentFormState>(DEFAULT_PAYMENT_FORM);
  const [recordFieldErrors, setRecordFieldErrors] = useState<VendorPaymentFieldErrors>({});
  const [recordError, setRecordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const selectedPoId = poFilter !== 'ALL' ? Number(poFilter) : undefined;
        const [paymentData, poData] = await Promise.all([
          getVendorPayments(selectedPoId),
          getPurchases().catch(() => [] as PurchaseOrderView[]),
        ]);
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setPayments(paymentData);
        setPurchases(poData);
        onCountChange(paymentData.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load vendor payments.'));
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [poFilter, onCountChange, onRefreshingChange],
  );

  useEffect(() => {
    const isSilent = hasLoadedOnceRef.current && refreshTrigger > 0;
    hasLoadedOnceRef.current = true;
    void loadData(isSilent);
  }, [loadData, refreshTrigger]);

  const poSelectOptions = useMemo(() => {
    const list = [{ value: 'ALL', label: 'All Purchase Orders' }];
    for (const po of purchases) {
      list.push({
        value: String(po.id),
        label: `${po.orderNumber} - ${po.vendorName} (${formatUsd(po.totalAmount)})`,
      });
    }
    return list;
  }, [purchases]);

  const payablePoOptions = useMemo(() => {
    return purchases
      .filter((po) => po.status !== 'Cancelled')
      .map((po) => {
        const remaining = Math.max(0, po.totalAmount - po.paidAmount);
        return {
          value: String(po.id),
          label: `${po.orderNumber} - ${po.vendorName} (Balance: ${formatUsd(remaining)})`,
        };
      });
  }, [purchases]);

  const selectedPoRemainingBalance = useMemo(() => {
    if (!recordForm.purchaseOrderId) return 0;
    const po = purchases.find((p) => p.id === recordForm.purchaseOrderId);
    if (!po) return 0;
    return Math.max(0, po.totalAmount - po.paidAmount);
  }, [purchases, recordForm.purchaseOrderId]);

  const filteredPayments = useMemo<VendorPaymentRow[]>(() => {
    const needle = searchQuery.trim().toLowerCase();
    return payments
      .filter((item) => {
        if (poFilter !== 'ALL' && String(item.purchaseOrderId) !== poFilter) {
          return false;
        }
        if (methodFilter !== 'ALL' && item.method !== methodFilter) {
          return false;
        }
        if (!needle) return true;
        return (
          item.paymentNumber.toLowerCase().includes(needle) ||
          item.purchaseOrderNumber.toLowerCase().includes(needle) ||
          item.vendorName.toLowerCase().includes(needle) ||
          (item.reference && item.reference.toLowerCase().includes(needle)) ||
          (item.note && item.note.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      .map((item) => ({ ...item }));
  }, [payments, poFilter, methodFilter, searchQuery]);

  const pagination = useClientPagination(filteredPayments, {
    resetKey: `${poFilter}:${methodFilter}:${searchQuery.trim().toLowerCase()}`,
  });

  const totalDisbursed = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  const bankTransferCount = useMemo(
    () => payments.filter((p) => p.method === 'BankTransfer').length,
    [payments],
  );

  const openRecordDialog = () => {
    const nonCancelledPos = purchases.filter((po) => po.status !== 'Cancelled');
    const eligiblePos = nonCancelledPos.filter((po) => po.paidAmount < po.totalAmount);
    const initialPo = eligiblePos.length > 0 ? eligiblePos[0]! : nonCancelledPos[0];
    const initialPoId = initialPo ? initialPo.id : 0;
    const initialBalance = initialPo ? Math.max(0, initialPo.totalAmount - initialPo.paidAmount) : 0;

    setRecordForm({
      purchaseOrderId: initialPoId,
      amountText: initialBalance > 0 ? String(initialBalance) : '100.00',
      method: 'BankTransfer',
      reference: '',
      note: '',
    });
    setRecordFieldErrors({});
    setRecordError(null);
    setIsRecordOpen(true);
  };

  const handlePoChange = (poIdStr: string) => {
    const poId = Number(poIdStr);
    const po = purchases.find((p) => p.id === poId);
    const balance = po ? Math.max(0, po.totalAmount - po.paidAmount) : 0;
    setRecordForm((prev) => ({
      ...prev,
      purchaseOrderId: poId,
      amountText: balance > 0 ? String(balance) : prev.amountText,
    }));
    setRecordFieldErrors((prev) => ({ ...prev, purchaseOrderId: undefined }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const errors: VendorPaymentFieldErrors = {};
    if (!recordForm.purchaseOrderId) {
      errors.purchaseOrderId = 'Please select a purchase order.';
    }

    const amountCheck = validatePositiveDecimal(recordForm.amountText, 'Payment Amount');
    if (!amountCheck.valid || amountCheck.value <= 0) {
      errors.amount = 'Payment amount must be greater than $0.00.';
    }

    if (recordForm.reference.trim().length > 60) {
      errors.reference = 'Reference must be 60 characters or fewer.';
    }

    if (recordForm.note.trim().length > 300) {
      errors.note = 'Note must be 300 characters or fewer.';
    }

    setRecordFieldErrors(errors);
    setRecordError(null);
    if (Object.keys(errors).length > 0) return;

    const payload: VendorPaymentInput = {
      purchaseOrderId: recordForm.purchaseOrderId,
      amount: amountCheck.valid ? amountCheck.value : 0,
      method: recordForm.method,
      reference: recordForm.reference.trim() || null,
      note: recordForm.note.trim() || null,
    };

    setSubmitting(true);
    try {
      const created = await createVendorPayment(payload);
      if (!isMountedRef.current) return;
      setIsRecordOpen(false);
      toast({
        body: `Recorded payment ${created.paymentNumber} of ${formatUsd(created.amount)} to ${created.vendorName}.`,
      });
      pagination.focusItem((item) => item.id === created.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setRecordFieldErrors((prev) => ({
        ...prev,
        purchaseOrderId: serverFields.purchaseorderid ?? prev.purchaseOrderId,
        amount: serverFields.amount ?? prev.amount,
        method: serverFields.method ?? prev.method,
        reference: serverFields.reference ?? prev.reference,
        note: serverFields.note ?? prev.note,
      }));
      setRecordError(extractErrorMessage(err, 'Could not record vendor payment.'));
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const renderMethodBadge = (method: VendorPaymentMethod) => {
    switch (method) {
      case 'BankTransfer':
        return <Token size="sm" color="blue" label="Bank Transfer" />;
      case 'Cheque':
        return <Token size="sm" color="purple" label="Cheque" />;
      case 'Cash':
        return <Token size="sm" color="teal" label="Cash" />;
    }
  };

  const columns: TableColumn<VendorPaymentRow>[] = [
    {
      key: 'paymentNumber',
      header: 'Payment #',
      width: pixel(195),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <CopyableId value={row.paymentNumber} label="Payment #" />
          <Text type="supporting" size="sm">
            {formatDateTime(row.paidAt)}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'purchaseOrder',
      header: 'Purchase Order',
      width: pixel(195),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <CopyableId value={row.purchaseOrderNumber} label="PO" />
          <Text type="supporting" size="sm">
            {row.vendorName}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'amount',
      header: 'Amount Paid',
      width: pixel(140),
      renderCell: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatUsd(row.amount)}
        </Text>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      width: pixel(150),
      renderCell: (row) => renderMethodBadge(row.method),
    },
    {
      key: 'reference',
      header: 'Payment Reference',
      width: proportional(1.5, { minWidth: 160 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text type="body">{row.reference ? row.reference : '—'}</Text>
          {row.note && (
            <Text type="supporting" size="sm">
              {row.note}
            </Text>
          )}
        </VStack>
      ),
    },
  ];

  const methodOptions = [
    { value: 'ALL', label: 'All Methods' },
    { value: 'BankTransfer', label: 'Bank Transfer' },
    { value: 'Cheque', label: 'Cheque' },
    { value: 'Cash', label: 'Cash' },
  ];

  return (
    <VStack gap={5}>
      <Grid columns={{ minWidth: 200, max: 3 }} gap={4}>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Total Payments Recorded
            </Text>
            <Heading level={2} type="display-3">
              {payments.length}
            </Heading>
            <Text type="supporting" size="sm">
              Vendor disbursement transactions
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Total Amount Disbursed
            </Text>
            <Heading level={2} type="display-3">
              {formatUsd(totalDisbursed)}
            </Heading>
            <Text type="supporting" size="sm">
              Paid to equipment suppliers
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Electronic Transfers
            </Text>
            <Heading level={2} type="display-3">
              {bankTransferCount}
            </Heading>
            <Text type="supporting" size="sm">
              Direct bank wire transactions
            </Text>
          </VStack>
        </Card>
      </Grid>

      <Card padding={6}>
        <VStack gap={5}>
          <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Vendor Payments Ledger</Heading>
              <Badge variant="neutral" label={`${filteredPayments.length} payments`} />
            </HStack>

            <HStack gap={2} vAlign="end" wrap="wrap">
              <Selector
                label="Filter by PO"
                isLabelHidden
                options={poSelectOptions}
                value={poFilter}
                onChange={setPoFilter}
              />
              <Selector
                label="Payment Method"
                isLabelHidden
                options={methodOptions}
                value={methodFilter}
                onChange={setMethodFilter}
              />
              <TextInput
                type="search"
                label="Filter Payments"
                isLabelHidden
                placeholder="Search payment #, vendor, ref..."
                startIcon={<Icon icon="search" />}
                hasClear
                width={220}
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <Button variant="primary" label="Record Payment" onClick={openRecordDialog} />
            </HStack>
          </HStack>

          <ApiErrorBanner
            title="Vendor payments error"
            error={loadError}
            onDismiss={() => setLoadError(null)}
          />

          {loading && payments.length === 0 ? (
            <Center padding={8}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading vendor payments..." />
                <Text type="supporting">Fetching settlement history...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<VendorPaymentRow>
                aria-label="Vendor Payments Ledger"
                density="compact"
                dividers="rows"
                hasHover
                idKey="id"
                columns={columns}
                data={pagination.paginatedItems}
                rowIndexStart={pagination.rowIndexStart}
                rowCount={pagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No payments found"
                    description={
                      searchQuery.trim() || poFilter !== 'ALL' || methodFilter !== 'ALL'
                        ? 'No payment records match your active search filters.'
                        : 'Record vendor disbursements and settlements for open purchase orders.'
                    }
                    icon={<Icon icon="info" />}
                    actions={
                      searchQuery.trim() || poFilter !== 'ALL' || methodFilter !== 'ALL' ? (
                        <Button
                          variant="secondary"
                          label="Reset Filters"
                          onClick={() => {
                            setSearchQuery('');
                            setPoFilter('ALL');
                            setMethodFilter('ALL');
                          }}
                        />
                      ) : (
                        <Button variant="primary" label="Record Payment" onClick={openRecordDialog} />
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
                label="Vendor payments pagination"
              />
            </>
          )}
        </VStack>

        <Drawer
          isOpen={isRecordOpen}
          onOpenChange={(open) => {
            if (!open && !submitting) setIsRecordOpen(false);
          }}
          purpose="form"
          side="end"
          width={480}
          label="Record Vendor Payment"
        >
          <Layout
            header={
              <DrawerHeader
                title="Record Vendor Payment"
                subtitle="Disburse funds for an equipment procurement order."
                onOpenChange={(open) => {
                  if (!open && !submitting) setIsRecordOpen(false);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not record payment"
                    error={recordError}
                    onDismiss={() => setRecordError(null)}
                  />
                  <form id="record-payment-form" onSubmit={(e) => void handleSubmit(e)}>
                    <FormLayout>
                      <Selector
                        label="Purchase Order"
                        isRequired
                        options={payablePoOptions}
                        value={String(recordForm.purchaseOrderId)}
                        onChange={handlePoChange}
                        status={
                          recordFieldErrors.purchaseOrderId
                            ? { type: 'error', message: recordFieldErrors.purchaseOrderId }
                            : undefined
                        }
                      />

                      {recordForm.purchaseOrderId > 0 && (
                        <Card padding={3}>
                          <HStack hAlign="between" vAlign="center">
                            <Text type="supporting" size="sm">
                              Remaining Balance on Order:
                            </Text>
                            <Text weight="semibold" hasTabularNumbers>
                              {formatUsd(selectedPoRemainingBalance)}
                            </Text>
                          </HStack>
                        </Card>
                      )}

                      <TextInput
                        label="Payment Amount (USD)"
                        inputMode="decimal"
                        placeholder="e.g. 500.00"
                        description="Amount transferred or disbursed."
                        isRequired
                        value={recordForm.amountText}
                        onChange={(value) => {
                          setRecordForm((prev) => ({ ...prev, amountText: value }));
                          setRecordFieldErrors((prev) => ({ ...prev, amount: undefined }));
                        }}
                        status={
                          recordFieldErrors.amount
                            ? { type: 'error', message: recordFieldErrors.amount }
                            : undefined
                        }
                      />

                      <Selector
                        label="Disbursement Method"
                        isRequired
                        options={VENDOR_PAYMENT_METHOD_OPTIONS}
                        value={recordForm.method}
                        onChange={(value) => {
                          setRecordForm((prev) => ({
                            ...prev,
                            method: value as VendorPaymentMethod,
                          }));
                          setRecordFieldErrors((prev) => ({ ...prev, method: undefined }));
                        }}
                        status={
                          recordFieldErrors.method
                            ? { type: 'error', message: recordFieldErrors.method }
                            : undefined
                        }
                      />

                      <TextInput
                        label="Transaction / Cheque Reference"
                        placeholder="e.g. WIRE-20261120-9428 or CHQ-00129"
                        description="Bank transaction reference or cheque number."
                        value={recordForm.reference}
                        onChange={(value) => {
                          setRecordForm((prev) => ({ ...prev, reference: value }));
                          setRecordFieldErrors((prev) => ({ ...prev, reference: undefined }));
                        }}
                        status={
                          recordFieldErrors.reference
                            ? { type: 'error', message: recordFieldErrors.reference }
                            : undefined
                        }
                      />

                      <TextArea
                        label="Payment Note / Description"
                        placeholder="Bank account, branch, remittance details..."
                        isOptional
                        rows={3}
                        maxLength={300}
                        value={recordForm.note}
                        onChange={(value) => {
                          setRecordForm((prev) => ({ ...prev, note: value }));
                          setRecordFieldErrors((prev) => ({ ...prev, note: undefined }));
                        }}
                        status={
                          recordFieldErrors.note
                            ? { type: 'error', message: recordFieldErrors.note }
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
                    isDisabled={submitting}
                    onClick={() => setIsRecordOpen(false)}
                  />
                  <Button
                    type="submit"
                    form="record-payment-form"
                    variant="primary"
                    label="Record Payment"
                    isLoading={submitting}
                    isDisabled={submitting}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Drawer>
      </Card>
    </VStack>
  );
}
