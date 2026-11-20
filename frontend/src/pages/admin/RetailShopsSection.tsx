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
import { Switch } from '@astryxdesign/core/Switch';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, CopyableId, StatusLabel } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { getCities } from '../../services/catalogApi';
import {
  createRetailShop,
  deleteRetailShop,
  getAdminRetailShops,
  updateRetailShop,
} from '../../services/inventoryApi';
import type { CityView, RetailShopInput, RetailShopView } from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  type AdminSectionProps,
  type RetailShopRow,
} from './adminTypes';

interface RetailShopFormState {
  code: string;
  name: string;
  cityCode: string;
  address: string;
  phone: string;
  active: boolean;
}

interface RetailShopFieldErrors {
  code?: string;
  name?: string;
  cityCode?: string;
  address?: string;
  phone?: string;
}

const DEFAULT_SHOP_FORM: RetailShopFormState = {
  code: '',
  name: '',
  cityCode: '',
  address: '',
  phone: '',
  active: true,
};

function validateShopForm(form: RetailShopFormState): RetailShopFieldErrors {
  const errors: RetailShopFieldErrors = {};
  const trimmedCode = form.code.trim();
  if (!trimmedCode) {
    errors.code = 'Outlet code is required (e.g. HND01).';
  } else if (!/^[a-zA-Z0-9_-]{2,20}$/.test(trimmedCode)) {
    errors.code = 'Outlet code must be 2-20 alphanumeric characters (e.g. HND01).';
  }

  const trimmedName = form.name.trim();
  if (!trimmedName) {
    errors.name = 'Outlet name is required.';
  } else if (trimmedName.length > 100) {
    errors.name = 'Outlet name must be 100 characters or fewer.';
  }

  if (!form.cityCode.trim()) {
    errors.cityCode = 'Please select a territory city.';
  }

  const trimmedAddress = form.address.trim();
  if (!trimmedAddress) {
    errors.address = 'Address is required.';
  } else if (trimmedAddress.length > 200) {
    errors.address = 'Address must be 200 characters or fewer.';
  }

  const trimmedPhone = form.phone.trim();
  if (!trimmedPhone) {
    errors.phone = 'Phone number is required.';
  } else if (trimmedPhone.length > 30) {
    errors.phone = 'Phone number must be 30 characters or fewer.';
  }

  return errors;
}

