import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Switch } from '@astryxdesign/core/Switch';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  formatUsd,
  ServiceTypeToken,
  StatusLabel,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { archivePlan, createPlan, getPlans, updatePlan } from '../../services/catalogApi';
import type { PlanInput, PlanView, ServiceTypeCode } from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  SERVICE_TYPE_OPTIONS,
  validatePlanPrice,
  type AdminSectionProps,
  type PlanRow,
} from './adminTypes';

type TypeFilter = 'ALL' | ServiceTypeCode;

interface PlanFormState {
  name: string;
  type: ServiceTypeCode;
  priceText: string;
  description: string;
  active: boolean;
}

interface PlanFieldErrors {
  name?: string;
  type?: string;
  price?: string;
  description?: string;
}

const DEFAULT_CREATE_FORM: PlanFormState = {
  name: '',
  type: 'B',
  priceText: '',
  description: '',
  active: true,
};

function validatePlanForm(form: PlanFormState): {
  errors: PlanFieldErrors;
  parsedPrice: number | null;
} {
  const errors: PlanFieldErrors = {};
  const trimmedName = form.name.trim();
  if (!trimmedName) {
    errors.name = 'Plan name is required.';
  } else if (trimmedName.length > 100) {
    errors.name = 'Plan name must be 100 characters or fewer.';
  }

  if (form.type !== 'D' && form.type !== 'B' && form.type !== 'T') {
    errors.type = 'Select Dial-Up (D), Broadband (B), or Landline (T).';
  }

  const priceCheck = validatePlanPrice(form.priceText);
  if (!priceCheck.valid) {
    errors.price = priceCheck.message;
  }

  const trimmedDescription = form.description.trim();
  if (trimmedDescription.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    errors,
    parsedPrice: priceCheck.valid ? priceCheck.value : null,
  };
}

