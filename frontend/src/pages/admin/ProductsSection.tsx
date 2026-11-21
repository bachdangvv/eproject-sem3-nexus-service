/**
 * Admin hardware and equipment products catalog section (GET/POST/PUT/DELETE /api/products).
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
import { Spinner } from '@astryxdesign/core/Spinner';
import { Switch } from '@astryxdesign/core/Switch';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, formatUsd, StatusLabel } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  archiveProduct,
  createProduct,
  getProducts,
  updateProduct,
} from '../../services/catalogApi';
import {
  getTechnicalEquipment,
  getTechnicalEquipmentSummary,
} from '../../services/inventoryApi';
import type { EquipmentStockView, ProductInput, ProductView } from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  validatePositiveDecimal,
  validatePositiveInteger,
  type AdminSectionProps,
  type ProductRow,
} from './adminTypes';

interface ProductFormState {
  name: string;
  description: string;
  active: boolean;
  quantityInStockText: string;
  replacementPriceText: string;
}

interface ProductFieldErrors {
  name?: string;
  description?: string;
  quantityInStock?: string;
  replacementPrice?: string;
}

const DEFAULT_PRODUCT_FORM: ProductFormState = {
  name: '',
  description: '',
  active: true,
  quantityInStockText: '0',
  replacementPriceText: '0.00',
};

function validateProductForm(form: ProductFormState): {
  errors: ProductFieldErrors;
  quantityInStock: number;
  replacementPrice: number;
} {
  const errors: ProductFieldErrors = {};
  const trimmedName = form.name.trim();
  if (!trimmedName) {
    errors.name = 'Product name is required.';
  } else if (trimmedName.length > 100) {
    errors.name = 'Product name must be 100 characters or fewer.';
  }

  if (form.description.trim().length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  const stockCheck = validatePositiveInteger(form.quantityInStockText, 'Quantity in Stock');
  if (!stockCheck.valid) {
    errors.quantityInStock = stockCheck.message;
  }

  const priceCheck = validatePositiveDecimal(form.replacementPriceText, 'Replacement Price');
  if (!priceCheck.valid) {
    errors.replacementPrice = priceCheck.message;
  }

  return {
    errors,
    quantityInStock: stockCheck.valid ? stockCheck.value : 0,
    replacementPrice: priceCheck.valid ? priceCheck.value : 0,
  };
}

export function ProductsSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [equipmentStats, setEquipmentStats] = useState<Record<number, EquipmentStockView>>({});
  const [globalPendingFeasibleOrders, setGlobalPendingFeasibleOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ProductFormState>(DEFAULT_PRODUCT_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<ProductFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingProduct, setEditingProduct] = useState<ProductView | null>(null);
  const [editForm, setEditForm] = useState<ProductFormState>(DEFAULT_PRODUCT_FORM);
  const [editFieldErrors, setEditFieldErrors] = useState<ProductFieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [archivingProduct, setArchivingProduct] = useState<ProductView | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
        const [productData, eqData, summaryData] = await Promise.all([
          getProducts(),
          getTechnicalEquipment().catch(() => [] as EquipmentStockView[]),
          getTechnicalEquipmentSummary().catch(() => ({ pendingFeasibleOrders: 0 })),
        ]);
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setProducts(productData);
        const statsMap: Record<number, EquipmentStockView> = {};
        for (const item of eqData) {
          statsMap[item.id] = item;
        }
        setEquipmentStats(statsMap);
        setGlobalPendingFeasibleOrders(summaryData.pendingFeasibleOrders ?? 0);
        onCountChange(productData.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load hardware products.'));
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
    void loadData(isSilent);
  }, [loadData, refreshTrigger]);

  const filteredProducts = useMemo<ProductRow[]>(() => {
    const needle = searchQuery.trim().toLowerCase();
    return products
      .filter((item) => {
        if (!needle) return true;
        return (
          item.name.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle)
        );
      })
      .map((item) => ({ ...item }));
  }, [products, searchQuery]);

  const pagination = useClientPagination(filteredProducts, {
    resetKey: searchQuery.trim().toLowerCase(),
  });

  const totalStockUnits = useMemo(
    () => products.reduce((sum, p) => sum + (p.quantityInStock || 0), 0),
    [products],
  );

  const lowStockCount = useMemo(
    () => products.filter((p) => p.active && (p.quantityInStock || 0) < 10).length,
    [products],
  );

  const totalPendingAllocations = globalPendingFeasibleOrders;

  const openCreateDialog = () => {
    setCreateForm(DEFAULT_PRODUCT_FORM);
    setCreateFieldErrors({});
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEditDialog = (product: ProductView) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      active: product.active,
      quantityInStockText: String(product.quantityInStock ?? 0),
      replacementPriceText: String(product.replacementPrice ?? 0),
    });
    setEditFieldErrors({});
    setEditError(null);
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;
    const { errors, quantityInStock, replacementPrice } = validateProductForm(createForm);
    setCreateFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload: ProductInput = {
      name: createForm.name.trim(),
      description: createForm.description.trim() || null,
      active: createForm.active,
      quantityInStock,
      replacementPrice,
    };

    setCreating(true);
    try {
      const created = await createProduct(payload);
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      toast({ body: `Created product "${created.name}".` });
      pagination.focusItem((item) => item.id === created.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setCreateFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        description: serverFields.description ?? prev.description,
      }));
      setCreateError(extractErrorMessage(err, 'Could not create product.'));
    } finally {
      if (isMountedRef.current) {
        setCreating(false);
      }
    }
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingEdit || !editingProduct) return;

    const { errors, quantityInStock, replacementPrice } = validateProductForm(editForm);
    setEditFieldErrors(errors);
    setEditError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload: ProductInput = {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      active: editForm.active,
      quantityInStock,
      replacementPrice,
    };

    setSavingEdit(true);
    try {
      const updated = await updateProduct(editingProduct.id, payload);
      if (!isMountedRef.current) return;
      setEditingProduct(null);
      toast({ body: `Updated product "${updated.name}".` });
      pagination.focusItem((item) => item.id === updated.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setEditFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        description: serverFields.description ?? prev.description,
      }));
      setEditError(extractErrorMessage(err, 'Could not update product.'));
    } finally {
      if (isMountedRef.current) {
        setSavingEdit(false);
      }
    }
  };

  const handleToggleActive = async (product: ProductRow, nextActive: boolean) => {
    if (togglingId !== null) return;
    setTogglingId(product.id);
    setLoadError(null);
    try {
      const updated = await updateProduct(product.id, {
        name: product.name,
        description: product.description || null,
        active: nextActive,
        quantityInStock: product.quantityInStock,
        replacementPrice: product.replacementPrice,
      });
      if (!isMountedRef.current) return;
      toast({
        body: nextActive
          ? `Reactivated product "${updated.name}".`
          : `Deactivated product "${updated.name}".`,
      });
      pagination.focusItem((item) => item.id === updated.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(extractErrorMessage(err, `Failed to update status for "${product.name}".`));
    } finally {
      if (isMountedRef.current) {
        setTogglingId(null);
      }
    }
  };

  const handleConfirmArchive = async () => {
    if (archiving || !archivingProduct) return;
    setArchiving(true);
    setLoadError(null);
    try {
      const targetId = archivingProduct.id;
      const targetName = archivingProduct.name;
      await archiveProduct(targetId);
      if (!isMountedRef.current) return;
      setArchivingProduct(null);
      toast({ body: `Archived product "${targetName}".` });
      pagination.focusItem((item) => item.id === targetId);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setArchivingProduct(null);
      setLoadError(extractErrorMessage(err, 'Failed to archive product.'));
    } finally {
      if (isMountedRef.current) {
        setArchiving(false);
      }
    }
  };

  const columns: TableColumn<ProductRow>[] = [
    {
      key: 'name',
      header: 'Product Name',
      width: proportional(1.4, { minWidth: 160 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.name}</Text>
          <Text type="supporting" size="sm">
            {row.description ? row.description : 'No description'}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'quantityInStock',
      header: 'Stock in Hand',
      width: pixel(140),
      renderCell: (row) => {
        const stock = row.quantityInStock ?? 0;
        const isLow = stock < 10;
        return (
          <HStack gap={1.5} vAlign="center" wrap="nowrap">
            {isLow ? (
              <Token size="sm" color="red" label={`Low: ${stock}`} />
            ) : (
              <Token size="sm" color="green" label={`${stock} units`} />
            )}
          </HStack>
        );
      },
    },
    {
      key: 'allocations',
      header: 'Demand vs Stock',
      width: pixel(170),
      renderCell: (row) => {
        const stats = equipmentStats[row.id];
        const pending = stats?.pendingAllocations ?? 0;
        const stock = row.quantityInStock ?? 0;
        const isDeficit = stock < pending;
        return (
          <VStack gap={0.5}>
            <HStack gap={1.5} vAlign="center" wrap="nowrap">
              <Text type="body" hasTabularNumbers>
                {`${pending} pending`}
              </Text>
              {isDeficit && pending > 0 && <Token size="sm" color="red" label="Deficit" />}
            </HStack>
            <Text type="supporting" size="sm">
              {`${stats?.allocatedCount ?? 0} active deployed`}
            </Text>
          </VStack>
        );
      },
    },
    {
      key: 'replacementPrice',
      header: 'Replacement Price',
      width: pixel(150),
      renderCell: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatUsd(row.replacementPrice ?? 0)}
        </Text>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      width: pixel(150),
      renderCell: (row) => (
        <HStack gap={2} vAlign="center" wrap="nowrap">
          <Switch
            label={`Toggle ${row.name} active status`}
            isLabelHidden
            size="sm"
            value={row.active}
            isLoading={togglingId === row.id}
            isDisabled={togglingId !== null}
            onChange={(next) => {
              void handleToggleActive(row, next);
            }}
          />
          <StatusLabel
            variant={row.active ? 'success' : 'neutral'}
            label={row.active ? 'Active' : 'Archived'}
          />
        </HStack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(170),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={2} hAlign="end" wrap="nowrap">
          <Button
            size="sm"
            variant="secondary"
            label="Edit"
            onClick={() => openEditDialog(row)}
          />
          <Button
            size="sm"
            variant="ghost"
            label="Archive"
            isDisabled={!row.active || togglingId === row.id}
            onClick={() => setArchivingProduct(row)}
          />
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
              Hardware Models
            </Text>
            <Heading level={2} type="display-3">
              {products.length}
            </Heading>
            <Text type="supporting" size="sm">
              Catalog SKUs available
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Total Stock Units
            </Text>
            <Heading level={2} type="display-3">
              {totalStockUnits}
            </Heading>
            <Text type="supporting" size="sm">
              Across all warehouse bins
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Low Stock Warnings
            </Text>
            <Heading level={2} type="display-3">
              {lowStockCount}
            </Heading>
            <Text type="supporting" size="sm">
              {lowStockCount > 0 ? 'Need procurement orders' : 'All stock levels healthy'}
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Pending Allocations
            </Text>
            <Heading level={2} type="display-3">
              {totalPendingAllocations}
            </Heading>
            <Text type="supporting" size="sm">
              Awaiting connection install
            </Text>
          </VStack>
        </Card>
      </Grid>

      <Card padding={6}>
        <VStack gap={5}>
          <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Hardware & Equipment Catalog</Heading>
              <Badge variant="neutral" label={`${filteredProducts.length} items`} />
            </HStack>

            <HStack gap={2} vAlign="end" wrap="wrap">
              <TextInput
                type="search"
                label="Filter Products"
                isLabelHidden
                placeholder="Search product name or description..."
                startIcon={<Icon icon="search" />}
                hasClear
                width={260}
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <Button variant="primary" label="Create Product" onClick={openCreateDialog} />
            </HStack>
          </HStack>

          <ApiErrorBanner
            title="Hardware products error"
            error={loadError}
            onDismiss={() => setLoadError(null)}
          />

          {loading && products.length === 0 ? (
            <Center padding={8}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading hardware products..." />
                <Text type="supporting">Loading hardware products from catalog...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<ProductRow>
                aria-label="Hardware Products Catalog"
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
                    title="No hardware products found"
                    description={
                      searchQuery.trim()
                        ? 'No products matched your search filter.'
                        : 'Register routers, modems, or CPE hardware items in the catalog.'
                    }
                    icon={<Icon icon="info" />}
                    actions={
                      searchQuery.trim() ? (
                        <Button
                          variant="secondary"
                          label="Clear Search"
                          onClick={() => setSearchQuery('')}
                        />
                      ) : (
                        <Button variant="primary" label="Create Product" onClick={openCreateDialog} />
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
                label="Hardware products pagination"
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
          width={480}
          label="Create Hardware Product"
        >
          <Layout
            header={
              <DrawerHeader
                title="Create Hardware Product"
                subtitle="Add a modem, router, or equipment SKU with initial stock and replacement fee."
                onOpenChange={(open) => {
                  if (!open && !creating) setIsCreateOpen(false);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not create product"
                    error={createError}
                    onDismiss={() => setCreateError(null)}
                  />
                  <form id="create-product-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                    <FormLayout>
                      <TextInput
                        label="Product Name"
                        placeholder="e.g. Nexus Dual-Band Wi-Fi 6 Optical Router"
                        isRequired
                        value={createForm.name}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, name: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        status={
                          createFieldErrors.name
                            ? { type: 'error', message: createFieldErrors.name }
                            : createForm.name.trim().length > 100
                              ? {
                                  type: 'error',
                                  message: 'Product name must be 100 characters or fewer.',
                                }
                              : undefined
                        }
                      />
                      <TextArea
                        label="Description"
                        placeholder="Hardware specifications, port count, frequency bands, or provisioning notes..."
                        isOptional
                        rows={3}
                        maxLength={240}
                        value={createForm.description}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, description: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, description: undefined }));
                        }}
                        status={
                          createFieldErrors.description
                            ? { type: 'error', message: createFieldErrors.description }
                            : createForm.description.trim().length > 240
                              ? {
                                  type: 'error',
                                  message: 'Description must be 240 characters or fewer.',
                                }
                              : undefined
                        }
                      />
                      <TextInput
                        label="Initial Quantity in Stock"
                        inputMode="numeric"
                        placeholder="0"
                        description="Current count of available equipment in warehouse inventory."
                        isRequired
                        value={createForm.quantityInStockText}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, quantityInStockText: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, quantityInStock: undefined }));
                        }}
                        status={
                          createFieldErrors.quantityInStock
                            ? { type: 'error', message: createFieldErrors.quantityInStock }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Replacement Price (USD)"
                        inputMode="decimal"
                        placeholder="0.00"
                        description="Cost charged to customer if device is damaged or unreturned."
                        isRequired
                        value={createForm.replacementPriceText}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, replacementPriceText: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, replacementPrice: undefined }));
                        }}
                        status={
                          createFieldErrors.replacementPrice
                            ? { type: 'error', message: createFieldErrors.replacementPrice }
                            : undefined
                        }
                      />
                      <Switch
                        label="Active in Catalog"
                        description="Mark hardware product as active and eligible for installation allocations."
                        value={createForm.active}
                        onChange={(checked) =>
                          setCreateForm((prev) => ({ ...prev, active: checked }))
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
                    form="create-product-form"
                    variant="primary"
                    label="Create Product"
                    isLoading={creating}
                    isDisabled={creating}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Drawer>

        <Drawer
          isOpen={editingProduct !== null}
          onOpenChange={(open) => {
            if (!open && !savingEdit) setEditingProduct(null);
          }}
          purpose="form"
          side="end"
          width={480}
          label="Edit Hardware Product"
        >
          <Layout
            header={
              <DrawerHeader
                title={
                  editingProduct ? `Edit Product: ${editingProduct.name}` : 'Edit Hardware Product'
                }
                subtitle="Update equipment details, inventory stock, replacement fee, or active status."
                onOpenChange={(open) => {
                  if (!open && !savingEdit) setEditingProduct(null);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not save product"
                    error={editError}
                    onDismiss={() => setEditError(null)}
                  />
                  <form id="edit-product-form" onSubmit={(e) => void handleEditSubmit(e)}>
                    <FormLayout>
                      <TextInput
                        label="Product Name"
                        isRequired
                        value={editForm.name}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, name: value }));
                          setEditFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        status={
                          editFieldErrors.name
                            ? { type: 'error', message: editFieldErrors.name }
                            : editForm.name.trim().length > 100
                              ? {
                                  type: 'error',
                                  message: 'Product name must be 100 characters or fewer.',
                                }
                              : undefined
                        }
                      />
                      <TextArea
                        label="Description"
                        isOptional
                        rows={3}
                        maxLength={240}
                        value={editForm.description}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, description: value }));
                          setEditFieldErrors((prev) => ({ ...prev, description: undefined }));
                        }}
                        status={
                          editFieldErrors.description
                            ? { type: 'error', message: editFieldErrors.description }
                            : editForm.description.trim().length > 240
                              ? {
                                  type: 'error',
                                  message: 'Description must be 240 characters or fewer.',
                                }
                              : undefined
                        }
                      />
                      <TextInput
                        label="Quantity in Stock"
                        inputMode="numeric"
                        description="Current count of available equipment in inventory."
                        isRequired
                        value={editForm.quantityInStockText}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, quantityInStockText: value }));
                          setEditFieldErrors((prev) => ({ ...prev, quantityInStock: undefined }));
                        }}
                        status={
                          editFieldErrors.quantityInStock
                            ? { type: 'error', message: editFieldErrors.quantityInStock }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Replacement Price (USD)"
                        inputMode="decimal"
                        description="Fee billed for customer equipment loss or physical damage."
                        isRequired
                        value={editForm.replacementPriceText}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, replacementPriceText: value }));
                          setEditFieldErrors((prev) => ({ ...prev, replacementPrice: undefined }));
                        }}
                        status={
                          editFieldErrors.replacementPrice
                            ? { type: 'error', message: editFieldErrors.replacementPrice }
                            : undefined
                        }
                      />
                      <Switch
                        label="Active in Catalog"
                        description="Turn on to keep product active, or turn off to archive from catalog."
                        value={editForm.active}
                        onChange={(checked) =>
                          setEditForm((prev) => ({ ...prev, active: checked }))
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
                    isDisabled={savingEdit}
                    onClick={() => setEditingProduct(null)}
                  />
                  <Button
                    type="submit"
                    form="edit-product-form"
                    variant="primary"
                    label="Save Changes"
                    isLoading={savingEdit}
                    isDisabled={savingEdit}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Drawer>

        <AlertDialog
          isOpen={archivingProduct !== null}
          onOpenChange={(open) => {
            if (!open && !archiving) setArchivingProduct(null);
          }}
          title="Archive Hardware Product?"
          description={
            archivingProduct
              ? `Archiving "${archivingProduct.name}" sets it to inactive while keeping its historical catalog entry. You can reactivate it later via Edit.`
              : ''
          }
          cancelLabel="Cancel"
          actionLabel="Archive Product"
          actionVariant="destructive"
          isActionLoading={archiving}
          onAction={() => void handleConfirmArchive()}
        />
      </Card>
    </VStack>
  );
}