export function RetailShopsSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [shops, setShops] = useState<RetailShopView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cityFilter, setCityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RetailShopFormState>(DEFAULT_SHOP_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<RetailShopFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingShop, setEditingShop] = useState<RetailShopView | null>(null);
  const [editForm, setEditForm] = useState<RetailShopFormState>(DEFAULT_SHOP_FORM);
  const [editFieldErrors, setEditFieldErrors] = useState<RetailShopFieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingShop, setDeletingShop] = useState<RetailShopView | null>(null);
  const [deleting, setDeleting] = useState(false);
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
        const [shopsData, citiesData] = await Promise.all([
          getAdminRetailShops(),
          getCities().catch(() => [] as CityView[]),
        ]);
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setShops(shopsData);
        setCities(citiesData);
        onCountChange(shopsData.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load retail shops.'));
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

  const cityOptions = useMemo(() => {
    const list = [{ value: 'ALL', label: 'All Cities' }];
    for (const c of cities) {
      list.push({ value: c.code, label: `${c.code} - ${c.name}` });
    }
    return list;
  }, [cities]);

  const formCityOptions = useMemo(() => {
    return cities.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }));
  }, [cities]);

  const cityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cities) {
      map[c.code] = c.name;
    }
    return map;
  }, [cities]);

  const filteredShops = useMemo<RetailShopRow[]>(() => {
    const needle = searchQuery.trim().toLowerCase();
    return shops
      .filter((item) => {
        if (cityFilter !== 'ALL' && item.cityCode !== cityFilter) {
          return false;
        }
        if (!needle) return true;
        const cityName = item.cityName || cityNameMap[item.cityCode] || '';
        return (
          item.code.toLowerCase().includes(needle) ||
          item.name.toLowerCase().includes(needle) ||
          item.address.toLowerCase().includes(needle) ||
          item.phone.toLowerCase().includes(needle) ||
          cityName.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => Number(b.active) - Number(a.active))
      .map((item) => ({ ...item }));
  }, [shops, cityFilter, searchQuery, cityNameMap]);

  const pagination = useClientPagination(filteredShops, {
    resetKey: `${cityFilter}:${searchQuery.trim().toLowerCase()}`,
  });

  const activeCount = useMemo(() => shops.filter((s) => s.active).length, [shops]);
  const coveredCityCount = useMemo(() => new Set(shops.map((s) => s.cityCode)).size, [shops]);

  const openCreateDialog = () => {
    setCreateForm({
      ...DEFAULT_SHOP_FORM,
      cityCode: cities.length > 0 ? cities[0]!.code : '',
    });
    setCreateFieldErrors({});
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEditDialog = (shop: RetailShopView) => {
    setEditingShop(shop);
    setEditForm({
      code: shop.code,
      name: shop.name,
      cityCode: shop.cityCode,
      address: shop.address,
      phone: shop.phone,
      active: shop.active,
    });
    setEditFieldErrors({});
    setEditError(null);
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;
    const errors = validateShopForm(createForm);
    setCreateFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length > 0) return;

    const payload: RetailShopInput = {
      code: createForm.code.trim().toUpperCase(),
      name: createForm.name.trim(),
      cityCode: createForm.cityCode.trim(),
      address: createForm.address.trim(),
      phone: createForm.phone.trim(),
      active: createForm.active,
    };

    setCreating(true);
    try {
      const created = await createRetailShop(payload);
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      toast({ body: `Created retail outlet "${created.name}".` });
      pagination.focusItem((item) => item.id === created.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setCreateFieldErrors((prev) => ({
        ...prev,
        code: serverFields.code ?? prev.code,
        name: serverFields.name ?? prev.name,
        cityCode: serverFields.citycode ?? prev.cityCode,
        address: serverFields.address ?? prev.address,
        phone: serverFields.phone ?? prev.phone,
      }));
      setCreateError(extractErrorMessage(err, 'Could not create retail shop.'));
    } finally {
      if (isMountedRef.current) setCreating(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingEdit || !editingShop) return;
    const errors = validateShopForm(editForm);
    setEditFieldErrors(errors);
    setEditError(null);
    if (Object.keys(errors).length > 0) return;

    const payload: RetailShopInput = {
      code: editForm.code.trim().toUpperCase(),
      name: editForm.name.trim(),
      cityCode: editForm.cityCode.trim(),
      address: editForm.address.trim(),
      phone: editForm.phone.trim(),
      active: editForm.active,
    };

    setSavingEdit(true);
    try {
      const updated = await updateRetailShop(editingShop.id, payload);
      if (!isMountedRef.current) return;
      setEditingShop(null);
      toast({ body: `Updated retail outlet "${updated.name}".` });
      pagination.focusItem((item) => item.id === updated.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setEditFieldErrors((prev) => ({
        ...prev,
        code: serverFields.code ?? prev.code,
        name: serverFields.name ?? prev.name,
        cityCode: serverFields.citycode ?? prev.cityCode,
        address: serverFields.address ?? prev.address,
        phone: serverFields.phone ?? prev.phone,
      }));
      setEditError(extractErrorMessage(err, 'Could not update retail shop.'));
    } finally {
      if (isMountedRef.current) setSavingEdit(false);
    }
  };

  const handleToggleActive = async (shop: RetailShopRow, nextActive: boolean) => {
    if (togglingId !== null) return;
    setTogglingId(shop.id);
    setLoadError(null);
    try {
      const updated = await updateRetailShop(shop.id, {
        code: shop.code,
        name: shop.name,
        cityCode: shop.cityCode,
        address: shop.address,
        phone: shop.phone,
        active: nextActive,
      });
      if (!isMountedRef.current) return;
      toast({
        body: nextActive
          ? `Reactivated outlet "${updated.name}".`
          : `Deactivated outlet "${updated.name}".`,
      });
      pagination.focusItem((item) => item.id === updated.id);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(extractErrorMessage(err, `Failed to update status for "${shop.name}".`));
    } finally {
      if (isMountedRef.current) setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleting || !deletingShop) return;
    setDeleting(true);
    setLoadError(null);
    try {
      const targetId = deletingShop.id;
      const targetName = deletingShop.name;
      await deleteRetailShop(targetId);
      if (!isMountedRef.current) return;
      setDeletingShop(null);
      toast({ body: `Removed retail outlet "${targetName}".` });
      pagination.focusItem((item) => item.id === targetId);
      await loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setDeletingShop(null);
      setLoadError(extractErrorMessage(err, 'Failed to remove retail shop.'));
    } finally {
      if (isMountedRef.current) setDeleting(false);
    }
  };

  const columns: TableColumn<RetailShopRow>[] = [
    {
      key: 'code',
      header: 'Outlet Code',
      width: pixel(130),
      renderCell: (row) => <CopyableId value={row.code} label="Code" />,
    },
    {
      key: 'name',
      header: 'Shop Name',
      width: proportional(1.5, { minWidth: 170 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.name}</Text>
          <Text type="supporting" size="sm">
            {row.cityName ? `${row.cityCode} - ${row.cityName}` : `City ${row.cityCode}`}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      width: proportional(2.0, { minWidth: 200 }),
      renderCell: (row) => <Text type="supporting">{row.address}</Text>,
    },
    {
      key: 'phone',
      header: 'Phone Contact',
      width: pixel(150),
      renderCell: (row) => (
        <Text type="body" hasTabularNumbers>
          {row.phone}
        </Text>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      width: pixel(140),
      renderCell: (row) => (
        <HStack gap={2} vAlign="center" wrap="nowrap">
          <Switch
            label={`Toggle ${row.name} active status`}
            isLabelHidden
            size="sm"
            value={row.active}
            isLoading={togglingId === row.id}
            isDisabled={togglingId !== null}
            onChange={(next) => void handleToggleActive(row, next)}
          />
          <StatusLabel
            variant={row.active ? 'success' : 'neutral'}
            label={row.active ? 'Active' : 'Closed'}
          />
        </HStack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(160),
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
            label="Delete"
            isDisabled={togglingId === row.id}
            onClick={() => setDeletingShop(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <VStack gap={5}>
      <Grid columns={{ minWidth: 200, max: 3 }} gap={4}>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Total Outlets
            </Text>
            <Heading level={2} type="display-3">
              {shops.length}
            </Heading>
            <Text type="supporting" size="sm">
              Retail branches across regions
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Active Walk-in Centers
            </Text>
            <Heading level={2} type="display-3">
              {activeCount}
            </Heading>
            <Text type="supporting" size="sm">
              Currently accepting customer requests
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Territory Cities Covered
            </Text>
            <Heading level={2} type="display-3">
              {coveredCityCount}
            </Heading>
            <Text type="supporting" size="sm">
              Of {cities.length} total registered cities
            </Text>
          </VStack>
        </Card>
      </Grid>

      <Card padding={6}>
        <VStack gap={5}>
          <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Retail Outlets Directory</Heading>
              <Badge variant="neutral" label={`${filteredShops.length} outlets`} />
            </HStack>

            <HStack gap={2} vAlign="end" wrap="wrap">
              <Selector
                label="City Filter"
                isLabelHidden
                options={cityOptions}
                value={cityFilter}
                onChange={setCityFilter}
              />
              <TextInput
                type="search"
                label="Filter Shops"
                isLabelHidden
                placeholder="Search code, name, phone..."
                startIcon={<Icon icon="search" />}
                hasClear
                width={240}
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <Button variant="primary" label="Create Outlet" onClick={openCreateDialog} />
            </HStack>
          </HStack>

          <ApiErrorBanner
            title="Retail shops error"
            error={loadError}
            onDismiss={() => setLoadError(null)}
          />

          {loading && shops.length === 0 ? (
            <Center padding={8}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading retail outlets..." />
                <Text type="supporting">Fetching retail shop locations...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<RetailShopRow>
                aria-label="Retail Shops Directory"
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
                    title="No retail shops found"
                    description={
                      searchQuery.trim() || cityFilter !== 'ALL'
                        ? 'No retail outlets match your search or city filter.'
                        : 'Register local retail branches and walk-in centers.'
                    }
                    icon={<Icon icon="info" />}
                    actions={
                      searchQuery.trim() || cityFilter !== 'ALL' ? (
                        <Button
                          variant="secondary"
                          label="Reset Filters"
                          onClick={() => {
                            setSearchQuery('');
                            setCityFilter('ALL');
                          }}
                        />
                      ) : (
                        <Button variant="primary" label="Create Outlet" onClick={openCreateDialog} />
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
                label="Retail shops pagination"
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
          label="Create Retail Outlet"
        >
          <Layout
            header={
              <DrawerHeader
                title="Create Retail Outlet"
                subtitle="Register a local customer service branch and phone line."
                onOpenChange={(open) => {
                  if (!open && !creating) setIsCreateOpen(false);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not create outlet"
                    error={createError}
                    onDismiss={() => setCreateError(null)}
                  />
                  <form id="create-shop-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                    <FormLayout>
                      <TextInput
                        label="Outlet Code"
                        placeholder="e.g. HND01"
                        description="Unique branch identifier (2-20 characters)."
                        isRequired
                        value={createForm.code}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, code: value.toUpperCase() }));
                          setCreateFieldErrors((prev) => ({ ...prev, code: undefined }));
                        }}
                        status={
                          createFieldErrors.code
                            ? { type: 'error', message: createFieldErrors.code }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Outlet Name"
                        placeholder="e.g. Nexus Hanoi Hoan Kiem Branch"
                        isRequired
                        value={createForm.name}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, name: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        status={
                          createFieldErrors.name
                            ? { type: 'error', message: createFieldErrors.name }
                            : undefined
                        }
                      />
                      <Selector
                        label="Territory City"
                        isRequired
                        options={formCityOptions}
                        value={createForm.cityCode}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, cityCode: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, cityCode: undefined }));
                        }}
                        status={
                          createFieldErrors.cityCode
                            ? { type: 'error', message: createFieldErrors.cityCode }
                            : undefined
                        }
                      />
                      <TextArea
                        label="Street Address"
                        placeholder="e.g. 15 Dinh Tien Hoang, Hoan Kiem, Hanoi"
                        isRequired
                        rows={3}
                        maxLength={200}
                        value={createForm.address}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, address: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, address: undefined }));
                        }}
                        status={
                          createFieldErrors.address
                            ? { type: 'error', message: createFieldErrors.address }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Contact Phone"
                        placeholder="e.g. +84 24 3825 0001"
                        isRequired
                        value={createForm.phone}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, phone: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        status={
                          createFieldErrors.phone
                            ? { type: 'error', message: createFieldErrors.phone }
                            : undefined
                        }
                      />
                      <Switch
                        label="Active Outlet"
                        description="Active branches are open for customer walk-in service and inquiries."
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
                    form="create-shop-form"
                    variant="primary"
                    label="Create Outlet"
                    isLoading={creating}
                    isDisabled={creating}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Drawer>

        <Drawer
          isOpen={editingShop !== null}
          onOpenChange={(open) => {
            if (!open && !savingEdit) setEditingShop(null);
          }}
          purpose="form"
          side="end"
          width={480}
          label="Edit Retail Outlet"
        >
          <Layout
            header={
              <DrawerHeader
                title={editingShop ? `Edit Outlet: ${editingShop.name}` : 'Edit Retail Outlet'}
                subtitle="Update branch contact details, address, or operating status."
                onOpenChange={(open) => {
                  if (!open && !savingEdit) setEditingShop(null);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not save outlet"
                    error={editError}
                    onDismiss={() => setEditError(null)}
                  />
                  <form id="edit-shop-form" onSubmit={(e) => void handleEditSubmit(e)}>
                    <FormLayout>
                      <TextInput
                        label="Outlet Code"
                        isRequired
                        value={editForm.code}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, code: value.toUpperCase() }));
                          setEditFieldErrors((prev) => ({ ...prev, code: undefined }));
                        }}
                        status={
                          editFieldErrors.code
                            ? { type: 'error', message: editFieldErrors.code }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Outlet Name"
                        isRequired
                        value={editForm.name}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, name: value }));
                          setEditFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        status={
                          editFieldErrors.name
                            ? { type: 'error', message: editFieldErrors.name }
                            : undefined
                        }
                      />
                      <Selector
                        label="Territory City"
                        isRequired
                        options={formCityOptions}
                        value={editForm.cityCode}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, cityCode: value }));
                          setEditFieldErrors((prev) => ({ ...prev, cityCode: undefined }));
                        }}
                        status={
                          editFieldErrors.cityCode
                            ? { type: 'error', message: editFieldErrors.cityCode }
                            : undefined
                        }
                      />
                      <TextArea
                        label="Street Address"
                        isRequired
                        rows={3}
                        maxLength={200}
                        value={editForm.address}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, address: value }));
                          setEditFieldErrors((prev) => ({ ...prev, address: undefined }));
                        }}
                        status={
                          editFieldErrors.address
                            ? { type: 'error', message: editFieldErrors.address }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Contact Phone"
                        isRequired
                        value={editForm.phone}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, phone: value }));
                          setEditFieldErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        status={
                          editFieldErrors.phone
                            ? { type: 'error', message: editFieldErrors.phone }
                            : undefined
                        }
                      />
                      <Switch
                        label="Active Outlet"
                        description="Toggle branch open or temporarily closed."
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
                    onClick={() => setEditingShop(null)}
                  />
                  <Button
                    type="submit"
                    form="edit-shop-form"
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
          isOpen={deletingShop !== null}
          onOpenChange={(open) => {
            if (!open && !deleting) setDeletingShop(null);
          }}
          title="Remove Retail Outlet?"
          description={
            deletingShop
              ? `Are you sure you want to remove outlet "${deletingShop.name}" (${deletingShop.code})? This action cannot be undone.`
              : ''
          }
          cancelLabel="Cancel"
          actionLabel="Remove Outlet"
          actionVariant="destructive"
          isActionLoading={deleting}
          onAction={() => void handleConfirmDelete()}
        />
      </Card>
    </VStack>
  );
}
