/**
 * Admin hardware purchase order lifecycle section (GET/POST /api/admin/purchases, receive/cancel).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
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
import { ApiErrorBanner, CopyableId, formatUsd, StatusLabel } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { getProducts } from '../../services/catalogApi';
import {
  cancelPurchase,
  createPurchase,
  getPurchases,
  getVendors,
  receivePurchase,
} from '../../services/inventoryApi';
import type {
  ProductView,
  PurchaseOrderInput,
  PurchaseOrderStatus,
  PurchaseOrderView,
  VendorView,
} from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  PURCHASE_STATUS_OPTIONS,
  validatePositiveInteger,
  validateUnitPrice,
  type AdminSectionProps,
  type PurchaseOrderRow,
} from './adminTypes';

interface PurchaseFormState {
  vendorId: number | 0;
  productId: number | 0;
  quantityText: string;
  unitPriceText: string;
  note: string;
}

interface PurchaseFieldErrors {
  vendorId?: string;
  productId?: string;
  quantity?: string;
  unitPrice?: string;
  note?: string;
}

const DEFAULT_PURCHASE_FORM: PurchaseFormState = {
  vendorId: 0,
  productId: 0,
  quantityText: '10',
  unitPriceText: '',
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

export function PurchasesSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [purchases, setPurchases] = useState<PurchaseOrderView[]>([]);
  const [vendors, setVendors] = useState<VendorView[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PurchaseFormState>(DEFAULT_PURCHASE_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<PurchaseFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [receivingPo, setReceivingPo] = useState<PurchaseOrderView | null>(null);
  const [receiving, setReceiving] = useState(false);

  const [cancellingPo, setCancellingPo] = useState<PurchaseOrderView | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
        const [poData, vendorData, prodData] = await Promise.all([
          getPurchases(statusFilter !== 'ALL' ? statusFilter : undefined),
          getVendors().catch(() => [] as VendorView[]),
          getProducts().catch(() => [] as ProductView[]),
        ]);
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setPurchases(poData);
        setVendors(vendorData);
        setProducts(prodData);
        onCountChange(poData.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load purchase orders.'));
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [statusFilter, onCountChange, onRefreshingChange],
  );

  useEffect(() => {
    const isSilent = hasLoadedOnceRef.current && refreshTrigger > 0;
    hasLoadedOnceRef.current = true;
    void loadData(isSilent);
  }, [loadData, refreshTrigger]);

  const activeVendors = useMemo(() => vendors.filter((v) => v.active), [vendors]);
  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const vendorSelectOptions = useMemo(() => {
    return activeVendors.map((v) => ({
      value: String(v.id),
      label: `${v.code} - ${v.name}`,
    }));
  }, [activeVendors]);

  const productSelectOptions = useMemo(() => {
    return activeProducts.map((p) => ({
      value: String(p.id),
      label: `${p.name} (Stock: ${p.quantityInStock})`,
    }));
  }, [activeProducts]);

  const filteredPurchases = useMemo<PurchaseOrderRow[]>(() => {
    const needle = searchQuery.trim().toLowerCase();
    return purchases
      .filter((item) => {
        if (statusFilter !== 'ALL' && item.status !== statusFilter) {
          return false;
        }
        if (!needle) return true;
        return (
          item.orderNumber.toLowerCase().includes(needle) ||
          item.vendorName.toLowerCase().includes(needle) ||
          item.productName.toLowerCase().includes(needle) ||
          (item.note && item.note.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
      .map((item) => ({ ...item }));
  }, [purchases, statusFilter, searchQuery]);

  const pagination = useClientPagination(filteredPurchases, {
    resetKey: `${statusFilter}:${searchQuery.trim().toLowerCase()}`,
  });

  const orderedCount = useMemo(() => purchases.filter((p) => p.status === 'Ordered').length, [purchases]);
  const receivedCount = useMemo(() => purchases.filter((p) => p.status === 'Received').length, [purchases]);
  const totalSpend = useMemo(
    () => purchases.filter((p) => p.status !== 'Cancelled').reduce((sum, p) => sum + p.totalAmount, 0),
    [purchases],
  );

  // Live total calculation for purchase order form
  const parsedQty = Number(createForm.quantityText) || 0;
  const parsedPrice = Number(createForm.unitPriceText) || 0;
  const liveTotalAmount = parsedQty > 0 && parsedPrice > 0 ? parsedQty * parsedPrice : 0;

  const openCreateDialog = () => {
    const initialVendor = activeVendors.length > 0 ? activeVendors[0]!.id : 0;
    const initialProduct = activeProducts.length > 0 ? activeProducts[0]!.id : 0;
    const defaultPrice =
      activeProducts.length > 0 ? String(activeProducts[0]!.replacementPrice || '50.00') : '50.00';

    setCreateForm({
      vendorId: initialVendor,
      productId: initialProduct,
      quantityText: '20',
      unitPriceText: defaultPrice,
      note: '',
    });
    setCreateFieldErrors({});
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleProductChange = (productIdStr: string) => {
    const prodId = Number(productIdStr);
    const prod = activeProducts.find((p) => p.id === prodId);
    setCreateForm((prev) => ({
      ...prev,
      productId: prodId,
      unitPriceText: prod && prod.replacementPrice > 0 ? String(prod.replacementPrice) : prev.unitPriceText,
    }));
    setCreateFieldErrors((prev) => ({ ...prev, productId: undefined }));
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;

    const errors: PurchaseFieldErrors = {};
    if (!createForm.vendorId) {
      errors.vendorId = 'Please select a hardware vendor.';
    }
    if (!createForm.productId) {
      errors.productId = 'Please select an equipment product.';
    }

    const qtyCheck = validatePositiveInteger(createForm.quantityText, 'Quantity', 100000);
    if (!qtyCheck.valid || qtyCheck.value <= 0) {
      errors.quantity = qtyCheck.valid ? 'Quantity must be at least 1 unit.' : qtyCheck.message;
    }

    const priceCheck = validateUnitPrice(createForm.unitPriceText, 'Unit Price');
    if (!priceCheck.valid) {
      errors.unitPrice = priceCheck.message;
    }

    if (createForm.note.trim().length > 300) {
      errors.note = 'Note must be 300 characters or fewer.';
    }

    setCreateFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length > 0) return;

    const payload: PurchaseOrderInput = {
      vendorId: createForm.vendorId,
      productId: createForm.productId,
      quantity: qtyCheck.valid ? qtyCheck.value : 0,
      unitPrice: priceCheck.valid ? priceCheck.value : 0,
      note: createForm.note.trim() || null,
    };

    setCreating(true);
    try {
      const created = await createPurchase(payload);
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      toast({ body: `Purchase order ${created.orderNumber} placed to ${created.vendorName}.` });
      pagination.focusItem((item) => item.id === created.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setCreateFieldErrors((prev) => ({
        ...prev,
        vendorId: serverFields.vendorid ?? prev.vendorId,
        productId: serverFields.productid ?? prev.productId,
        quantity: serverFields.quantity ?? prev.quantity,
        unitPrice: serverFields.unitprice ?? prev.unitPrice,
        note: serverFields.note ?? prev.note,
      }));
      setCreateError(extractErrorMessage(err, 'Could not create purchase order.'));
    } finally {
      if (isMountedRef.current) setCreating(false);
    }
  };

  const handleConfirmReceive = async () => {
    if (receiving || !receivingPo) return;
    setReceiving(true);
    setLoadError(null);
    try {
      const updated = await receivePurchase(receivingPo.id);
      if (!isMountedRef.current) return;
      setReceivingPo(null);
      toast({
        body: `Purchase order ${updated.orderNumber} marked as Received. Stock increased by ${updated.quantity} units!`,
      });
      pagination.focusItem((item) => item.id === updated.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setReceivingPo(null);
      setLoadError(extractErrorMessage(err, 'Failed to mark purchase order as received.'));
    } finally {
      if (isMountedRef.current) setReceiving(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (cancelling || !cancellingPo) return;
    setCancelling(true);
    setLoadError(null);
    try {
      const updated = await cancelPurchase(cancellingPo.id);
      if (!isMountedRef.current) return;
      setCancellingPo(null);
      toast({ body: `Purchase order ${updated.orderNumber} cancelled.` });
      pagination.focusItem((item) => item.id === updated.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setCancellingPo(null);
      setLoadError(extractErrorMessage(err, 'Failed to cancel purchase order.'));
    } finally {
      if (isMountedRef.current) setCancelling(false);
    }
  };

  const renderStatus = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'Ordered':
        return <Token size="sm" color="orange" label="Ordered" />;
      case 'Received':
        return <Token size="sm" color="green" label="Received (Stock In)" />;
      case 'Cancelled':
        return <Token size="sm" color="gray" label="Cancelled" />;
    }
  };

  const renderPaymentStatus = (row: PurchaseOrderRow) => {
    const isPaid = row.paymentStatus === 'Paid';
    const isPartial = row.paymentStatus === 'PartiallyPaid';
    return (
      <VStack gap={0.5}>
        <HStack gap={1.5} vAlign="center" wrap="nowrap">
          {isPaid ? (
            <StatusLabel variant="success" label="Fully Paid" />
          ) : isPartial ? (
            <StatusLabel variant="warning" label="Partially Paid" />
          ) : (
            <StatusLabel variant="error" label="Unpaid" />
          )}
        </HStack>
        <Text type="supporting" size="sm" hasTabularNumbers>
          {`${formatUsd(row.paidAmount)} / ${formatUsd(row.totalAmount)}`}
        </Text>
      </VStack>
    );
  };

  const columns: TableColumn<PurchaseOrderRow>[] = [
    {
      key: 'orderNumber',
      header: 'PO Number',
      width: pixel(180),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <CopyableId value={row.orderNumber} label="PO" />
          <Text type="supporting" size="sm">
            {formatDateTime(row.orderedAt)}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor & Product',
      width: proportional(1.6, { minWidth: 180 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.vendorName}</Text>
          <Text type="supporting" size="sm">
            {row.productName}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty & Unit Price',
      width: pixel(140),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold" hasTabularNumbers>
            {`${row.quantity} units`}
          </Text>
          <Text type="supporting" size="sm" hasTabularNumbers>
            {`@ ${formatUsd(row.unitPrice)}`}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total Value',
      width: pixel(130),
      renderCell: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatUsd(row.totalAmount)}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Order Status',
      width: pixel(160),
      renderCell: (row) => (
        <VStack gap={0.5}>
          {renderStatus(row.status)}
          {row.receivedAt && (
            <Text type="supporting" size="sm">
              {`In: ${formatDateTime(row.receivedAt)}`}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Payment Status',
      width: pixel(160),
      renderCell: (row) => renderPaymentStatus(row),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(170),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={2} hAlign="end" wrap="nowrap">
          {row.status === 'Ordered' ? (
            <>
              <Button
                size="sm"
                variant="primary"
                label="Receive"
                onClick={() => setReceivingPo(row)}
              />
              <Button
                size="sm"
                variant="ghost"
                label="Cancel"
                onClick={() => setCancellingPo(row)}
              />
            </>
          ) : (
            <Text type="supporting" size="sm">
              {row.status === 'Received' ? 'Stock Added' : 'Closed'}
            </Text>
          )}
        </HStack>
      ),
    },
  ];

  return (
    <VStack gap={5}>
      <Grid columns={{ minWidth: 200, max: 4 }} gap={4}>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Total Purchase Orders
            </Text>
            <Heading level={2} type="display-3">
              {purchases.length}
            </Heading>
            <Text type="supporting" size="sm">
              Equipment procurement lists
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Pending Delivery
            </Text>
            <Heading level={2} type="display-3">
              {orderedCount}
            </Heading>
            <Text type="supporting" size="sm">
              Ordered, waiting for stock-in
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Received into Stock
            </Text>
            <Heading level={2} type="display-3">
              {receivedCount}
            </Heading>
            <Text type="supporting" size="sm">
              Inventory replenished
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Procurement Value
            </Text>
            <Heading level={2} type="display-3">
              {formatUsd(totalSpend)}
            </Heading>
            <Text type="supporting" size="sm">
              Committed hardware spend
            </Text>
          </VStack>
        </Card>
      </Grid>

      <Card padding={6}>
        <VStack gap={5}>
          <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Equipment Purchases & Orders</Heading>
              <Badge variant="neutral" label={`${filteredPurchases.length} orders`} />
            </HStack>

            <HStack gap={2} vAlign="end" wrap="wrap">
              <Selector
                label="Status Filter"
                isLabelHidden
                options={PURCHASE_STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <TextInput
                type="search"
                label="Filter Orders"
                isLabelHidden
                placeholder="Search PO #, vendor, product..."
                startIcon={<Icon icon="search" />}
                hasClear
                width={250}
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <Button variant="primary" label="New Purchase Order" onClick={openCreateDialog} />
            </HStack>
          </HStack>

          <ApiErrorBanner
            title="Purchase orders error"
            error={loadError}
            onDismiss={() => setLoadError(null)}
          />

          {loading && purchases.length === 0 ? (
            <Center padding={8}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading purchase orders..." />
                <Text type="supporting">Fetching vendor procurement records...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<PurchaseOrderRow>
                aria-label="Equipment Purchase Orders"
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
                    title="No purchase orders found"
                    description={
                      searchQuery.trim() || statusFilter !== 'ALL'
                        ? 'No purchase orders match your current filters.'
                        : 'Place equipment orders to suppliers to stock modems, routers, and installation hardware.'
                    }
                    icon={<Icon icon="info" />}
                    actions={
                      searchQuery.trim() || statusFilter !== 'ALL' ? (
                        <Button
                          variant="secondary"
                          label="Reset Filters"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                          }}
                        />
                      ) : (
                        <Button variant="primary" label="New Purchase Order" onClick={openCreateDialog} />
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
                label="Purchases pagination"
              />
            </>
          )}
        </VStack>

        <Drawer
          isOpen={isCreateOpen}
          onOpenChange={(open) => {
            if (!open && !creating) setIsCreateOpen(false);
          }}
          purpose="form"
          side="end"
          width={500}
          label="Place Purchase Order"
        >
          <Layout
            header={
              <DrawerHeader
                title="Place Equipment Purchase Order"
                subtitle="Issue a procurement order to an equipment vendor."
                onOpenChange={(open) => {
                  if (!open && !creating) setIsCreateOpen(false);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not place order"
                    error={createError}
                    onDismiss={() => setCreateError(null)}
                  />
                  <form id="create-po-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                    <FormLayout>
                      <Selector
                        label="Equipment Vendor"
                        isRequired
                        options={vendorSelectOptions}
                        value={String(createForm.vendorId)}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, vendorId: Number(value) }));
                          setCreateFieldErrors((prev) => ({ ...prev, vendorId: undefined }));
                        }}
                        status={
                          createFieldErrors.vendorId
                            ? { type: 'error', message: createFieldErrors.vendorId }
                            : undefined
                        }
                      />
                      <Selector
                        label="Hardware Product"
                        isRequired
                        options={productSelectOptions}
                        value={String(createForm.productId)}
                        onChange={handleProductChange}
                        status={
                          createFieldErrors.productId
                            ? { type: 'error', message: createFieldErrors.productId }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Quantity to Order"
                        inputMode="numeric"
                        placeholder="e.g. 50"
                        description="Units to manufacture and ship."
                        isRequired
                        value={createForm.quantityText}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, quantityText: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, quantity: undefined }));
                        }}
                        status={
                          createFieldErrors.quantity
                            ? { type: 'error', message: createFieldErrors.quantity }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Unit Price (USD)"
                        inputMode="decimal"
                        placeholder="e.g. 45.00"
                        description="Price per unit agreed with vendor."
                        isRequired
                        value={createForm.unitPriceText}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, unitPriceText: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, unitPrice: undefined }));
                        }}
                        status={
                          createFieldErrors.unitPrice
                            ? { type: 'error', message: createFieldErrors.unitPrice }
                            : undefined
                        }
                      />

                      <Card padding={4}>
                        <HStack hAlign="between" vAlign="center">
                          <VStack gap={0.5}>
                            <Text type="supporting" size="sm">
                              Calculated Total Order Amount
                            </Text>
                            <Heading level={2} type="display-3">
                              {formatUsd(liveTotalAmount)}
                            </Heading>
                          </VStack>
                          <Token
                            size="sm"
                            color="blue"
                            label={`${parsedQty} units @ ${formatUsd(parsedPrice)}`}
                          />
                        </HStack>
                      </Card>

                      <TextArea
                        label="Procurement Note / PO Terms"
                        placeholder="Delivery warehouse, expected arrival date, payment terms..."
                        isOptional
                        rows={3}
                        maxLength={300}
                        value={createForm.note}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, note: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, note: undefined }));
                        }}
                        status={
                          createFieldErrors.note
                            ? { type: 'error', message: createFieldErrors.note }
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
                    isDisabled={creating}
                    onClick={() => setIsCreateOpen(false)}
                  />
                  <Button
                    type="submit"
                    form="create-po-form"
                    variant="primary"
                    label="Place Purchase Order"
                    isLoading={creating}
                    isDisabled={creating}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Drawer>

        <AlertDialog
          isOpen={receivingPo !== null}
          onOpenChange={(open) => {
            if (!open && !receiving) setReceivingPo(null);
          }}
          title="Receive Equipment into Inventory?"
          description={
            receivingPo
              ? `Confirming receipt of purchase order "${receivingPo.orderNumber}" will add ${receivingPo.quantity} units of "${receivingPo.productName}" directly to the warehouse inventory stock.`
              : ''
          }
          cancelLabel="Cancel"
          actionLabel="Receive & Stock In"
          actionVariant="primary"
          isActionLoading={receiving}
          onAction={() => void handleConfirmReceive()}
        />

        <AlertDialog
          isOpen={cancellingPo !== null}
          onOpenChange={(open) => {
            if (!open && !cancelling) setCancellingPo(null);
          }}
          title="Cancel Purchase Order?"
          description={
            cancellingPo
              ? `Are you sure you want to cancel purchase order "${cancellingPo.orderNumber}" placed to "${cancellingPo.vendorName}"? This action cannot be reversed.`
              : ''
          }
          cancelLabel="Cancel"
          actionLabel="Cancel Order"
          actionVariant="destructive"
          isActionLoading={cancelling}
          onAction={() => void handleConfirmCancel()}
        />
      </Card>
    </VStack>
  );
}
