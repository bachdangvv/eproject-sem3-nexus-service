import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Code } from '@astryxdesign/core/Code';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  formatUsd,
  ServiceTypeToken,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { computeBillAmounts } from '../../data/tariffs';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import { getCities, getPlans } from '../../services/catalogApi';
import {
  confirmRequest,
  createRequest,
  getCustomers,
  getRequests,
} from '../../services/operationsApi';
import type {
  CityView,
  CustomerView,
  OrderView,
  PlanView,
  RequestView,
} from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  SERVICE_TYPE_LABELS,
  type RequestRow,
  type RetailSectionProps,
} from './retailTypes';

interface RequestFieldErrors {
  customerId?: string;
  planId?: string;
}

export function RetailRequestsSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: RetailSectionProps): JSX.Element {
  const toast = useToast();
  const { navigate } = useRouter();

  const [requests, setRequests] = useState<RequestView[]>([]);
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastConfirmedOrder, setLastConfirmedOrder] = useState<OrderView | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [connectionCount, setConnectionCount] = useState('1');
  const [hasNexusLandline, setHasNexusLandline] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RequestFieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<RequestView | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const catalogSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const creatingRef = useRef(false);
  const confirmingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadCatalogOptions = useCallback(async () => {
    if (!isMountedRef.current) return;
    const seq = ++catalogSeqRef.current;
    try {
      const [customerList, planList, cityList] = await Promise.all([
        getCustomers(),
        getPlans(),
        getCities(),
      ]);
      if (!isMountedRef.current || seq !== catalogSeqRef.current) return;
      setCustomers(customerList);
      setPlans(planList.filter((p) => p.active));
      setCities(cityList);
      setCatalogLoaded(true);
    } catch {
      if (!isMountedRef.current || seq !== catalogSeqRef.current) return;
      setCatalogLoaded(true);
    }
  }, []);

  const loadRequests = useCallback(
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
        const data = await getRequests();
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setRequests(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load pending connection requests.'));
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
    void loadRequests(isSilent);
    void loadCatalogOptions();
  }, [loadCatalogOptions, loadRequests, refreshTrigger]);

  const cityNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const city of cities) {
      map.set(city.code, city.name);
    }
    return map;
  }, [cities]);

  const formatCityDisplay = useCallback(
    (cityCode: string): string => {
      const cityName = cityNameByCode.get(cityCode);
      return cityName ? `${cityCode} — ${cityName}` : `City ${cityCode}`;
    },
    [cityNameByCode],
  );

  const activeCustomers = useMemo(
    () => customers.filter((c) => c.status === 'ACTIVE'),
    [customers],
  );

  const customerOptions = useMemo(
    () =>
      activeCustomers.map((c) => ({
        value: String(c.id),
        label: `${c.code} — ${c.name} (${c.phone})`,
        description: `${formatCityDisplay(c.cityCode)} · ${c.address}`,
      })),
    [activeCustomers, formatCityDisplay],
  );

  const planOptions = useMemo(
    () =>
      plans.map((p) => ({
        value: String(p.id),
        label: `${p.name} — ${formatUsd(p.price)}/mo`,
        description: `${SERVICE_TYPE_LABELS[p.type]}${p.description ? ` · ${p.description}` : ''}`,
      })),
    [plans],
  );

  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => String(c.id) === selectedCustomerId) ?? null,
    [activeCustomers, selectedCustomerId],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p.id) === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const isDialUpPlan = selectedPlan?.type === 'D';

  const parsedCount = Math.max(1, parseInt(connectionCount, 10) || 1);
  const liveEstimate = useMemo(() => {
    if (!selectedPlan) return null;
    return computeBillAmounts({
      connectionType: selectedPlan.type,
      planRentalUsd: selectedPlan.price,
      connectionCount: parsedCount,
      includeSecurityDeposit: true,
      usageChargesUsd: 0,
      equipmentReplacementUsd: 0,
      previousArrearsUsd: 0,
      advanceAdjustmentUsd: 0,
    });
  }, [selectedPlan, parsedCount]);

  const requestRows = useMemo<RequestRow[]>(
    () => requests.map((req) => ({ ...req })),
    [requests],
  );
  const pagination = useClientPagination(requestRows);

  const openCreateDrawer = () => {
    setSelectedCustomerId('');
    setSelectedPlanId('');
    setConnectionCount('1');
    setHasNexusLandline(false);
    setFieldErrors({});
    setCreateError(null);
    setIsCreateOpen(true);
    void loadCatalogOptions();
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creatingRef.current || creating) return;

    const errors: RequestFieldErrors = {};
    const parsedCustomerId = Number(selectedCustomerId);
    const parsedPlanId = Number(selectedPlanId);

    if (!selectedCustomerId || !Number.isInteger(parsedCustomerId) || parsedCustomerId < 1) {
      errors.customerId = 'Select an active customer.';
    }
    if (!selectedPlanId || !Number.isInteger(parsedPlanId) || parsedPlanId < 1) {
      errors.planId = 'Select an active service plan.';
    }

    setFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    try {
      const created = await createRequest({
        customerId: parsedCustomerId,
        planId: parsedPlanId,
        hasNexusLandline: isDialUpPlan ? hasNexusLandline : false,
        connectionCount: parsedCount,
      });
      if (!isMountedRef.current) return;
      setIsCreateOpen(false);
      setSelectedCustomerId('');
      setSelectedPlanId('');
      setConnectionCount('1');
      setHasNexusLandline(false);
      setFieldErrors({});
      setCreateError(null);
      toast({
        body: `Created connection request #${created.id} for ${created.customerName}.`,
      });
      pagination.focusItem((item) => item.id === created.id);
      creatingRef.current = false;
      setCreating(false);
      void loadRequests(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setFieldErrors((prev) => ({
        ...prev,
        customerId: serverFields.customerid ?? prev.customerId,
        planId: serverFields.planid ?? prev.planId,
      }));
      setCreateError(extractErrorMessage(err, 'Could not submit service connection request.'));
    } finally {
      creatingRef.current = false;
      if (isMountedRef.current) {
        setCreating(false);
      }
    }
  };

  const handleConfirmOrder = async () => {
    if (!confirmTarget || confirmingRef.current || confirmingId !== null) return;
    confirmingRef.current = true;
    const targetId = confirmTarget.id;
    setConfirmingId(targetId);
    setConfirmError(null);
    try {
      const order = await confirmRequest(targetId);
      if (!isMountedRef.current) return;
      setConfirmTarget(null);
      setLastConfirmedOrder(order);
      toast({
        body: `Confirmed order ${order.code} (Pending Technical feasibility assessment).`,
      });
      confirmingRef.current = false;
      setConfirmingId(null);
      void loadRequests(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setConfirmError(extractErrorMessage(err, 'Could not confirm service request.'));
    } finally {
      confirmingRef.current = false;
      if (isMountedRef.current) {
        setConfirmingId(null);
      }
    }
  };

  const columns: TableColumn<RequestRow>[] = [
    {
      key: 'id',
      header: 'Request',
      width: pixel(95),
      renderCell: (row) => <Code>{`#${row.id}`}</Code>,
    },
    {
      key: 'customerName',
      header: 'Customer & Site',
      width: proportional(2, { minWidth: 200 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.customerName}</Text>
          <Text type="supporting">
            {formatCityDisplay(row.cityCode)} · {row.address}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'planName',
      header: 'Service Plan & Lines',
      width: proportional(1.4, { minWidth: 165 }),
      renderCell: (row) => (
        <VStack gap={1}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{row.planName}</Text>
            <ServiceTypeToken type={row.type} />
          </HStack>
          {row.connectionCount && row.connectionCount > 1 ? (
            <Token size="sm" color="purple" label={`${row.connectionCount} lines (Bulk)`} />
          ) : (
            <Text type="supporting">1 line</Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'hasNexusLandline',
      header: 'Dial-Up Landline',
      width: pixel(150),
      renderCell: (row) => (
        <Text type="body">
          {row.type === 'D'
            ? row.hasNexusLandline
              ? 'Existing Landline'
              : 'Needs Landline'
            : 'Not Applicable'}
        </Text>
      ),
    },
    {
      key: 'price',
      header: 'Monthly Rate',
      width: pixel(120),
      align: 'end',
      renderCell: (row) => <Text weight="semibold">{`${formatUsd(row.price)}/mo`}</Text>,
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      width: pixel(165),
      renderCell: (row) => <Timestamp value={row.createdAt} format="date_time" />,
    },
    {
      key: 'actions',
      header: 'Action',
      width: pixel(125),
      align: 'end',
      renderCell: (row) => (
        <Button
          size="sm"
          variant="primary"
          label="Confirm"
          isLoading={confirmingId === row.id}
          isDisabled={confirmingId !== null}
          onClick={() => {
            setConfirmError(null);
            setConfirmTarget(row);
          }}
        />
      ),
    },
  ];

  return (
    <Card padding={6}>
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Badge variant="neutral" label={`${requests.length} awaiting confirmation`} />
            <Text type="supporting">
              Confirming a request assigns an 11-character Order ID in Pending status for Technical
              feasibility assessment.
            </Text>
          </HStack>

          <Button
            variant="primary"
            label="New Connection Request"
            onClick={openCreateDrawer}
          />
        </HStack>

        {lastConfirmedOrder ? (
          <Banner
            status="success"
            container="card"
            collapsible={false}
            isDismissable
            onDismiss={() => setLastConfirmedOrder(null)}
            title={`Order ${lastConfirmedOrder.code} Confirmed`}
            description={`Created Pending order for ${lastConfirmedOrder.request.customerName} (${lastConfirmedOrder.request.planName}).`}
            endContent={
              <HStack gap={2} vAlign="center">
                <CopyableId value={lastConfirmedOrder.code} label="Order ID" />
                <Button
                  size="sm"
                  variant="secondary"
                  label="View in Orders"
                  onClick={() => navigate(RoutePath.RETAIL_ORDERS)}
                />
              </HStack>
            }
          />
        ) : null}

        <ApiErrorBanner
          title="Connection requests error"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading && requests.length === 0 ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading pending requests..." />
              <Text type="supporting">Loading unconfirmed connection requests...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<RequestRow>
              aria-label="Pending Connection Requests"
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
                  title="No unconfirmed connection requests"
                  description="All submitted requests have been confirmed into orders, or no new requests have been filed yet."
                  icon={<Icon icon="info" />}
                  actions={
                    <Button
                      variant="primary"
                      label="New Connection Request"
                      onClick={openCreateDrawer}
                    />
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
              label="Connection requests pagination"
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
        label="New Service Connection Request"
      >
        <Layout
          header={
            <DrawerHeader
              title="New Connection Request"
              subtitle="Link an active subscriber to an active Dial-Up, Broadband, or Landline plan."
              onOpenChange={(open) => {
                if (!creating) setIsCreateOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                {catalogLoaded && activeCustomers.length === 0 ? (
                  <Banner
                    status="warning"
                    container="card"
                    collapsible={false}
                    title="No active customers available"
                    description="Register an active customer (or reactivate a suspended profile) before creating a request."
                    endContent={
                      <Button
                        size="sm"
                        variant="secondary"
                        label="Go to Customers"
                        onClick={() => {
                          setIsCreateOpen(false);
                          navigate(RoutePath.RETAIL_CUSTOMERS);
                        }}
                      />
                    }
                  />
                ) : null}

                {catalogLoaded && plans.length === 0 ? (
                  <Banner
                    status="warning"
                    container="card"
                    collapsible={false}
                    title="No active service plans available"
                    description="An Admin must activate at least one Dial-Up, Broadband, or Landline plan before requests can be filed."
                  />
                ) : null}

                <ApiErrorBanner
                  title="Could not create connection request"
                  error={createError}
                  onDismiss={() => setCreateError(null)}
                />

                <form id="create-request-form" onSubmit={(e) => void handleCreateSubmit(e)}>
                  <FormLayout>
                    <Selector
                      label="Active Customer"
                      placeholder="Select an active customer..."
                      hasSearch
                      searchPlaceholder="Search CUS code, name, or phone..."
                      emptyText="No active customers found"
                      description="Only ACTIVE subscribers are eligible for new connection requests."
                      isRequired
                      options={customerOptions}
                      value={selectedCustomerId}
                      onChange={(value) => {
                        setSelectedCustomerId(value);
                        setFieldErrors((prev) => ({ ...prev, customerId: undefined }));
                      }}
                      status={
                        fieldErrors.customerId
                          ? { type: 'error', message: fieldErrors.customerId }
                          : undefined
                      }
                    />

                    <Selector
                      label="Active Service Plan"
                      placeholder="Select a service plan..."
                      hasSearch
                      searchPlaceholder="Search plan name or service type..."
                      emptyText="No active plans available"
                      isRequired
                      options={planOptions}
                      value={selectedPlanId}
                      onChange={(value) => {
                        setSelectedPlanId(value);
                        setFieldErrors((prev) => ({ ...prev, planId: undefined }));
                        const nextPlan = plans.find((p) => String(p.id) === value);
                        if (nextPlan?.type !== 'D') {
                          setHasNexusLandline(false);
                        }
                      }}
                      status={
                        fieldErrors.planId
                          ? { type: 'error', message: fieldErrors.planId }
                          : undefined
                      }
                    />

                    <CheckboxInput
                      label="Customer has an existing Nexus landline"
                      description={
                        isDialUpPlan
                          ? 'If checked, Technical evaluates internet feasibility only; if unchecked, Technical evaluates both landline and internet feasibility.'
                          : 'Applicable only to Dial-Up (D) service plans.'
                      }
                      value={isDialUpPlan ? hasNexusLandline : false}
                      isDisabled={!isDialUpPlan}
                      disabledMessage={
                        !isDialUpPlan
                          ? 'Existing Nexus landline applies only to Dial-Up (D) plans.'
                          : undefined
                      }
                      onChange={(checked) => setHasNexusLandline(checked)}
                    />

                    <TextInput
                      label="Number of Connections (Lines)"
                      placeholder="1"
                      inputMode="numeric"
                      value={connectionCount}
                      onChange={(value) => setConnectionCount(value)}
                      description="10–14 lines: 25% bulk discount; 15–24: 50%; 25–50: 75%; >50: 100% off advance rental & deposit."
                    />
                  </FormLayout>
                </form>

                {selectedCustomer || selectedPlan ? (
                  <Card variant="muted" padding={4}>
                    <MetadataList
                      columns={2}
                      title={<Heading level={4}>Request Snapshot Preview</Heading>}
                    >
                      <MetadataListItem label="Subscriber">
                        {selectedCustomer
                          ? `${selectedCustomer.code} · ${selectedCustomer.name}`
                          : 'Not selected'}
                      </MetadataListItem>
                      <MetadataListItem label="Territory City">
                        {selectedCustomer
                          ? formatCityDisplay(selectedCustomer.cityCode)
                          : '—'}
                      </MetadataListItem>
                      <MetadataListItem label="Installation Address">
                        {selectedCustomer ? selectedCustomer.address : '—'}
                      </MetadataListItem>
                      <MetadataListItem label="Selected Plan">
                        {selectedPlan ? (
                          <HStack gap={2} vAlign="center" wrap="wrap">
                            <Text weight="semibold">{selectedPlan.name}</Text>
                            <ServiceTypeToken type={selectedPlan.type} />
                          </HStack>
                        ) : (
                          'Not selected'
                        )}
                      </MetadataListItem>
                      <MetadataListItem label="Monthly Tariff">
                        {selectedPlan ? `${formatUsd(selectedPlan.price)}/mo` : '—'}
                      </MetadataListItem>
                      <MetadataListItem label="Connections">
                        <Text weight="medium">
                          {parsedCount > 1 ? `${parsedCount} lines (Bulk Order)` : '1 line'}
                        </Text>
                      </MetadataListItem>
                      <MetadataListItem label="Landline Scope">
                        {selectedPlan?.type === 'D'
                          ? hasNexusLandline
                            ? 'Existing Nexus landline (Internet check only)'
                            : 'No existing landline (Landline + Internet check)'
                          : 'Not required'}
                      </MetadataListItem>
                    </MetadataList>
                  </Card>
                ) : null}

                {liveEstimate && selectedPlan ? (
                  <Card variant="muted" padding={4}>
                    <VStack gap={3}>
                      <HStack hAlign="between" vAlign="center">
                        <Heading level={4}>Bulk Discount & Upfront Estimate</Heading>
                        {liveEstimate.discountPercent > 0 ? (
                          <Token
                            size="sm"
                            color="purple"
                            label={`${liveEstimate.discountPercent}% Bulk Tier (${parsedCount} lines)`}
                          />
                        ) : (
                          <Token size="sm" color="gray" label="Standard (1 line)" />
                        )}
                      </HStack>
                      <MetadataList columns={2}>
                        <MetadataListItem label="Gross Plan Rental">
                          {formatUsd(liveEstimate.rentalTotalUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Security Deposit">
                          {formatUsd(liveEstimate.securityDepositGrossUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Bulk Discount">
                          <Text weight="semibold">
                            {liveEstimate.discountPercent > 0
                              ? `${liveEstimate.discountPercent}% (-${formatUsd(liveEstimate.bulkDiscountAmountUsd)})`
                              : '$0.00 (0%)'}
                          </Text>
                        </MetadataListItem>
                        <MetadataListItem label="Service Tax (12.24%)">
                          {formatUsd(liveEstimate.serviceTaxUsd)}
                        </MetadataListItem>
                        <MetadataListItem label="Estimated Upfront Total">
                          <Text weight="bold">{formatUsd(liveEstimate.totalBilledUsd)}</Text>
                        </MetadataListItem>
                      </MetadataList>
                    </VStack>
                  </Card>
                ) : null}
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
                  form="create-request-form"
                  variant="primary"
                  label="Submit Request"
                  isLoading={creating}
                  isDisabled={
                    creating ||
                    (catalogLoaded && (activeCustomers.length === 0 || plans.length === 0))
                  }
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>

      <Dialog
        isOpen={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open && confirmingId === null) {
            setConfirmTarget(null);
            setConfirmError(null);
          }
        }}
        purpose="info"
        width={520}
      >
        <Layout
          header={
            <DialogHeader
              title={
                confirmTarget
                  ? `Confirm Request #${confirmTarget.id}`
                  : 'Confirm Service Request'
              }
              subtitle="Generate an 11-character Order ID and send to Technical assessment."
              onOpenChange={(open) => {
                if (!open && confirmingId === null) {
                  setConfirmTarget(null);
                  setConfirmError(null);
                }
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Confirmation error"
                  error={confirmError}
                  onDismiss={() => setConfirmError(null)}
                />

                {confirmTarget ? (
                  <>
                    <Text type="body">
                      Confirming this request creates a Pending service order with a unique
                      11-character Order ID and routes it to the Technical queue for feasibility
                      evaluation.
                    </Text>
                    <Card variant="muted" padding={4}>
                      <MetadataList columns={2}>
                        <MetadataListItem label="Customer">
                          {confirmTarget.customerName}
                        </MetadataListItem>
                        <MetadataListItem label="Service Plan">
                          <HStack gap={2} vAlign="center" wrap="wrap">
                            <Text weight="semibold">{confirmTarget.planName}</Text>
                            <ServiceTypeToken type={confirmTarget.type} />
                          </HStack>
                        </MetadataListItem>
                        <MetadataListItem label="City Territory">
                          {formatCityDisplay(confirmTarget.cityCode)}
                        </MetadataListItem>
                        <MetadataListItem label="Monthly Rate">
                          {`${formatUsd(confirmTarget.price)}/mo`}
                        </MetadataListItem>
                        <MetadataListItem label="Installation Address">
                          {confirmTarget.address}
                        </MetadataListItem>
                        <MetadataListItem label="Dial-Up Landline">
                          {confirmTarget.type === 'D'
                            ? confirmTarget.hasNexusLandline
                              ? 'Existing Nexus landline'
                              : 'Requires landline check'
                            : 'Not applicable'}
                        </MetadataListItem>
                      </MetadataList>
                    </Card>
                  </>
                ) : null}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
                <Button
                  variant="ghost"
                  label="Cancel"
                  isDisabled={confirmingId !== null}
                  onClick={() => {
                    setConfirmTarget(null);
                    setConfirmError(null);
                  }}
                />
                <Button
                  variant="primary"
                  label="Confirm Order"
                  isLoading={confirmingId !== null}
                  isDisabled={confirmingId !== null}
                  onClick={() => void handleConfirmOrder()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </Card>
  );
}