export function PlansSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PlanFormState>(DEFAULT_CREATE_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<PlanFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingPlan, setEditingPlan] = useState<PlanView | null>(null);
  const [editForm, setEditForm] = useState<PlanFormState>(DEFAULT_CREATE_FORM);
  const [editFieldErrors, setEditFieldErrors] = useState<PlanFieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [archivingPlan, setArchivingPlan] = useState<PlanView | null>(null);
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

  const loadPlans = useCallback(
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
        const data = await getPlans();
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setPlans(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load service plans.'));
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
    void loadPlans(isSilent);
  }, [loadPlans, refreshTrigger]);

  const filteredPlans = useMemo<PlanRow[]>(() => {
    const needle = searchQuery.trim().toLowerCase();
    return plans
      .filter((plan) => (typeFilter === 'ALL' ? true : plan.type === typeFilter))
      .filter((plan) => {
        if (!needle) return true;
        return (
          plan.name.toLowerCase().includes(needle) ||
          plan.description.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => Number(b.active) - Number(a.active))
      .map((plan) => ({ ...plan }));
  }, [plans, searchQuery, typeFilter]);

  const pagination = useClientPagination(filteredPlans, {
    resetKey: `${typeFilter}::${searchQuery.trim().toLowerCase()}`,
  });

  const openCreateDrawer = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setCreateFieldErrors({});
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEditDialog = (plan: PlanView) => {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      type: plan.type,
      priceText: String(plan.price),
      description: plan.description ?? '',
      active: plan.active,
    });
    setEditFieldErrors({});
    setEditError(null);
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;
    const { errors, parsedPrice } = validatePlanForm(createForm);
    setCreateFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length > 0 || parsedPrice === null) {
      return;
    }

    const payload: PlanInput = {
      name: createForm.name.trim(),
      type: createForm.type,
      description: createForm.description.trim() || null,
      price: parsedPrice,
      active: createForm.active,
    };

    setCreating(true);
    try {
      const created = await createPlan(payload);
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      toast({ body: `Created service plan "${created.name}".` });
      pagination.focusItem((item) => item.id === created.id);
      await loadPlans(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setCreateFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        type: serverFields.type ?? prev.type,
        price: serverFields.price ?? prev.price,
        description: serverFields.description ?? prev.description,
      }));
      setCreateError(extractErrorMessage(err, 'Could not create service plan.'));
    } finally {
      if (isMountedRef.current) {
        setCreating(false);
      }
    }
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingEdit || !editingPlan) return;

    const { errors, parsedPrice } = validatePlanForm(editForm);
    setEditFieldErrors(errors);
    setEditError(null);
    if (Object.keys(errors).length > 0 || parsedPrice === null) {
      return;
    }

    const payload: PlanInput = {
      name: editForm.name.trim(),
      type: editForm.type,
      description: editForm.description.trim() || null,
      price: parsedPrice,
      active: editForm.active,
    };

    setSavingEdit(true);
    try {
      const updated = await updatePlan(editingPlan.id, payload);
      if (!isMountedRef.current) return;
      setEditingPlan(null);
      toast({ body: `Updated service plan "${updated.name}".` });
      pagination.focusItem((item) => item.id === updated.id);
      await loadPlans(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setEditFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        type: serverFields.type ?? prev.type,
        price: serverFields.price ?? prev.price,
        description: serverFields.description ?? prev.description,
      }));
      setEditError(extractErrorMessage(err, 'Could not update service plan.'));
    } finally {
      if (isMountedRef.current) {
        setSavingEdit(false);
      }
    }
  };

  const handleToggleActive = async (plan: PlanRow, nextActive: boolean) => {
    if (togglingId !== null) return;
    setTogglingId(plan.id);
    setLoadError(null);
    try {
      const updated = await updatePlan(plan.id, {
        name: plan.name,
        type: plan.type,
        description: plan.description || null,
        price: plan.price,
        active: nextActive,
      });
      if (!isMountedRef.current) return;
      toast({
        body: nextActive
          ? `Reactivated plan "${updated.name}".`
          : `Deactivated plan "${updated.name}".`,
      });
      pagination.focusItem((item) => item.id === updated.id);
      await loadPlans(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(extractErrorMessage(err, `Failed to update status for "${plan.name}".`));
    } finally {
      if (isMountedRef.current) {
        setTogglingId(null);
      }
    }
  };

  const handleConfirmArchive = async () => {
    if (archiving || !archivingPlan) return;
    setArchiving(true);
    setLoadError(null);
    try {
      const targetId = archivingPlan.id;
      const targetName = archivingPlan.name;
      await archivePlan(targetId);
      if (!isMountedRef.current) return;
      setArchivingPlan(null);
      toast({ body: `Archived plan "${targetName}".` });
      pagination.focusItem((item) => item.id === targetId);
      await loadPlans(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setArchivingPlan(null);
      setLoadError(extractErrorMessage(err, 'Failed to archive service plan.'));
    } finally {
      if (isMountedRef.current) {
        setArchiving(false);
      }
    }
  };

  const columns: TableColumn<PlanRow>[] = [
    {
      key: 'name',
      header: 'Plan Name',
      width: proportional(1.4, { minWidth: 160 }),
      renderCell: (row) => <Text weight="semibold">{row.name}</Text>,
    },
    {
      key: 'type',
      header: 'Type',
      width: pixel(140),
      renderCell: (row) => <ServiceTypeToken type={row.type} />,
    },
    {
      key: 'description',
      header: 'Description',
      width: proportional(2, { minWidth: 180 }),
      renderCell: (row) => (
        <Text type="supporting">{row.description ? row.description : '—'}</Text>
      ),
    },
    {
      key: 'price',
      header: 'Monthly Price',
      width: pixel(130),
      align: 'end',
      renderCell: (row) => <Text weight="semibold">{`${formatUsd(row.price)}/mo`}</Text>,
    },
    {
      key: 'active',
      header: 'Status',
      width: pixel(165),
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
            onClick={() => setArchivingPlan(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <Card padding={6}>
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <SegmentedControl
              label="Filter plans by service type"
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as TypeFilter)}
            >
              <SegmentedControlItem value="ALL" label="All" />
              <SegmentedControlItem value="D" label="Dial-Up (D)" />
              <SegmentedControlItem value="B" label="Broadband (B)" />
              <SegmentedControlItem value="T" label="Landline (T)" />
            </SegmentedControl>
            <Badge variant="neutral" label={`${filteredPlans.length} total`} />
          </HStack>

          <HStack gap={2} vAlign="end" wrap="wrap">
            <TextInput
              type="search"
              label="Filter Plans"
              isLabelHidden
              placeholder="Search plan name or description..."
              startIcon={<Icon icon="search" />}
              hasClear
              width={260}
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <Button variant="primary" label="Create Plan" onClick={openCreateDrawer} />
          </HStack>
        </HStack>

        <ApiErrorBanner
          title="Service plans error"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading && plans.length === 0 ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading service plans..." />
              <Text type="supporting">Loading service plans from catalog...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<PlanRow>
              aria-label="Service Plans Catalog"
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
                  title="No service plans match"
                  description={
                    typeFilter === 'ALL' && !searchQuery.trim()
                      ? 'Create a service plan to make it available in the catalog.'
                      : 'Try clearing the search query or selecting All service types.'
                  }
                  icon={<Icon icon="info" />}
                  actions={
                    typeFilter === 'ALL' && !searchQuery.trim() ? (
                      <Button variant="primary" label="Create Plan" onClick={openCreateDrawer} />
                    ) : (
                      <Button
                        variant="secondary"
                        label="Reset Filters"
                        onClick={() => {
                          setTypeFilter('ALL');
                          setSearchQuery('');
                        }}
                      />
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
              label="Service plans pagination"
            />
          </>
        )}
      </VStack>

      <Drawer
        isOpen={isCreateOpen}
        onOpenChange={(open) => {
          if (!creating) setIsCreateOpen(open);
        }}
        side="end"
        width={480}
        purpose="form"
        label="Create Service Plan"
      >
        <Layout
          header={
            <DrawerHeader
              title="Create Service Plan"
              subtitle="Define a Dial-Up, Broadband, or Landline tariff."
              onOpenChange={(open) => {
                if (!creating) setIsCreateOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Could not create plan"
                  error={createError}
                  onDismiss={() => setCreateError(null)}
                />
                <form id="create-plan-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                  <FormLayout>
                    <TextInput
                      label="Plan Name"
                      placeholder="e.g. Broadband Fiber 50"
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
                                message: 'Plan name must be 100 characters or fewer.',
                              }
                            : undefined
                      }
                    />
                    <Selector
                      label="Service Type"
                      isRequired
                      options={SERVICE_TYPE_OPTIONS}
                      value={createForm.type}
                      onChange={(value) => {
                        setCreateForm((prev) => ({
                          ...prev,
                          type: value as ServiceTypeCode,
                        }));
                        setCreateFieldErrors((prev) => ({ ...prev, type: undefined }));
                      }}
                      status={
                        createFieldErrors.type
                          ? { type: 'error', message: createFieldErrors.type }
                          : undefined
                      }
                    />
                    <TextInput
                      label="Monthly Price (USD)"
                      placeholder="e.g. 49.99"
                      inputMode="decimal"
                      description="Amount of $0.00 or greater with up to 2 decimal places."
                      isRequired
                      value={createForm.priceText}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, priceText: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, price: undefined }));
                      }}
                      status={
                        createFieldErrors.price
                          ? { type: 'error', message: createFieldErrors.price }
                          : undefined
                      }
                    />
                    <TextArea
                      label="Description"
                      placeholder="Bandwidth, included hours, or call tariff summary..."
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
                    <Switch
                      label="Active in Catalog"
                      description="Active plans are selectable when Retail staff submit new connection requests."
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
                  form="create-plan-form"
                  variant="primary"
                  label="Create Plan"
                  isLoading={creating}
                  isDisabled={creating}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>

      <Dialog
        isOpen={editingPlan !== null}
        onOpenChange={(open) => {
          if (!open && !savingEdit) setEditingPlan(null);
        }}
        purpose="form"
        width={520}
      >
        <Layout
          header={
            <DialogHeader
              title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Edit Service Plan'}
              subtitle="Update plan pricing, service type, or reactivate an archived plan."
              onOpenChange={(open) => {
                if (!open && !savingEdit) setEditingPlan(null);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Could not save plan"
                  error={editError}
                  onDismiss={() => setEditError(null)}
                />
                <form id="edit-plan-form" onSubmit={(e) => void handleEditSubmit(e)}>
                  <FormLayout>
                    <TextInput
                      label="Plan Name"
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
                                message: 'Plan name must be 100 characters or fewer.',
                              }
                            : undefined
                      }
                    />
                    <Selector
                      label="Service Type"
                      isRequired
                      options={SERVICE_TYPE_OPTIONS}
                      value={editForm.type}
                      onChange={(value) => {
                        setEditForm((prev) => ({
                          ...prev,
                          type: value as ServiceTypeCode,
                        }));
                        setEditFieldErrors((prev) => ({ ...prev, type: undefined }));
                      }}
                      status={
                        editFieldErrors.type
                          ? { type: 'error', message: editFieldErrors.type }
                          : undefined
                      }
                    />
                    <TextInput
                      label="Monthly Price (USD)"
                      inputMode="decimal"
                      description="Amount of $0.00 or greater with up to 2 decimal places."
                      isRequired
                      value={editForm.priceText}
                      onChange={(value) => {
                        setEditForm((prev) => ({ ...prev, priceText: value }));
                        setEditFieldErrors((prev) => ({ ...prev, price: undefined }));
                      }}
                      status={
                        editFieldErrors.price
                          ? { type: 'error', message: editFieldErrors.price }
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
                    <Switch
                      label="Active in Catalog"
                      description="Turn on to make an archived plan selectable for new requests again."
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
                  onClick={() => setEditingPlan(null)}
                />
                <Button
                  type="submit"
                  form="edit-plan-form"
                  variant="primary"
                  label="Save Changes"
                  isLoading={savingEdit}
                  isDisabled={savingEdit}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <AlertDialog
        isOpen={archivingPlan !== null}
        onOpenChange={(open) => {
          if (!open && !archiving) setArchivingPlan(null);
        }}
        title="Archive Service Plan?"
        description={
          archivingPlan
            ? `Archiving "${archivingPlan.name}" sets it to inactive so Retail staff cannot submit new requests with it. Existing requests and orders preserve their original plan snapshot.`
            : ''
        }
        cancelLabel="Cancel"
        actionLabel="Archive Plan"
        actionVariant="destructive"
        isActionLoading={archiving}
        onAction={() => void handleConfirmArchive()}
      />
    </Card>
  );
}
