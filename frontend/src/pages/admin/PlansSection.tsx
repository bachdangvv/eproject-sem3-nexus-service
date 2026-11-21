/**
 * Admin service tariff plan catalog management section supporting Dial-Up, Broadband, and Landline plans.
 */
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
import {
  formatPlanCycleLabel,
  formatPlanPriceWithCycle,
  VALIDITY_MONTH_OPTIONS,
} from '../../data/tariffs';
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
  validityMonths: string;
  priceText: string;
  hoursAllowanceText: string;
  speedKbpsText: string;
  localCallRateText: string;
  stdCallRateText: string;
  mobileMsgRateText: string;
  description: string;
  active: boolean;
}

interface PlanFieldErrors {
  name?: string;
  type?: string;
  validityMonths?: string;
  price?: string;
  hoursAllowance?: string;
  speedKbps?: string;
  localCallRate?: string;
  stdCallRate?: string;
  mobileMsgRate?: string;
  description?: string;
}

const DEFAULT_CREATE_FORM: PlanFormState = {
  name: '',
  type: 'B',
  validityMonths: '1',
  priceText: '',
  hoursAllowanceText: '',
  speedKbpsText: '',
  localCallRateText: '0',
  stdCallRateText: '0',
  mobileMsgRateText: '0',
  description: '',
  active: true,
};

function parseOptionalPositiveInt(
  raw: string,
  min: number,
  max: number,
  label: string,
): { valid: true; value: number | null } | { valid: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, message: `${label} must be a whole number.` };
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return {
      valid: false,
      message: `${label} must be between ${min} and ${max.toLocaleString()}.`,
    };
  }
  return { valid: true, value: parsed };
}

function parseCallRateField(raw: string, label: string): { valid: true; value: number } | { valid: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: 0 };
  const check = validatePlanPrice(trimmed);
  if (!check.valid) {
    return { valid: false, message: `Enter a valid ${label} ($0.00 or greater, up to 2 decimals).` };
  }
  return check;
}

