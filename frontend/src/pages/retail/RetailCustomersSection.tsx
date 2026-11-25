/**
 * Retail customer onboarding, profile editor, and Document Archive workspace section.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, CopyableId, CustomerStatusPill } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import { getCities } from '../../services/catalogApi';
import { createCustomer, getCustomers, updateCustomer } from '../../services/operationsApi';
import type { CityView, CustomerInput, CustomerStatus, CustomerView } from '../../types/nexus';
import { DocumentsSection } from '../shared/DocumentsSection';
import {
  CITY_CODE_REGEX,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  EMAIL_REGEX,
  extractErrorMessage,
  extractFieldErrors,
  PHONE_REGEX,
  type CustomerRow,
  type RetailSectionProps,
} from './retailTypes';

interface CustomerFormState {
  name: string;
  phone: string;
  cityCode: string;
  address: string;
  customerType: string;
  contactPerson: string;
  email: string;
  taxId: string;
  status: CustomerStatus;
}

interface CustomerFieldErrors {
  name?: string;
  phone?: string;
  cityCode?: string;
  address?: string;
  customerType?: string;
  contactPerson?: string;
  email?: string;
  taxId?: string;
  status?: string;
}

function createEmptyForm(defaultCityCode = ''): CustomerFormState {
  return {
    name: '',
    phone: '',
    cityCode: defaultCityCode,
    address: '',
    customerType: 'Corporate',
    contactPerson: '',
    email: '',
    taxId: '',
    status: 'ACTIVE',
  };
}

function validateCustomerForm(
  form: CustomerFormState,
  cityCodes: Set<string>,
  requireStatus: boolean,
): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {};

  const trimmedName = form.name.trim();
  if (!trimmedName) {
    errors.name = 'Customer name is required.';
  } else if (trimmedName.length > 120) {
    errors.name = 'Customer name must be 120 characters or fewer.';
  }

  const trimmedPhone = form.phone.trim();
  if (!trimmedPhone) {
    errors.phone = 'Phone number is required.';
  } else if (!PHONE_REGEX.test(trimmedPhone)) {
    errors.phone = 'Enter 7–15 digits with an optional leading + (no spaces or hyphens).';
  }

  const trimmedCityCode = form.cityCode.trim();
  if (!trimmedCityCode) {
    errors.cityCode = 'Select a territory city.';
  } else if (!CITY_CODE_REGEX.test(trimmedCityCode)) {
    errors.cityCode = 'City code must be a 3-digit numeric code.';
  } else if (cityCodes.size > 0 && !cityCodes.has(trimmedCityCode)) {
    errors.cityCode = 'Select an existing city from the territory list.';
  }

  const trimmedAddress = form.address.trim();
  if (!trimmedAddress) {
    errors.address = 'Installation address is required.';
  } else if (trimmedAddress.length > 240) {
    errors.address = 'Installation address must be 240 characters or fewer.';
  }

  const trimmedType = form.customerType.trim();
  if (trimmedType.length > 40) {
    errors.customerType = 'Customer type must be 40 characters or fewer.';
  }

  const trimmedContact = form.contactPerson.trim();
  if (trimmedContact.length > 120) {
    errors.contactPerson = 'Contact person must be 120 characters or fewer.';
  }

  const trimmedEmail = form.email.trim();
  if (trimmedEmail) {
    if (trimmedEmail.length > 160) {
      errors.email = 'Email address must be 160 characters or fewer.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address.';
    }
  }

  const trimmedTaxId = form.taxId.trim();
  if (trimmedTaxId.length > 32) {
    errors.taxId = 'Tax ID must be 32 characters or fewer.';
  }

  if (requireStatus && form.status !== 'ACTIVE' && form.status !== 'SUSPENDED') {
    errors.status = 'Status must be ACTIVE or SUSPENDED.';
  }

  return errors;
}

export function RetailCustomersSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
  initialView = 'directory',
}: RetailSectionProps & { initialView?: 'directory' | 'documents' }): JSX.Element {
  const toast = useToast();
  const { navigate } = useRouter();
  const viewMode = initialView;

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerView | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CustomerFormState>(() => createEmptyForm());
  const [createFieldErrors, setCreateFieldErrors] = useState<CustomerFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<CustomerView | null>(null);
  const [editForm, setEditForm] = useState<CustomerFormState>(() => createEmptyForm());
  const [editFieldErrors, setEditFieldErrors] = useState<CustomerFieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const isMountedRef = useRef(true);
  const creatingRef = useRef(false);
  const savingEditRef = useRef(false);

  const trimmedInput = searchInput.trim();
  const isQueryTooLong = trimmedInput.length > 120;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getCities()
      .then((list) => {
        if (!active || !isMountedRef.current) return;
        setCities(list);
        setCitiesLoaded(true);
      })
      .catch(() => {
        if (!active || !isMountedRef.current) return;
        setCitiesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  useEffect(() => {
    if (isQueryTooLong) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(trimmedInput);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isQueryTooLong, trimmedInput]);

  const fetchCustomers = useCallback(
    async (query: string, silent = false) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const data = await getCustomers(query || undefined);
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setCustomers(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load customer directory.'));
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
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled && isMountedRef.current) {
        return fetchCustomers(debouncedQuery, isSilent);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, fetchCustomers, refreshTrigger]);

  const cityNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const city of cities) {
      map.set(city.code, city.name);
    }
    return map;
  }, [cities]);

  const cityCodeSet = useMemo(() => new Set(cities.map((c) => c.code)), [cities]);

  const cityOptions = useMemo(
    () =>
      cities.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    [cities],
  );

  const editTypeOptions = useMemo(() => {
    const current = editForm.customerType.trim();
    if (!current || CUSTOMER_TYPE_OPTIONS.some((opt) => opt.value === current)) {
      return CUSTOMER_TYPE_OPTIONS;
    }
    return [...CUSTOMER_TYPE_OPTIONS, { value: current, label: current }];
  }, [editForm.customerType]);

  const formatCityDisplay = (cityCode: string): string => {
    const cityName = cityNameByCode.get(cityCode);
    return cityName ? `${cityCode} — ${cityName}` : `City ${cityCode}`;
  };

  const customerRows = useMemo<CustomerRow[]>(
    () => customers.map((customer) => ({ ...customer })),
    [customers],
  );
  const pagination = useClientPagination(customerRows, {
    resetKey: debouncedQuery,
  });

  const openCreateDrawer = () => {
    const defaultCity = cities[0]?.code ?? '';
    setCreateForm(createEmptyForm(defaultCity));
    setCreateFieldErrors({});
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEditDialog = (customer: CustomerView) => {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      cityCode: customer.cityCode,
      address: customer.address,
      customerType: customer.customerType || 'Corporate',
      contactPerson: customer.contactPerson ?? '',
      email: customer.email ?? '',
      taxId: customer.taxId ?? '',
      status: customer.status,
    });
    setEditFieldErrors({});
    setEditError(null);
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creatingRef.current || creating) return;

    const errors = validateCustomerForm(createForm, cityCodeSet, false);
    setCreateFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload: CustomerInput = {
      name: createForm.name.trim(),
      phone: createForm.phone.trim(),
      cityCode: createForm.cityCode.trim(),
      address: createForm.address.trim(),
      customerType: createForm.customerType.trim() || 'Corporate',
      contactPerson: createForm.contactPerson.trim() || null,
      email: createForm.email.trim() || null,
      taxId: createForm.taxId.trim() || null,
      status: 'ACTIVE',
    };

    creatingRef.current = true;
    setCreating(true);
    try {
      const created = await createCustomer(payload);
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      setCreateForm(createEmptyForm(cities[0]?.code ?? ''));
      setCreateFieldErrors({});
      setCreateError(null);
      toast({ body: `Registered customer ${created.code} (${created.name}).` });
      pagination.focusItem((item) => item.id === created.id);
      creatingRef.current = false;
      setCreating(false);
      if (debouncedQuery !== '') {
        setSearchInput('');
        setDebouncedQuery('');
      } else {
        void fetchCustomers('', true);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setCreateFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        phone: serverFields.phone ?? prev.phone,
        cityCode: serverFields.citycode ?? prev.cityCode,
        address: serverFields.address ?? prev.address,
        customerType: serverFields.customertype ?? prev.customerType,
        contactPerson: serverFields.contactperson ?? prev.contactPerson,
        email: serverFields.email ?? prev.email,
        taxId: serverFields.taxid ?? prev.taxId,
      }));
      setCreateError(extractErrorMessage(err, 'Could not register customer.'));
    } finally {
      creatingRef.current = false;
      if (isMountedRef.current) {
        setCreating(false);
      }
    }
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingEditRef.current || savingEdit || !editingCustomer) return;

    const errors = validateCustomerForm(editForm, cityCodeSet, true);
    setEditFieldErrors(errors);
    setEditError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload: CustomerInput = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      cityCode: editForm.cityCode.trim(),
      address: editForm.address.trim(),
      customerType: editForm.customerType.trim() || 'Corporate',
      contactPerson: editForm.contactPerson.trim() || null,
      email: editForm.email.trim() || null,
      taxId: editForm.taxId.trim() || null,
      status: editForm.status,
    };

    savingEditRef.current = true;
    setSavingEdit(true);
    try {
      const updated = await updateCustomer(editingCustomer.id, payload);
      if (!isMountedRef.current) return;
      setEditingCustomer(null);
      if (selectedCustomer?.id === updated.id) {
        setSelectedCustomer(updated);
      }
      toast({ body: `Updated customer ${updated.code} (${updated.name}).` });
      pagination.focusItem((item) => item.id === updated.id);
      savingEditRef.current = false;
      setSavingEdit(false);
      void fetchCustomers(debouncedQuery, true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setEditFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        phone: serverFields.phone ?? prev.phone,
        cityCode: serverFields.citycode ?? prev.cityCode,
        address: serverFields.address ?? prev.address,
        customerType: serverFields.customertype ?? prev.customerType,
        contactPerson: serverFields.contactperson ?? prev.contactPerson,
        email: serverFields.email ?? prev.email,
        taxId: serverFields.taxid ?? prev.taxId,
        status: serverFields.status ?? prev.status,
      }));
      setEditError(extractErrorMessage(err, 'Could not update customer profile.'));
    } finally {
      savingEditRef.current = false;
      if (isMountedRef.current) {
        setSavingEdit(false);
      }
    }
  };

  const columns: TableColumn<CustomerRow>[] = [
    {
      key: 'code',
      header: 'Customer Code',
      width: pixel(200),
      renderCell: (row) => <CopyableId value={row.code} label="Customer Code" />,
    },
    {
      key: 'name',
      header: 'Customer Name',
      width: proportional(2, { minWidth: 180 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.name}</Text>
          {row.email ? (
            <Text type="supporting">{row.email}</Text>
          ) : row.customerType ? (
            <Text type="supporting">{row.customerType}</Text>
          ) : null}
        </VStack>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      width: pixel(140),
      renderCell: (row) => <Text type="body">{row.phone}</Text>,
    },
    {
      key: 'cityCode',
      header: 'City',
      width: pixel(155),
      renderCell: (row) => (
        <Token size="sm" color="gray" label={formatCityDisplay(row.cityCode)} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(135),
      renderCell: (row) => <CustomerStatusPill status={row.status} />,
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
            variant="ghost"
            label="View"
            onClick={() => setSelectedCustomer(row)}
          />
          <Button
            size="sm"
            variant="secondary"
            label="Edit"
            onClick={() => openEditDialog(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <SegmentedControl
          label="Retail customer workspace view"
          value={viewMode}
          onChange={(val) => {
            const next = val as 'directory' | 'documents';
            navigate(
              next === 'documents' ? RoutePath.RETAIL_DOCUMENTS : RoutePath.RETAIL_CUSTOMERS,
            );
          }}
        >
          <SegmentedControlItem value="directory" label="Customer Directory" />
          <SegmentedControlItem value="documents" label="Document Archive" />
        </SegmentedControl>
      </HStack>

      {viewMode === 'documents' ? (
        <DocumentsSection
          portalRole="Retail"
          refreshTrigger={refreshTrigger}
          onCountChange={onCountChange}
          onRefreshingChange={onRefreshingChange}
        />
      ) : (
        <Card padding={6}>
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <TextInput
              type="search"
              label="Search Customer Directory"
              placeholder="Search by CUS-000001, name, or phone..."
              startIcon={<Icon icon="search" />}
              hasClear
              width={360}
              value={searchInput}
              onChange={(value) => {
                setSearchInput(value);
                if (value === '') {
                  setDebouncedQuery('');
                }
              }}
              onEnter={() => {
                if (!isQueryTooLong) {
                  setDebouncedQuery(trimmedInput);
                }
              }}
              status={
                isQueryTooLong
                  ? { type: 'error', message: 'Search text must be 120 characters or fewer.' }
                  : undefined
              }
            />
            <Badge variant="neutral" label={`${customers.length} total`} />
          </HStack>

          <Button variant="primary" label="Register Customer" onClick={openCreateDrawer} />
        </HStack>

        <ApiErrorBanner
          title="Customer lookup error"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading && customers.length === 0 ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading customers..." />
              <Text type="supporting">Loading customer directory...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<CustomerRow>
              aria-label="Retail Customer Directory"
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
                  title="No matching customers"
                  description={
                    debouncedQuery
                      ? `No subscriber records matched "${debouncedQuery}".`
                      : 'No customers are currently registered. Register a customer to place connection requests.'
                  }
                  icon={<Icon icon="info" />}
                  actions={
                    debouncedQuery ? (
                      <Button
                        variant="secondary"
                        label="Clear Search"
                        onClick={() => {
                          setSearchInput('');
                          setDebouncedQuery('');
                        }}
                      />
                    ) : (
                      <Button
                        variant="primary"
                        label="Register Customer"
                        onClick={openCreateDrawer}
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
              label="Retail customers pagination"
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
        width={520}
        purpose="form"
        label="Register New Customer"
      >
        <Layout
          header={
            <DrawerHeader
              title="Register New Customer"
              subtitle="Create a subscriber profile with a verified city territory."
              onOpenChange={(open) => {
                if (!creating) setIsCreateOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                {citiesLoaded && cities.length === 0 ? (
                  <Banner
                    status="warning"
                    container="card"
                    collapsible={false}
                    title="No territory cities available"
                    description="An Admin must register at least one 3-digit city code before customers can be registered."
                  />
                ) : null}

                <ApiErrorBanner
                  title="Could not register customer"
                  error={createError}
                  onDismiss={() => setCreateError(null)}
                />

                <form id="create-customer-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                  <FormLayout>
                    <TextInput
                      label="Full Name or Company Name"
                      placeholder="e.g. Horizon Logistics Ltd."
                      isRequired
                      value={createForm.name}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, name: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      status={
                        createFieldErrors.name
                          ? { type: 'error', message: createFieldErrors.name }
                          : createForm.name.trim().length > 120
                            ? {
                                type: 'error',
                                message: 'Customer name must be 120 characters or fewer.',
                              }
                            : undefined
                      }
                    />

                    <TextInput
                      label="Phone Number"
                      placeholder="e.g. +84901234567"
                      inputMode="tel"
                      description="7–15 digits with an optional leading +, no spaces or hyphens."
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

                    <Selector
                      label="City Territory"
                      placeholder="Select a territory city..."
                      hasSearch
                      searchPlaceholder="Search city code or name..."
                      emptyText="No cities registered"
                      isRequired
                      options={cityOptions}
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
                      label="Installation Address"
                      placeholder="Street address, building, district..."
                      isRequired
                      rows={2}
                      maxLength={240}
                      value={createForm.address}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, address: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, address: undefined }));
                      }}
                      status={
                        createFieldErrors.address
                          ? { type: 'error', message: createFieldErrors.address }
                          : createForm.address.trim().length > 240
                            ? {
                                type: 'error',
                                message: 'Address must be 240 characters or fewer.',
                              }
                            : undefined
                      }
                    />

                    <Selector
                      label="Customer Type"
                      isOptional
                      options={CUSTOMER_TYPE_OPTIONS}
                      value={createForm.customerType}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, customerType: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, customerType: undefined }));
                      }}
                      status={
                        createFieldErrors.customerType
                          ? { type: 'error', message: createFieldErrors.customerType }
                          : undefined
                      }
                    />

                    <TextInput
                      label="Contact Person"
                      placeholder="Primary representative name"
                      isOptional
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
                      type="email"
                      label="Email Address"
                      placeholder="billing@company.com"
                      isOptional
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

                    <TextInput
                      label="Tax ID"
                      placeholder="Optional business tax registration ID"
                      isOptional
                      value={createForm.taxId}
                      onChange={(value) => {
                        setCreateForm((prev) => ({ ...prev, taxId: value }));
                        setCreateFieldErrors((prev) => ({ ...prev, taxId: undefined }));
                      }}
                      status={
                        createFieldErrors.taxId
                          ? { type: 'error', message: createFieldErrors.taxId }
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
                  form="create-customer-form"
                  variant="primary"
                  label="Register Customer"
                  isLoading={creating}
                  isDisabled={creating || (citiesLoaded && cities.length === 0)}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>

      <Dialog
        isOpen={editingCustomer !== null}
        onOpenChange={(open) => {
          if (!open && !savingEdit) setEditingCustomer(null);
        }}
        purpose="form"
        width={560}
      >
        <Layout
          header={
            <DialogHeader
              title={editingCustomer ? `Edit Customer ${editingCustomer.code}` : 'Edit Customer'}
              subtitle="Update subscriber profile, territory city, or account status."
              onOpenChange={(open) => {
                if (!open && !savingEdit) setEditingCustomer(null);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Could not update customer"
                  error={editError}
                  onDismiss={() => setEditError(null)}
                />

                <form id="edit-customer-form" onSubmit={(e) => void handleEditSubmit(e)}>
                  <FormLayout>
                    <TextInput
                      label="Full Name or Company Name"
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
                      label="Phone Number"
                      inputMode="tel"
                      description="7–15 digits with an optional leading +, no spaces or hyphens."
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

                    <Selector
                      label="City Territory"
                      hasSearch
                      searchPlaceholder="Search city code or name..."
                      isRequired
                      options={cityOptions}
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
                      label="Installation Address"
                      isRequired
                      rows={2}
                      maxLength={240}
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

                    <Selector
                      label="Customer Status"
                      isRequired
                      options={CUSTOMER_STATUS_OPTIONS}
                      value={editForm.status}
                      onChange={(value) => {
                        setEditForm((prev) => ({ ...prev, status: value as CustomerStatus }));
                        setEditFieldErrors((prev) => ({ ...prev, status: undefined }));
                      }}
                      status={
                        editFieldErrors.status
                          ? { type: 'error', message: editFieldErrors.status }
                          : editForm.status === 'SUSPENDED'
                            ? {
                                type: 'warning',
                                message:
                                  'Suspended customers cannot place new service connection requests.',
                              }
                            : undefined
                      }
                    />

                    <Selector
                      label="Customer Type"
                      isOptional
                      options={editTypeOptions}
                      value={editForm.customerType}
                      onChange={(value) => {
                        setEditForm((prev) => ({ ...prev, customerType: value }));
                        setEditFieldErrors((prev) => ({ ...prev, customerType: undefined }));
                      }}
                      status={
                        editFieldErrors.customerType
                          ? { type: 'error', message: editFieldErrors.customerType }
                          : undefined
                      }
                    />

                    <TextInput
                      label="Contact Person"
                      isOptional
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
                      type="email"
                      label="Email Address"
                      isOptional
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

                    <TextInput
                      label="Tax ID"
                      isOptional
                      value={editForm.taxId}
                      onChange={(value) => {
                        setEditForm((prev) => ({ ...prev, taxId: value }));
                        setEditFieldErrors((prev) => ({ ...prev, taxId: undefined }));
                      }}
                      status={
                        editFieldErrors.taxId
                          ? { type: 'error', message: editFieldErrors.taxId }
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
                  isDisabled={savingEdit}
                  onClick={() => setEditingCustomer(null)}
                />
                <Button
                  type="submit"
                  form="edit-customer-form"
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

      <Drawer
        isOpen={selectedCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomer(null);
        }}
        side="end"
        width={520}
        purpose="info"
        label={selectedCustomer ? `Customer ${selectedCustomer.code}` : 'Customer Details'}
      >
        <Layout
          header={
            <DrawerHeader
              title={selectedCustomer?.name ?? 'Customer Details'}
              subtitle={selectedCustomer?.code}
              endContent={
                selectedCustomer ? <CustomerStatusPill status={selectedCustomer.status} /> : undefined
              }
              onOpenChange={(open) => {
                if (!open) setSelectedCustomer(null);
              }}
            />
          }
          content={
            <LayoutContent>
              {selectedCustomer ? (
                <MetadataList
                  columns={2}
                  title={<Heading level={4}>Subscriber Profile</Heading>}
                >
                  <MetadataListItem label="Customer Code">
                    <CopyableId value={selectedCustomer.code} label="Customer Code" />
                  </MetadataListItem>
                  <MetadataListItem label="Account Status">
                    <CustomerStatusPill status={selectedCustomer.status} />
                  </MetadataListItem>
                  <MetadataListItem label="Internal Record ID">
                    #{selectedCustomer.id}
                  </MetadataListItem>
                  <MetadataListItem label="City Territory">
                    {formatCityDisplay(selectedCustomer.cityCode)}
                  </MetadataListItem>
                  <MetadataListItem label="Full Name">{selectedCustomer.name}</MetadataListItem>
                  <MetadataListItem label="Phone Number">{selectedCustomer.phone}</MetadataListItem>
                  <MetadataListItem label="Customer Type">
                    {selectedCustomer.customerType || 'Corporate'}
                  </MetadataListItem>
                  <MetadataListItem label="Contact Person">
                    {selectedCustomer.contactPerson || '—'}
                  </MetadataListItem>
                  <MetadataListItem label="Email Address">
                    {selectedCustomer.email || '—'}
                  </MetadataListItem>
                  <MetadataListItem label="Tax ID">
                    {selectedCustomer.taxId || '—'}
                  </MetadataListItem>
                  <MetadataListItem label="Installation Address">
                    {selectedCustomer.address}
                  </MetadataListItem>
                </MetadataList>
              ) : (
                <EmptyState
                  title="No customer selected"
                  description="Choose a customer row to inspect subscriber details."
                  icon={<Icon icon="info" />}
                  isCompact
                />
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
                {selectedCustomer ? (
                  <Button
                    variant="secondary"
                    label="Edit Customer"
                    onClick={() => {
                      const target = selectedCustomer;
                      setSelectedCustomer(null);
                      openEditDialog(target);
                    }}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  label="Close"
                  onClick={() => setSelectedCustomer(null)}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>
        </Card>
      )}
    </VStack>
  );
}
