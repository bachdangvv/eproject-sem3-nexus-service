/**
 * Admin telecom equipment vendor directory and management section (GET/POST/PUT/DELETE /api/admin/vendors).
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
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, CopyableId, StatusLabel } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import {
  createVendor,
  deleteVendor,
  getVendors,
  updateVendor,
} from '../../services/inventoryApi';
import type { VendorInput, VendorView } from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  SHOP_VENDOR_CODE_REGEX,
  STAFF_PHONE_REGEX,
  type AdminSectionProps,
  type VendorRow,
} from './adminTypes';

interface VendorFormState {
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

interface VendorFieldErrors {
  code?: string;
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

const DEFAULT_VENDOR_FORM: VendorFormState = {
  code: '',
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  active: true,
};

function validateVendorForm(form: VendorFormState): VendorFieldErrors {
  const errors: VendorFieldErrors = {};
  const trimmedCode = form.code.trim();
  if (!trimmedCode) {
    errors.code = 'Vendor code is required (e.g. VND-CISCO).';
  } else if (!SHOP_VENDOR_CODE_REGEX.test(trimmedCode)) {
    errors.code = 'Vendor code must be 2–30 characters using letters, numbers, ".", "_", or "-".';
  }

  const trimmedName = form.name.trim();
  if (!trimmedName) {
    errors.name = 'Vendor name is required.';
  } else if (trimmedName.length > 100) {
    errors.name = 'Vendor name must be 100 characters or fewer.';
  }

  const trimmedContact = form.contactPerson.trim();
  if (!trimmedContact) {
    errors.contactPerson = 'Contact person is required.';
  } else if (trimmedContact.length > 100) {
    errors.contactPerson = 'Contact person must be 100 characters or fewer.';
  }

  const trimmedPhone = form.phone.trim();
  if (!trimmedPhone) {
    errors.phone = 'Phone number is required.';
  } else if (!STAFF_PHONE_REGEX.test(trimmedPhone)) {
    errors.phone = 'Phone must be 7 to 15 digits (optional leading +).';
  }

  const trimmedEmail = form.email.trim();
  if (!trimmedEmail) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address (e.g. orders@cisco.com).';
  } else if (trimmedEmail.length > 100) {
    errors.email = 'Email must be 100 characters or fewer.';
  }

  const trimmedAddress = form.address.trim();
  if (!trimmedAddress) {
    errors.address = 'Address is required.';
  } else if (trimmedAddress.length > 200) {
    errors.address = 'Address must be 200 characters or fewer.';
  }

  return errors;
}

export function VendorsSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [vendors, setVendors] = useState<VendorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<VendorFormState>(DEFAULT_VENDOR_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<VendorFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingVendor, setEditingVendor] = useState<VendorView | null>(null);
  const [editForm, setEditForm] = useState<VendorFormState>(DEFAULT_VENDOR_FORM);
  const [editFieldErrors, setEditFieldErrors] = useState<VendorFieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingVendor, setDeletingVendor] = useState<VendorView | null>(null);
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

  const loadVendors = useCallback(
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
        const data = await getVendors();
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setVendors(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load vendors.'));
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
    void loadVendors(isSilent);
  }, [loadVendors, refreshTrigger]);

  const filteredVendors = useMemo<VendorRow[]>(() => {
    const needle = searchQuery.trim().toLowerCase();
    return vendors
      .filter((item) => {
        if (!needle) return true;
        return (
          item.code.toLowerCase().includes(needle) ||
          item.name.toLowerCase().includes(needle) ||
          item.contactPerson.toLowerCase().includes(needle) ||
          item.phone.toLowerCase().includes(needle) ||
          item.email.toLowerCase().includes(needle) ||
          item.address.toLowerCase().includes(needle)
        );
      })
      .map((item) => ({ ...item }));
  }, [vendors, searchQuery]);

  const pagination = useClientPagination(filteredVendors, {
    resetKey: searchQuery.trim().toLowerCase(),
  });

  const activeCount = useMemo(() => vendors.filter((v) => v.active).length, [vendors]);

  const openCreateDialog = () => {
    setCreateForm(DEFAULT_VENDOR_FORM);
    setCreateFieldErrors({});
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEditDialog = (vendor: VendorView) => {
    setEditingVendor(vendor);
    setEditForm({
      code: vendor.code,
      name: vendor.name,
      contactPerson: vendor.contactPerson,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      active: vendor.active,
    });
    setEditFieldErrors({});
    setEditError(null);
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;
    const errors = validateVendorForm(createForm);
    setCreateFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length > 0) return;

    const payload: VendorInput = {
      code: createForm.code.trim().toUpperCase(),
      name: createForm.name.trim(),
      contactPerson: createForm.contactPerson.trim(),
      phone: createForm.phone.trim(),
      email: createForm.email.trim(),
      address: createForm.address.trim(),
      active: createForm.active,
    };

    setCreating(true);
    try {
      const created = await createVendor(payload);
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      toast({ body: `Registered vendor "${created.name}".` });
      pagination.focusItem((item) => item.id === created.id);
      await loadVendors(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setCreateFieldErrors((prev) => ({
        ...prev,
        code: serverFields.code ?? prev.code,
        name: serverFields.name ?? prev.name,
        contactPerson: serverFields.contactperson ?? prev.contactPerson,
        phone: serverFields.phone ?? prev.phone,
        email: serverFields.email ?? prev.email,
        address: serverFields.address ?? prev.address,
      }));
      setCreateError(extractErrorMessage(err, 'Could not create vendor.'));
    } finally {
      if (isMountedRef.current) setCreating(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingEdit || !editingVendor) return;
    const errors = validateVendorForm(editForm);
    setEditFieldErrors(errors);
    setEditError(null);
    if (Object.keys(errors).length > 0) return;

    const payload: VendorInput = {
      code: editForm.code.trim().toUpperCase(),
      name: editForm.name.trim(),
      contactPerson: editForm.contactPerson.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
      address: editForm.address.trim(),
      active: editForm.active,
    };

    setSavingEdit(true);
    try {
      const updated = await updateVendor(editingVendor.id, payload);
      if (!isMountedRef.current) return;
      setEditingVendor(null);
      toast({ body: `Updated vendor "${updated.name}".` });
      pagination.focusItem((item) => item.id === updated.id);
      await loadVendors(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setEditFieldErrors((prev) => ({
        ...prev,
        code: serverFields.code ?? prev.code,
        name: serverFields.name ?? prev.name,
        contactPerson: serverFields.contactperson ?? prev.contactPerson,
        phone: serverFields.phone ?? prev.phone,
        email: serverFields.email ?? prev.email,
        address: serverFields.address ?? prev.address,
      }));
      setEditError(extractErrorMessage(err, 'Could not update vendor.'));
    } finally {
      if (isMountedRef.current) setSavingEdit(false);
    }
  };

  const handleToggleActive = async (vendor: VendorRow, nextActive: boolean) => {
    if (togglingId !== null) return;
    setTogglingId(vendor.id);
    setLoadError(null);
    try {
      const updated = await updateVendor(vendor.id, {
        code: vendor.code,
        name: vendor.name,
        contactPerson: vendor.contactPerson,
        phone: vendor.phone,
        email: vendor.email,
        address: vendor.address,
        active: nextActive,
      });
      if (!isMountedRef.current) return;
      toast({
        body: nextActive
          ? `Reactivated vendor "${updated.name}".`
          : `Deactivated vendor "${updated.name}".`,
      });
      pagination.focusItem((item) => item.id === updated.id);
      await loadVendors(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(extractErrorMessage(err, `Failed to update status for "${vendor.name}".`));
    } finally {
      if (isMountedRef.current) setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleting || !deletingVendor) return;
    setDeleting(true);
    setLoadError(null);
    try {
      const targetId = deletingVendor.id;
      const targetName = deletingVendor.name;
      await deleteVendor(targetId);
      if (!isMountedRef.current) return;
      setDeletingVendor(null);
      toast({ body: `Deleted vendor "${targetName}".` });
      pagination.focusItem((item) => item.id === targetId);
      await loadVendors(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setDeletingVendor(null);
      setLoadError(extractErrorMessage(err, 'Failed to delete vendor.'));
    } finally {
      if (isMountedRef.current) setDeleting(false);
    }
  };

  const columns: TableColumn<VendorRow>[] = [
    {
      key: 'code',
      header: 'Vendor Code',
      width: pixel(215),
      renderCell: (row) => <CopyableId value={row.code} label="Vendor" />,
    },
    {
      key: 'name',
      header: 'Vendor Name',
      width: proportional(1.5, { minWidth: 160 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.name}</Text>
          <Text type="supporting" size="sm">
            {row.address}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'contactPerson',
      header: 'Representative',
      width: pixel(160),
      renderCell: (row) => <Text type="body">{row.contactPerson}</Text>,
    },
    {
      key: 'contact',
      header: 'Phone / Email',
      width: proportional(1.5, { minWidth: 180 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text type="body" hasTabularNumbers>
            {row.phone}
          </Text>
          <Text type="supporting" size="sm">
            {row.email}
          </Text>
        </VStack>
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
            label={row.active ? 'Active' : 'Inactive'}
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
            onClick={() => setDeletingVendor(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <VStack gap={5}>
      <Grid columns={{ minWidth: 200, max: 2 }} gap={4}>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Registered Vendors
            </Text>
            <Heading level={2} type="display-3">
              {vendors.length}
            </Heading>
            <Text type="supporting" size="sm">
              Approved hardware suppliers
            </Text>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting" size="sm">
              Active Suppliers
            </Text>
            <Heading level={2} type="display-3">
              {activeCount}
            </Heading>
            <Text type="supporting" size="sm">
              Eligible for purchase orders
            </Text>
          </VStack>
        </Card>
      </Grid>

      <Card padding={6}>
        <VStack gap={5}>
          <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Equipment Manufacturers & Vendors</Heading>
              <Badge variant="neutral" label={`${filteredVendors.length} vendors`} />
            </HStack>

            <HStack gap={2} vAlign="end" wrap="wrap">
              <TextInput
                type="search"
                label="Filter Vendors"
                isLabelHidden
                placeholder="Search vendor, contact, phone, email..."
                startIcon={<Icon icon="search" />}
                hasClear
                width={260}
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <Button variant="primary" label="Register Vendor" onClick={openCreateDialog} />
            </HStack>
          </HStack>

          <ApiErrorBanner
            title="Vendors error"
            error={loadError}
            onDismiss={() => setLoadError(null)}
          />

          {loading && vendors.length === 0 ? (
            <Center padding={8}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading equipment vendors..." />
                <Text type="supporting">Fetching registered vendor directory...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<VendorRow>
                aria-label="Vendors Directory"
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
                    title="No vendors found"
                    description={
                      searchQuery.trim()
                        ? 'No vendors matched your search query.'
                        : 'Register hardware vendors to issue equipment purchase orders.'
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
                        <Button variant="primary" label="Register Vendor" onClick={openCreateDialog} />
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
                label="Vendors pagination"
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
          label="Register Equipment Vendor"
        >
          <Layout
            header={
              <DrawerHeader
                title="Register Equipment Vendor"
                subtitle="Add an approved telecom hardware manufacturer or distributor."
                onOpenChange={(open) => {
                  if (!open && !creating) setIsCreateOpen(false);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not register vendor"
                    error={createError}
                    onDismiss={() => setCreateError(null)}
                  />
                  <form id="create-vendor-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                    <FormLayout>
                      <TextInput
                        label="Vendor Code"
                        placeholder="e.g. VND-CISCO"
                        description="Unique vendor code (2-20 characters)."
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
                        label="Vendor Name"
                        placeholder="e.g. Cisco Systems Vietnam Ltd"
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
                      <TextInput
                        label="Contact Person"
                        placeholder="e.g. Nguyen Van An (Account Rep)"
                        isRequired
                        value={createForm.contactPerson}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, contactPerson: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, contactPerson: undefined }));
                        }}
                        status={
                          createFieldErrors.contactPerson
                            ? { type: 'error', message: createFieldErrors.contactPerson }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Phone Number"
                        placeholder="e.g. +84 28 3822 5500"
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
                      <TextInput
                        label="Email Address"
                        placeholder="e.g. enterprise-orders@cisco.com"
                        type="email"
                        isRequired
                        value={createForm.email}
                        onChange={(value) => {
                          setCreateForm((prev) => ({ ...prev, email: value }));
                          setCreateFieldErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        status={
                          createFieldErrors.email
                            ? { type: 'error', message: createFieldErrors.email }
                            : undefined
                        }
                      />
                      <TextArea
                        label="Office / Depot Address"
                        placeholder="e.g. Level 12, Bitexco Financial Tower, District 1, HCMC"
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
                      <Switch
                        label="Active Vendor"
                        description="Active vendors are selectable when placing new equipment purchase orders."
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
                    form="create-vendor-form"
                    variant="primary"
                    label="Register Vendor"
                    isLoading={creating}
                    isDisabled={creating}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Drawer>

        <Drawer
          isOpen={editingVendor !== null}
          onOpenChange={(open) => {
            if (!open && !savingEdit) setEditingVendor(null);
          }}
          purpose="form"
          side="end"
          width={480}
          label="Edit Equipment Vendor"
        >
          <Layout
            header={
              <DrawerHeader
                title={editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Edit Vendor'}
                subtitle="Update vendor contacts, addresses, or active catalog status."
                onOpenChange={(open) => {
                  if (!open && !savingEdit) setEditingVendor(null);
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <ApiErrorBanner
                    title="Could not save vendor"
                    error={editError}
                    onDismiss={() => setEditError(null)}
                  />
                  <form id="edit-vendor-form" onSubmit={(e) => void handleEditSubmit(e)}>
                    <FormLayout>
                      <TextInput
                        label="Vendor Code"
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
                        label="Vendor Name"
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
                      <TextInput
                        label="Contact Person"
                        isRequired
                        value={editForm.contactPerson}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, contactPerson: value }));
                          setEditFieldErrors((prev) => ({ ...prev, contactPerson: undefined }));
                        }}
                        status={
                          editFieldErrors.contactPerson
                            ? { type: 'error', message: editFieldErrors.contactPerson }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Phone Number"
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
                      <TextInput
                        label="Email Address"
                        type="email"
                        isRequired
                        value={editForm.email}
                        onChange={(value) => {
                          setEditForm((prev) => ({ ...prev, email: value }));
                          setEditFieldErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        status={
                          editFieldErrors.email
                            ? { type: 'error', message: editFieldErrors.email }
                            : undefined
                        }
                      />
                      <TextArea
                        label="Address"
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
                      <Switch
                        label="Active Vendor"
                        description="Turn on to keep vendor eligible for procurement orders."
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
                    onClick={() => setEditingVendor(null)}
                  />
                  <Button
                    type="submit"
                    form="edit-vendor-form"
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
          isOpen={deletingVendor !== null}
          onOpenChange={(open) => {
            if (!open && !deleting) setDeletingVendor(null);
          }}
          title="Delete Equipment Vendor?"
          description={
            deletingVendor
              ? `Are you sure you want to delete vendor "${deletingVendor.name}" (${deletingVendor.code})? This action cannot be undone.`
              : ''
          }
          cancelLabel="Cancel"
          actionLabel="Delete Vendor"
          actionVariant="destructive"
          isActionLoading={deleting}
          onAction={() => void handleConfirmDelete()}
        />
      </Card>
    </VStack>
  );
}