function validatePlanForm(form: PlanFormState): {
  errors: PlanFieldErrors;
  parsedPrice: number | null;
  parsedValidityMonths: number;
  parsedHoursAllowance: number | null;
  parsedSpeedKbps: number | null;
  parsedLocalRate: number;
  parsedStdRate: number;
  parsedMobileRate: number;
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

  const parsedValidityMonths = Number(form.validityMonths);
  if (
    parsedValidityMonths !== 1 &&
    parsedValidityMonths !== 3 &&
    parsedValidityMonths !== 6 &&
    parsedValidityMonths !== 12
  ) {
    errors.validityMonths = 'Select 1, 3, 6, or 12 months.';
  }

  const priceCheck = validatePlanPrice(form.priceText);
  if (!priceCheck.valid) {
    errors.price = priceCheck.message;
  }

  const hoursCheck = parseOptionalPositiveInt(
    form.hoursAllowanceText,
    1,
    100000,
    'Hours allowance',
  );
  if (!hoursCheck.valid) {
    errors.hoursAllowance = hoursCheck.message;
  }

  const speedCheck = parseOptionalPositiveInt(
    form.speedKbpsText,
    1,
    10000000,
    'Speed (Kbps)',
  );
  if (!speedCheck.valid) {
    errors.speedKbps = speedCheck.message;
  }

  let parsedLocalRate = 0;
  let parsedStdRate = 0;
  let parsedMobileRate = 0;
  if (form.type === 'T') {
    const localCheck = parseCallRateField(form.localCallRateText, 'local call rate');
    if (!localCheck.valid) errors.localCallRate = localCheck.message;
    else parsedLocalRate = localCheck.value;

    const stdCheck = parseCallRateField(form.stdCallRateText, 'STD call rate');
    if (!stdCheck.valid) errors.stdCallRate = stdCheck.message;
    else parsedStdRate = stdCheck.value;

    const mobileCheck = parseCallRateField(form.mobileMsgRateText, 'mobile messaging rate');
    if (!mobileCheck.valid) errors.mobileMsgRate = mobileCheck.message;
    else parsedMobileRate = mobileCheck.value;
  }

  const trimmedDescription = form.description.trim();
  if (trimmedDescription.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    errors,
    parsedPrice: priceCheck.valid ? priceCheck.value : null,
    parsedValidityMonths: Number.isInteger(parsedValidityMonths) ? parsedValidityMonths : 1,
    parsedHoursAllowance: hoursCheck.valid ? hoursCheck.value : null,
    parsedSpeedKbps: speedCheck.valid ? speedCheck.value : null,
    parsedLocalRate,
    parsedStdRate,
    parsedMobileRate,
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
      validityMonths: String(plan.validityMonths ?? 1),
      priceText: String(plan.price),
      hoursAllowanceText: plan.hoursAllowance != null ? String(plan.hoursAllowance) : '',
      speedKbpsText: plan.speedKbps != null ? String(plan.speedKbps) : '',
      localCallRateText: String(plan.localCallRate ?? 0),
      stdCallRateText: String(plan.stdCallRate ?? 0),
      mobileMsgRateText: String(plan.mobileMsgRate ?? 0),
      description: plan.description ?? '',
      active: plan.active,
    });
    setEditFieldErrors({});
    setEditError(null);
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;
    const {
      errors,
      parsedPrice,
      parsedValidityMonths,
      parsedHoursAllowance,
      parsedSpeedKbps,
      parsedLocalRate,
      parsedStdRate,
      parsedMobileRate,
    } = validatePlanForm(createForm);
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
      localCallRate: parsedLocalRate,
      stdCallRate: parsedStdRate,
      mobileMsgRate: parsedMobileRate,
      validityMonths: parsedValidityMonths,
      hoursAllowance: parsedHoursAllowance,
      speedKbps: parsedSpeedKbps,
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
        validityMonths: serverFields.validitymonths ?? prev.validityMonths,
        price: serverFields.price ?? prev.price,
        hoursAllowance: serverFields.hoursallowance ?? prev.hoursAllowance,
        speedKbps: serverFields.speedkbps ?? prev.speedKbps,
        localCallRate: serverFields.localcallrate ?? prev.localCallRate,
        stdCallRate: serverFields.stdcallrate ?? prev.stdCallRate,
        mobileMsgRate: serverFields.mobilemsgrate ?? prev.mobileMsgRate,
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

    const {
      errors,
      parsedPrice,
      parsedValidityMonths,
      parsedHoursAllowance,
      parsedSpeedKbps,
      parsedLocalRate,
      parsedStdRate,
      parsedMobileRate,
    } = validatePlanForm(editForm);
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
      localCallRate: parsedLocalRate,
      stdCallRate: parsedStdRate,
      mobileMsgRate: parsedMobileRate,
      validityMonths: parsedValidityMonths,
      hoursAllowance: parsedHoursAllowance,
      speedKbps: parsedSpeedKbps,
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
        validityMonths: serverFields.validitymonths ?? prev.validityMonths,
        price: serverFields.price ?? prev.price,
        hoursAllowance: serverFields.hoursallowance ?? prev.hoursAllowance,
        speedKbps: serverFields.speedkbps ?? prev.speedKbps,
        localCallRate: serverFields.localcallrate ?? prev.localCallRate,
        stdCallRate: serverFields.stdcallrate ?? prev.stdCallRate,
        mobileMsgRate: serverFields.mobilemsgrate ?? prev.mobileMsgRate,
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
        localCallRate: plan.localCallRate ?? 0,
        stdCallRate: plan.stdCallRate ?? 0,
        mobileMsgRate: plan.mobileMsgRate ?? 0,
        validityMonths: plan.validityMonths ?? 1,
        hoursAllowance: plan.hoursAllowance ?? null,
        speedKbps: plan.speedKbps ?? null,
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
      key: 'validityMonths',
      header: 'Cycle',
      width: pixel(140),
      renderCell: (row) => (
        <Text type="supporting">{formatPlanCycleLabel(row.validityMonths)}</Text>
      ),
    },
    {
      key: 'price',
      header: 'Cycle Price',
      width: pixel(135),
      align: 'end',
      renderCell: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatPlanPriceWithCycle(row.price, row.validityMonths)}
        </Text>
      ),
    },
    {
      key: 'specs',
      header: 'Specs',
      width: pixel(130),
      renderCell: (row) => {
        const parts: string[] = [];
        if (row.hoursAllowance != null) parts.push(`${row.hoursAllowance} hrs`);
        if (row.speedKbps != null) parts.push(`${row.speedKbps} Kbps`);
        return <Text type="supporting">{parts.length > 0 ? parts.join(' · ') : '—'}</Text>;
      },
    },
    {
      key: 'callRates',
      header: 'Call Tariffs ($/min)',
      width: pixel(210),
      renderCell: (row) =>
        row.type === 'T' ? (
          <Text type="supporting">
            {`Local ${formatUsd(row.localCallRate ?? 0)} · STD ${formatUsd(row.stdCallRate ?? 0)} · Msg ${formatUsd(row.mobileMsgRate ?? 0)}`}
          </Text>
        ) : (
          <Text type="supporting">—</Text>
        ),
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
                    <Selector
                      label="Billing Cycle (Validity)"
                      isRequired
                      options={VALIDITY_MONTH_OPTIONS}
                      value={createForm.validityMonths}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, validityMonths: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, validityMonths: undefined }));
                      }}
                      status={
                        createFieldErrors.validityMonths
                          ? { type: 'error', message: createFieldErrors.validityMonths }
                          : undefined
                      }
                    />
                    <TextInput
                      label="Cycle Price (USD)"
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
                    <TextInput
                      label="Hours Allowance"
                      placeholder="e.g. 30"
                      inputMode="numeric"
                      isOptional
                      description="Optional included connection hours (1–100,000)."
                      value={createForm.hoursAllowanceText}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, hoursAllowanceText: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, hoursAllowance: undefined }));
                      }}
                      status={
                        createFieldErrors.hoursAllowance
                          ? { type: 'error', message: createFieldErrors.hoursAllowance }
                          : undefined
                      }
                    />
                    <TextInput
                      label="Speed (Kbps)"
                      placeholder="e.g. 64"
                      inputMode="numeric"
                      isOptional
                      description="Optional bandwidth speed in Kbps (1–10,000,000)."
                      value={createForm.speedKbpsText}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, speedKbpsText: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, speedKbps: undefined }));
                      }}
                      status={
                        createFieldErrors.speedKbps
                          ? { type: 'error', message: createFieldErrors.speedKbps }
                          : undefined
                      }
                    />
                    {createForm.type === 'T' && (
                      <>
                        <TextInput
                          label="Local Call Rate (USD / minute)"
                          placeholder="e.g. 0.75"
                          inputMode="decimal"
                          isOptional
                          value={createForm.localCallRateText}
                          onChange={(value) => {
                            setCreateForm((prev) => ({ ...prev, localCallRateText: value }));
                            setCreateFieldErrors((prev) => ({ ...prev, localCallRate: undefined }));
                          }}
                          status={
                            createFieldErrors.localCallRate
                              ? { type: 'error', message: createFieldErrors.localCallRate }
                              : undefined
                          }
                        />
                        <TextInput
                          label="STD Call Rate (USD / minute)"
                          placeholder="e.g. 2.25"
                          inputMode="decimal"
                          isOptional
                          value={createForm.stdCallRateText}
                          onChange={(value) => {
                            setCreateForm((prev) => ({ ...prev, stdCallRateText: value }));
                            setCreateFieldErrors((prev) => ({ ...prev, stdCallRate: undefined }));
                          }}
                          status={
                            createFieldErrors.stdCallRate
                              ? { type: 'error', message: createFieldErrors.stdCallRate }
                              : undefined
                          }
                        />
                        <TextInput
                          label="Mobile Messaging Rate (USD / minute)"
                          placeholder="e.g. 1.00"
                          inputMode="decimal"
                          isOptional
                          value={createForm.mobileMsgRateText}
                          onChange={(value) => {
                            setCreateForm((prev) => ({ ...prev, mobileMsgRateText: value }));
                            setCreateFieldErrors((prev) => ({ ...prev, mobileMsgRate: undefined }));
                          }}
                          status={
                            createFieldErrors.mobileMsgRate
                              ? { type: 'error', message: createFieldErrors.mobileMsgRate }
                              : undefined
                          }
                        />
                      </>
                    )}
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
                    <Selector
                      label="Billing Cycle (Validity)"
                      isRequired
                      options={VALIDITY_MONTH_OPTIONS}
                      value={editForm.validityMonths}
                      onChange={(value) => {
                        setEditForm((prev) => ({ ...prev, validityMonths: value }));
                        setEditFieldErrors((prev) => ({ ...prev, validityMonths: undefined }));
                      }}
                      status={
                        editFieldErrors.validityMonths
                          ? { type: 'error', message: editFieldErrors.validityMonths }
                          : undefined
                      }
                    />
                    <TextInput
                      label="Cycle Price (USD)"
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
                    <TextInput
                      label="Hours Allowance"
                      placeholder="e.g. 30"
                      inputMode="numeric"
                      isOptional
                      description="Optional included connection hours (1–100,000)."
                      value={editForm.hoursAllowanceText}
                      onChange={(value) => {
                        setEditForm((prev) => ({ ...prev, hoursAllowanceText: value }));
                        setEditFieldErrors((prev) => ({ ...prev, hoursAllowance: undefined }));
                      }}
                      status={
                        editFieldErrors.hoursAllowance
                          ? { type: 'error', message: editFieldErrors.hoursAllowance }
                          : undefined
                      }
                    />
                    <TextInput
                      label="Speed (Kbps)"
                      placeholder="e.g. 64"
                      inputMode="numeric"
                      isOptional
                      description="Optional bandwidth speed in Kbps (1–10,000,000)."
                      value={editForm.speedKbpsText}
                      onChange={(value) => {
                        setEditForm((prev) => ({ ...prev, speedKbpsText: value }));
                        setEditFieldErrors((prev) => ({ ...prev, speedKbps: undefined }));
                      }}
                      status={
                        editFieldErrors.speedKbps
                          ? { type: 'error', message: editFieldErrors.speedKbps }
                          : undefined
                      }
                    />
                    {editForm.type === 'T' && (
                      <>
                        <TextInput
                          label="Local Call Rate (USD / minute)"
                          inputMode="decimal"
                          isOptional
                          value={editForm.localCallRateText}
                          onChange={(value) => {
                            setEditForm((prev) => ({ ...prev, localCallRateText: value }));
                            setEditFieldErrors((prev) => ({ ...prev, localCallRate: undefined }));
                          }}
                          status={
                            editFieldErrors.localCallRate
                              ? { type: 'error', message: editFieldErrors.localCallRate }
                              : undefined
                          }
                        />
                        <TextInput
                          label="STD Call Rate (USD / minute)"
                          inputMode="decimal"
                          isOptional
                          value={editForm.stdCallRateText}
                          onChange={(value) => {
                            setEditForm((prev) => ({ ...prev, stdCallRateText: value }));
                            setEditFieldErrors((prev) => ({ ...prev, stdCallRate: undefined }));
                          }}
                          status={
                            editFieldErrors.stdCallRate
                              ? { type: 'error', message: editFieldErrors.stdCallRate }
                              : undefined
                          }
                        />
                        <TextInput
                          label="Mobile Messaging Rate (USD / minute)"
                          inputMode="decimal"
                          isOptional
                          value={editForm.mobileMsgRateText}
                          onChange={(value) => {
                            setEditForm((prev) => ({ ...prev, mobileMsgRateText: value }));
                            setEditFieldErrors((prev) => ({ ...prev, mobileMsgRate: undefined }));
                          }}
                          status={
                            editFieldErrors.mobileMsgRate
                              ? { type: 'error', message: editFieldErrors.mobileMsgRate }
                              : undefined
                          }
                        />
                      </>
                    )}
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
