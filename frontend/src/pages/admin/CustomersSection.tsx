/**
 * Admin read-only Customer Directory and Document Archive workspace section.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, CopyableId, CustomerStatusPill } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { RoutePath, useRouter } from '../../router/router';
import { getCities } from '../../services/catalogApi';
import { getCustomers, updateCustomer } from '../../services/operationsApi';
import type { CityView, CustomerStatus, CustomerView } from '../../types/nexus';
import { DocumentsSection } from '../shared/DocumentsSection';
import { extractErrorMessage, type AdminSectionProps, type CustomerRow } from './adminTypes';

export function CustomersSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
  initialView = 'directory',
}: AdminSectionProps & { initialView?: 'directory' | 'documents' }): JSX.Element {
  const toast = useToast();
  const { navigate } = useRouter();
  const viewMode = initialView;
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerView | null>(null);
  const [togglingCustomerId, setTogglingCustomerId] = useState<number | null>(null);

  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const isMountedRef = useRef(true);

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
        if (active && isMountedRef.current) setCities(list);
      })
      .catch(() => {
        // City names are an optional enrichment for the customer detail drawer.
      });
    return () => {
      active = false;
    };
  }, []);

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

  const handleToggleCustomerStatus = async (customer: CustomerView) => {
    if (togglingCustomerId !== null) return;
    const nextStatus: CustomerStatus = customer.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setTogglingCustomerId(customer.id);
    setLoadError(null);
    try {
      const updated = await updateCustomer(customer.id, {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        cityCode: customer.cityCode,
        taxId: customer.taxId,
        email: customer.email,
        contactPerson: customer.contactPerson,
        customerType: customer.customerType,
        status: nextStatus,
      });
      if (!isMountedRef.current) return;
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelectedCustomer((prev) => (prev && prev.id === updated.id ? updated : prev));
      toast({
        body:
          nextStatus === 'SUSPENDED'
            ? `Suspended customer account "${updated.name}" (${updated.code}).`
            : `Reactivated customer account "${updated.name}" (${updated.code}).`,
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(
        extractErrorMessage(
          err,
          `Could not update status for customer "${customer.name}".`,
        ),
      );
    } finally {
      if (isMountedRef.current) {
        setTogglingCustomerId(null);
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
          {row.email ? <Text type="supporting">{row.email}</Text> : null}
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
      width: pixel(150),
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
      width: pixel(190),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={2} hAlign="end" wrap="nowrap">
          <Button
            size="sm"
            variant="secondary"
            label="View"
            onClick={() => setSelectedCustomer(row)}
          />
          <Button
            size="sm"
            variant="ghost"
            label={row.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
            isLoading={togglingCustomerId === row.id}
            isDisabled={togglingCustomerId !== null}
            onClick={() => void handleToggleCustomerStatus(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <SegmentedControl
          label="Customer workspace view"
          value={viewMode}
          onChange={(val) => {
            const next = val as 'directory' | 'documents';
            navigate(
              next === 'documents' ? RoutePath.ADMIN_DOCUMENTS : RoutePath.ADMIN_CUSTOMERS,
            );
          }}
        >
          <SegmentedControlItem value="directory" label="Customer Directory" />
          <SegmentedControlItem value="documents" label="Document Archive" />
        </SegmentedControl>
      </HStack>

      {viewMode === 'documents' ? (
        <DocumentsSection
          portalRole="Admin"
          refreshTrigger={refreshTrigger}
          onCountChange={onCountChange}
          onRefreshingChange={onRefreshingChange}
        />
      ) : (
        <Card padding={6}>
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
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

          <HStack gap={2} vAlign="center">
            <Badge variant="neutral" label={`${customers.length} total`} />
            <Text type="supporting">Up to 100 newest matching subscribers</Text>
          </HStack>
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
              <Text type="supporting">Searching customer directory...</Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Table<CustomerRow>
              aria-label="Customer Directory"
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
                      : 'No customers are currently registered.'
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
                    ) : undefined
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
              label="Customer directory pagination"
            />
          </>
        )}
      </VStack>

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
                  title={<Heading level={4}>Subscriber Telemetry</Heading>}
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
                    {selectedCustomer.customerType || 'Standard'}
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
              <HStack hAlign="between" gap={2} wrap="wrap">
                {selectedCustomer ? (
                  <Button
                    variant={selectedCustomer.status === 'ACTIVE' ? 'destructive' : 'primary'}
                    label={
                      selectedCustomer.status === 'ACTIVE'
                        ? 'Suspend Customer'
                        : 'Reactivate Customer'
                    }
                    isLoading={togglingCustomerId === selectedCustomer.id}
                    isDisabled={togglingCustomerId !== null}
                    onClick={() => void handleToggleCustomerStatus(selectedCustomer)}
                  />
                ) : null}
                <Button
                  variant="secondary"
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
