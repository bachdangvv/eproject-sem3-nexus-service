/**
 * Technical equipment inventory stock management and customer-damaged incident logging section.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
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
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  formatUsd,
} from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { updateProduct } from '../../services/catalogApi';
import {
  getEquipmentIncidents,
  getTechnicalEquipment,
  recordEquipmentIncident,
} from '../../services/inventoryApi';
import { getOrders } from '../../services/operationsApi';
import type {
  EquipmentIncidentView,
  EquipmentStockView,
  OrderView,
} from '../../types/nexus';
import {
  extractErrorMessage,
  type TechnicalSectionProps,
} from './technicalTypes';

type IncidentStatusFilter = 'ALL' | 'PENDING' | 'SETTLED';

type EquipmentRow = EquipmentStockView & Record<string, unknown>;
type IncidentRow = EquipmentIncidentView & Record<string, unknown>;

function getEquipmentCategory(name: string, description: string): string {
  const combined = `${name} ${description}`.toLowerCase();
  if (combined.includes('router') || combined.includes('optical') || combined.includes('ont') || combined.includes('gpon')) {
    return 'Broadband Router';
  }
  if (combined.includes('modem') || combined.includes('adsl') || combined.includes('dial')) {
    return 'Dial-Up Modem';
  }
  if (combined.includes('handset') || combined.includes('phone') || combined.includes('landline')) {
    return 'Landline Handset';
  }
  return 'Hardware Terminal';
}

export function TechnicalEquipmentSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: TechnicalSectionProps): JSX.Element {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'inventory' | 'incidents'>('inventory');

  // Equipment inventory state
  const [equipment, setEquipment] = useState<EquipmentStockView[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [equipmentSearch, setEquipmentSearch] = useState('');

  // Incidents state
  const [incidents, setIncidents] = useState<EquipmentIncidentView[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [incidentSearch, setIncidentSearch] = useState('');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<IncidentStatusFilter>('ALL');

  // Connected orders for dropdown
  const [connectedOrders, setConnectedOrders] = useState<OrderView[]>([]);

  // Drawer state for recording customer-damaged incident
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Drawer form inputs
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [replacementFee, setReplacementFee] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Technical product edit dialog state (DOC1-ROL-004 P64)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentStockView | null>(null);
  const [editEqName, setEditEqName] = useState('');
  const [editEqDescription, setEditEqDescription] = useState('');
  const [editEqStockText, setEditEqStockText] = useState('0');
  const [editEqFeeText, setEditEqFeeText] = useState('0.00');
  const [editEqError, setEditEqError] = useState<string | null>(null);
  const [savingEqEdit, setSavingEqEdit] = useState(false);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

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
        setEquipmentLoading(true);
        setIncidentsLoading(true);
      }
      setEquipmentError(null);
      setIncidentsError(null);

      try {
        const [eqData, incData, connOrders] = await Promise.all([
          getTechnicalEquipment(),
          getEquipmentIncidents(),
          getOrders({ status: 'Connected' }),
        ]);

        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setEquipment(eqData);
        setIncidents(incData);
        setConnectedOrders(connOrders);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        const msg = extractErrorMessage(err, 'Failed to load technical equipment and incidents.');
        setEquipmentError(msg);
        setIncidentsError(msg);
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setEquipmentLoading(false);
          setIncidentsLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [onRefreshingChange],
  );

  useEffect(() => {
    const isSilent = hasLoadedOnceRef.current && refreshTrigger > 0;
    hasLoadedOnceRef.current = true;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled && isMountedRef.current) {
        return loadData(isSilent);
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [loadData, refreshTrigger]);

  useEffect(() => {
    if (equipmentLoading && incidentsLoading) return;
    const count =
      activeTab === 'inventory'
        ? equipment.length
        : incidents.filter((i) => !i.settled).length;
    onCountChange(count);
  }, [activeTab, equipment.length, equipmentLoading, incidents, incidentsLoading, onCountChange]);

  // Filtered equipment inventory
  const filteredEquipment = useMemo<EquipmentRow[]>(() => {
    const needle = equipmentSearch.trim().toLowerCase();
    return equipment
      .filter((item) => {
        if (!needle) return true;
        const category = getEquipmentCategory(item.name, item.description).toLowerCase();
        return (
          item.name.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle) ||
          category.includes(needle)
        );
      })
      .map((item) => ({ ...item }));
  }, [equipment, equipmentSearch]);

  const equipmentPagination = useClientPagination(filteredEquipment, {
    resetKey: equipmentSearch.trim().toLowerCase(),
    defaultPageSize: 10,
  });

  // Filtered incidents
  const filteredIncidents = useMemo<IncidentRow[]>(() => {
    const needle = incidentSearch.trim().toLowerCase();
    return incidents
      .filter((inc) => {
        if (incidentStatusFilter === 'PENDING' && inc.settled) return false;
        if (incidentStatusFilter === 'SETTLED' && !inc.settled) return false;

        if (!needle) return true;
        return (
          inc.accountId.toLowerCase().includes(needle) ||
          inc.productName.toLowerCase().includes(needle) ||
          inc.description.toLowerCase().includes(needle) ||
          (inc.customerName && inc.customerName.toLowerCase().includes(needle)) ||
          (inc.recordedByUsername && inc.recordedByUsername.toLowerCase().includes(needle))
        );
      })
      .map((inc) => ({ ...inc }));
  }, [incidents, incidentSearch, incidentStatusFilter]);

  const incidentsPagination = useClientPagination(filteredIncidents, {
    resetKey: `${incidentStatusFilter}::${incidentSearch.trim().toLowerCase()}`,
    defaultPageSize: 10,
  });

  // Connected order options for Drawer selector
  const accountOptions = useMemo(() => {
    return connectedOrders
      .filter((o) => o.accountId)
      .map((o) => ({
        value: o.accountId!,
        label: `${o.accountId} · ${o.request.customerName}`,
        description: `${o.request.planName} · City ${o.request.cityCode} (${o.code})`,
      }));
  }, [connectedOrders]);

  // Product options for Drawer selector
  const productOptions = useMemo(() => {
    return equipment
      .filter((p) => p.active)
      .map((p) => ({
        value: String(p.id),
        label: `${p.name} · Fee ${formatUsd(p.replacementPrice)}`,
        description: `Stock: ${p.quantityInStock} available | Category: ${getEquipmentCategory(p.name, p.description)}`,
      }));
  }, [equipment]);

  // Handle account selection in drawer
  const handleAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    setFieldErrors((prev) => ({ ...prev, accountId: '' }));

    const matchedOrder = connectedOrders.find((o) => o.accountId === accId);
    if (matchedOrder && matchedOrder.assignedProductId) {
      setSelectedProductId(String(matchedOrder.assignedProductId));
      const prod = equipment.find((p) => p.id === matchedOrder.assignedProductId);
      if (prod) {
        setReplacementFee(prod.replacementPrice.toFixed(2));
      }
    }
  };

  // Handle product selection in drawer
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    setFieldErrors((prev) => ({ ...prev, productId: '' }));
    const prod = equipment.find((p) => String(p.id) === prodId);
    if (prod) {
      setReplacementFee(prod.replacementPrice.toFixed(2));
    }
  };

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
    setFormError(null);
    setFieldErrors({});
    setSelectedAccountId('');
    setSelectedProductId('');
    setDamageDescription('');
    setReplacementFee('');
  };

  const handleCloseDrawer = () => {
    if (submittingIncident) return;
    setIsDrawerOpen(false);
    setFormError(null);
    setFieldErrors({});
  };

  const handleSubmitIncident = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingIncident) return;

    const errors: Record<string, string> = {};
    const trimmedAccount = selectedAccountId.trim();
    if (!trimmedAccount) {
      errors.accountId = 'Select or provide an active subscriber Account ID.';
    }

    const prodIdNum = Number(selectedProductId);
    if (!selectedProductId || !Number.isInteger(prodIdNum) || prodIdNum <= 0) {
      errors.productId = 'Select the damaged equipment hardware product.';
    }

    const trimmedDesc = damageDescription.trim();
    if (!trimmedDesc || trimmedDesc.length < 5) {
      errors.description = 'Provide a descriptive condition of the damaged equipment (min 5 characters).';
    }

    const trimmedFee = replacementFee.trim();
    const feeNum = /^\d+(\.\d{1,2})?$/.test(trimmedFee) ? Number(trimmedFee) : NaN;
    if (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 9999999.99) {
      errors.replacementFee = 'Enter a valid replacement fee ($0.00 to $9,999,999.99, up to 2 decimals).';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmittingIncident(true);
    setFormError(null);

    try {
      const created = await recordEquipmentIncident({
        accountId: trimmedAccount,
        productId: prodIdNum,
        description: trimmedDesc,
        replacementFee: feeNum,
      });

      if (!isMountedRef.current) return;
      toast({
        body: `Damaged equipment incident recorded for Account ${created.accountId} · Replacement fee ${formatUsd(created.replacementFee)}.`,
      });

      setIsDrawerOpen(false);
      void loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setFormError(extractErrorMessage(err, 'Failed to record customer damaged equipment incident.'));
    } finally {
      if (isMountedRef.current) {
        setSubmittingIncident(false);
      }
    }
  };

  // Selected order details preview in drawer
  const selectedOrderPreview = useMemo(() => {
    if (!selectedAccountId) return null;
    return connectedOrders.find((o) => o.accountId === selectedAccountId) ?? null;
  }, [connectedOrders, selectedAccountId]);

  // Metrics summary
  const metrics = useMemo(() => {
    const totalSkus = equipment.length;
    const totalStock = equipment.reduce((sum, item) => sum + item.quantityInStock, 0);
    const lowStockCount = equipment.filter((item) => item.quantityInStock < 10).length;
    const pendingIncidentsCount = incidents.filter((i) => !i.settled).length;
    return { totalSkus, totalStock, lowStockCount, pendingIncidentsCount };
  }, [equipment, incidents]);

  const openEditEquipmentDialog = (item: EquipmentStockView) => {
    setEditingEquipment(item);
    setEditEqName(item.name);
    setEditEqDescription(item.description ?? '');
    setEditEqStockText(String(item.quantityInStock ?? 0));
    setEditEqFeeText(String(item.replacementPrice ?? 0));
    setEditEqError(null);
  };

  const handleSaveEquipmentEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEquipment || savingEqEdit) return;
    const trimmedName = editEqName.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setEditEqError('Equipment name is required (1–100 characters).');
      return;
    }
    if (editEqDescription.trim().length > 240) {
      setEditEqError('Description must be 240 characters or fewer.');
      return;
    }
    const trimmedStock = editEqStockText.trim();
    const stockVal = /^\d+$/.test(trimmedStock) ? Number(trimmedStock) : NaN;
    if (!Number.isSafeInteger(stockVal) || stockVal < 0 || stockVal > 100000) {
      setEditEqError('Stock quantity must be a whole integer between 0 and 100,000.');
      return;
    }
    const trimmedFee = editEqFeeText.trim();
    const feeVal = /^\d+(\.\d{1,2})?$/.test(trimmedFee) ? Number(trimmedFee) : NaN;
    if (!Number.isFinite(feeVal) || feeVal < 0 || feeVal > 9999999.99) {
      setEditEqError('Replacement fee must be between $0.00 and $9,999,999.99 (up to 2 decimals).');
      return;
    }
    setSavingEqEdit(true);
    setEditEqError(null);
    try {
      const updated = await updateProduct(editingEquipment.id, {
        name: trimmedName,
        description: editEqDescription.trim() || null,
        active: editingEquipment.active,
        quantityInStock: stockVal,
        replacementPrice: feeVal,
      });
      if (!isMountedRef.current) return;
      setEditingEquipment(null);
      toast({ body: `Updated hardware equipment "${updated.name}".` });
      void loadData(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setEditEqError(extractErrorMessage(err, 'Could not update equipment details.'));
    } finally {
      if (isMountedRef.current) setSavingEqEdit(false);
    }
  };

  // Equipment table columns
  const equipmentColumns: TableColumn<EquipmentRow>[] = [
    {
      key: 'name',
      header: 'Hardware Product',
      width: proportional(2.0, { minWidth: 200 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.name}</Text>
          <Text type="supporting">{row.description}</Text>
        </VStack>
      ),
    },
    {
      key: 'category',
      header: 'Equipment Category',
      width: pixel(180),
      renderCell: (row) => (
        <Token size="sm" color="blue" label={getEquipmentCategory(row.name, row.description)} />
      ),
    },
    {
      key: 'stock',
      header: 'Available Stock',
      width: pixel(160),
      renderCell: (row) => {
        if (row.quantityInStock >= 10) {
          return <Token size="sm" color="green" label={`${row.quantityInStock} in Stock`} />;
        }
        if (row.quantityInStock > 0) {
          return <Token size="sm" color="teal" label={`${row.quantityInStock} Low Stock`} />;
        }
        return <Token size="sm" color="red" label="0 Out of Stock" />;
      },
    },
    {
      key: 'replacementPrice',
      header: 'Replacement Fee',
      width: pixel(150),
      renderCell: (row) => (
        <Text weight="medium">{formatUsd(row.replacementPrice)}</Text>
      ),
    },
    {
      key: 'allocatedCount',
      header: 'Allocated Lines',
      width: pixel(140),
      renderCell: (row) => (
        <Text type="body">{row.allocatedCount} lines</Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(110),
      renderCell: (row) => (
        <Token
          size="sm"
          color={row.active ? 'green' : 'gray'}
          label={row.active ? 'Active' : 'Archived'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(110),
      align: 'end',
      renderCell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          label="Edit"
          onClick={() => openEditEquipmentDialog(row)}
        />
      ),
    },
  ];

  // Incidents table columns
  const incidentColumns: TableColumn<IncidentRow>[] = [
    {
      key: 'id',
      header: 'Incident / Date',
      width: pixel(180),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">INC-{String(row.id).padStart(5, '0')}</Text>
          <Timestamp value={row.incidentDate} format="date_time" />
        </VStack>
      ),
    },
    {
      key: 'account',
      header: 'Subscriber Account',
      width: pixel(245),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <CopyableId value={row.accountId} label="Account ID" />
          {row.customerName && (
            <Text type="supporting">
              {row.customerName} {row.customerPhone ? `(${row.customerPhone})` : ''}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'product',
      header: 'Damaged Equipment',
      width: proportional(1.5, { minWidth: 160 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="medium">{row.productName}</Text>
          <Text type="supporting">Fee: {formatUsd(row.replacementFee)}</Text>
        </VStack>
      ),
    },
    {
      key: 'description',
      header: 'Damage Description',
      width: proportional(2.0, { minWidth: 200 }),
      renderCell: (row) => (
        <Text type="body">{row.description}</Text>
      ),
    },
    {
      key: 'recordedBy',
      header: 'Recorded By',
      width: pixel(140),
      renderCell: (row) => (
        <Token size="sm" color="gray" label={row.recordedByUsername || 'staff'} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(160),
      renderCell: (row) => (
        <Token
          size="sm"
          color={row.settled ? 'green' : 'orange'}
          label={row.settled ? 'Settled (Paid)' : 'Pending Settlement'}
        />
      ),
    },
  ];

  return (
    <VStack gap={5}>
      {/* Overview Metrics Cards */}
      <HStack gap={4} wrap="wrap">
        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Total Hardware SKUs</Text>
            <Heading level={2}>{metrics.totalSkus}</Heading>
            <Text type="supporting">Cataloged models</Text>
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Stock in Hand</Text>
            <Heading level={2}>{metrics.totalStock}</Heading>
            <Text type="supporting">Units ready for deployment</Text>
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Low Stock Alerts</Text>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>{metrics.lowStockCount}</Heading>
              {metrics.lowStockCount > 0 && (
                <Token size="sm" color="orange" label="Action Needed" />
              )}
            </HStack>
            <Text type="supporting">SKUs under 10 units</Text>
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={1}>
            <Text type="supporting">Damaged Incidents</Text>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>{metrics.pendingIncidentsCount}</Heading>
              {metrics.pendingIncidentsCount > 0 && (
                <Token size="sm" color="red" label="Unsettled" />
              )}
            </HStack>
            <Text type="supporting">Billing replacement pending</Text>
          </VStack>
        </Card>
      </HStack>

      {/* Main Section Card */}
      <Card padding={6}>
        <VStack gap={5}>
          {/* Controls & Tab Switching */}
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
            <SegmentedControl
              label="Equipment sub-sections"
              value={activeTab}
              onChange={(val) => setActiveTab(val as 'inventory' | 'incidents')}
            >
              <SegmentedControlItem value="inventory" label="Equipment Inventory" />
              <SegmentedControlItem value="incidents" label="Damaged Equipment Incidents" />
            </SegmentedControl>

            <Button
              variant="primary"
              label="Record Damaged Equipment"
              onClick={handleOpenDrawer}
            />
          </HStack>

          {/* Sub-view: Equipment Inventory Stock */}
          {activeTab === 'inventory' && (
            <VStack gap={4}>
              <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <Badge variant="neutral" label={`${filteredEquipment.length} SKUs`} />
                  <Text type="supporting">
                    Track available inventory, replacement costs, and active subscriber line allocations.
                  </Text>
                </HStack>

                <TextInput
                  type="search"
                  label="Search Equipment"
                  placeholder="Filter by product name, category, or description..."
                  startIcon={<Icon icon="search" />}
                  hasClear
                  width={340}
                  value={equipmentSearch}
                  onChange={setEquipmentSearch}
                />
              </HStack>

              <ApiErrorBanner
                title="Equipment inventory error"
                error={equipmentError}
                onDismiss={() => setEquipmentError(null)}
              />

              {equipmentLoading && equipment.length === 0 ? (
                <Center padding={8}>
                  <VStack gap={3} hAlign="center">
                    <Spinner size="lg" label="Loading equipment inventory..." />
                    <Text type="supporting">Loading hardware inventory and stock levels...</Text>
                  </VStack>
                </Center>
              ) : (
                <>
                  <Table<EquipmentRow>
                    aria-label="Equipment Inventory Table"
                    density="compact"
                    dividers="rows"
                    hasHover
                    idKey="id"
                    columns={equipmentColumns}
                    data={equipmentPagination.paginatedItems}
                    rowIndexStart={equipmentPagination.rowIndexStart}
                    rowCount={equipmentPagination.totalItems}
                    emptyState={
                      <EmptyState
                        title="No equipment found"
                        description={
                          equipmentSearch.trim()
                            ? 'No equipment matches the search query. Try clearing the filter.'
                            : 'No equipment items cataloged in the inventory system.'
                        }
                        icon={<Icon icon="info" />}
                        actions={
                          equipmentSearch.trim() ? (
                            <Button
                              variant="secondary"
                              label="Clear Search"
                              onClick={() => setEquipmentSearch('')}
                            />
                          ) : undefined
                        }
                      />
                    }
                  />
                  <TablePaginationFooter
                    page={equipmentPagination.page}
                    pageSize={equipmentPagination.pageSize}
                    totalItems={equipmentPagination.totalItems}
                    onPageChange={equipmentPagination.setPage}
                    onPageSizeChange={equipmentPagination.setPageSize}
                    label="Equipment inventory pagination"
                  />
                </>
              )}
            </VStack>
          )}

          {/* Sub-view: Customer Damaged Equipment Incidents */}
          {activeTab === 'incidents' && (
            <VStack gap={4}>
              <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
                <HStack gap={3} vAlign="end" wrap="wrap">
                  <Selector
                    label="Settlement Status"
                    options={[
                      { value: 'ALL', label: 'All Incidents' },
                      { value: 'PENDING', label: 'Pending Settlement' },
                      { value: 'SETTLED', label: 'Settled (Paid)' },
                    ]}
                    value={incidentStatusFilter}
                    onChange={(val) => setIncidentStatusFilter(val as IncidentStatusFilter)}
                    width={200}
                  />
                  <Badge variant="neutral" label={`${filteredIncidents.length} total`} />
                </HStack>

                <TextInput
                  type="search"
                  label="Search Incidents"
                  placeholder="Filter by Account ID, subscriber, hardware, or description..."
                  startIcon={<Icon icon="search" />}
                  hasClear
                  width={340}
                  value={incidentSearch}
                  onChange={setIncidentSearch}
                />
              </HStack>

              <ApiErrorBanner
                title="Equipment incidents error"
                error={incidentsError}
                onDismiss={() => setIncidentsError(null)}
              />

              {incidentsLoading && incidents.length === 0 ? (
                <Center padding={8}>
                  <VStack gap={3} hAlign="center">
                    <Spinner size="lg" label="Loading equipment incidents..." />
                    <Text type="supporting">Loading customer damaged equipment incident registry...</Text>
                  </VStack>
                </Center>
              ) : (
                <>
                  <Table<IncidentRow>
                    aria-label="Damaged Equipment Incidents Table"
                    density="compact"
                    dividers="rows"
                    hasHover
                    idKey="id"
                    columns={incidentColumns}
                    data={incidentsPagination.paginatedItems}
                    rowIndexStart={incidentsPagination.rowIndexStart}
                    rowCount={incidentsPagination.totalItems}
                    emptyState={
                      <EmptyState
                        title="No damaged equipment incidents"
                        description={
                          incidentSearch.trim() || incidentStatusFilter !== 'ALL'
                            ? 'No incidents match the active search or status filter.'
                            : 'No customer-damaged equipment incidents logged yet.'
                        }
                        icon={<Icon icon="info" />}
                        actions={
                          incidentSearch.trim() || incidentStatusFilter !== 'ALL' ? (
                            <Button
                              variant="secondary"
                              label="Reset Filters"
                              onClick={() => {
                                setIncidentSearch('');
                                setIncidentStatusFilter('ALL');
                              }}
                            />
                          ) : (
                            <Button
                              variant="primary"
                              label="Record First Incident"
                              onClick={handleOpenDrawer}
                            />
                          )
                        }
                      />
                    }
                  />
                  <TablePaginationFooter
                    page={incidentsPagination.page}
                    pageSize={incidentsPagination.pageSize}
                    totalItems={incidentsPagination.totalItems}
                    onPageChange={incidentsPagination.setPage}
                    onPageSizeChange={incidentsPagination.setPageSize}
                    label="Equipment incidents pagination"
                  />
                </>
              )}
            </VStack>
          )}
        </VStack>
      </Card>

      {/* Drawer: Record Customer Damaged Equipment Incident */}
      <Drawer
        isOpen={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open && !submittingIncident) {
            handleCloseDrawer();
          }
        }}
        side="end"
        label="Record Customer Damaged Equipment"
        width={540}
      >
        <Layout
          header={
            <DrawerHeader
              title="Record Damaged Equipment"
              subtitle="Log customer-damaged hardware to initiate technician review and billing replacement fee."
              onOpenChange={(open) => {
                if (!open && !submittingIncident) {
                  handleCloseDrawer();
                }
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Failed to record incident"
                  error={formError}
                  onDismiss={() => setFormError(null)}
                />

                <form id="record-incident-form" onSubmit={(e) => void handleSubmitIncident(e)}>
                  <FormLayout>
                    <Selector
                      label="Subscriber Account"
                      placeholder="Select active connected account..."
                      hasSearch
                      searchPlaceholder="Search Account ID or subscriber name..."
                      emptyText="No connected subscriber accounts found"
                      description="Select the connected subscriber line where the damage incident occurred."
                      isRequired
                      options={accountOptions}
                      value={selectedAccountId}
                      onChange={handleAccountChange}
                      status={
                        fieldErrors.accountId
                          ? { type: 'error', message: fieldErrors.accountId }
                          : undefined
                      }
                    />

                    {selectedOrderPreview && (
                      <Card padding={3} variant="muted">
                        <MetadataList columns={2} title={<Heading level={4}>Account Information</Heading>}>
                          <MetadataListItem label="Customer">
                            {selectedOrderPreview.request.customerName}
                          </MetadataListItem>
                          <MetadataListItem label="City Territory">
                            City {selectedOrderPreview.request.cityCode}
                          </MetadataListItem>
                          <MetadataListItem label="Service Plan">
                            {selectedOrderPreview.request.planName}
                          </MetadataListItem>
                          <MetadataListItem label="Installation Site">
                            {selectedOrderPreview.request.address}
                          </MetadataListItem>
                        </MetadataList>
                      </Card>
                    )}

                    <Selector
                      label="Damaged Equipment Product"
                      placeholder="Select hardware model..."
                      hasSearch
                      searchPlaceholder="Search product model name..."
                      emptyText="No hardware products available"
                      description="Choose the hardware unit that sustained physical damage or malfunction."
                      isRequired
                      options={productOptions}
                      value={selectedProductId}
                      onChange={handleProductChange}
                      status={
                        fieldErrors.productId
                          ? { type: 'error', message: fieldErrors.productId }
                          : undefined
                      }
                    />

                    <TextInput
                      label="Replacement Fee ($)"
                      placeholder="e.g. 120.00"
                      inputMode="decimal"
                      description="Billed to customer invoice for equipment replacement or major repairs."
                      isRequired
                      value={replacementFee}
                      onChange={(val) => {
                        setReplacementFee(val);
                        setFieldErrors((prev) => ({ ...prev, replacementFee: '' }));
                      }}
                      status={
                        fieldErrors.replacementFee
                          ? { type: 'error', message: fieldErrors.replacementFee }
                          : undefined
                      }
                    />

                    <TextArea
                      label="Damage Description & Notes"
                      placeholder="e.g. Optical receiver port physically sheared during renovation; power adapter surge damage."
                      description="Document technician findings, observed physical condition, and customer explanation."
                      isRequired
                      rows={4}
                      value={damageDescription}
                      onChange={(val) => {
                        setDamageDescription(val);
                        setFieldErrors((prev) => ({ ...prev, description: '' }));
                      }}
                      status={
                        fieldErrors.description
                          ? { type: 'error', message: fieldErrors.description }
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
                  isDisabled={submittingIncident}
                  onClick={handleCloseDrawer}
                />
                <Button
                  type="submit"
                  form="record-incident-form"
                  variant="primary"
                  label="Log Incident & Charge Fee"
                  isLoading={submittingIncident}
                  isDisabled={submittingIncident}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>

      <Dialog
        isOpen={editingEquipment !== null}
        onOpenChange={(open) => {
          if (!open && !savingEqEdit) setEditingEquipment(null);
        }}
        purpose="form"
        width={480}
      >
        <Layout
          header={
            <DialogHeader
              title={editingEquipment ? `Edit Equipment: ${editingEquipment.name}` : 'Edit Equipment'}
              subtitle="Update hardware model details, stock quantity, and replacement fee."
              onOpenChange={(open) => {
                if (!open && !savingEqEdit) setEditingEquipment(null);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Could not update equipment"
                  error={editEqError}
                  onDismiss={() => setEditEqError(null)}
                />
                <form id="edit-technical-equipment-form" onSubmit={(e) => void handleSaveEquipmentEdit(e)}>
                  <FormLayout>
                    <TextInput
                      label="Product Name"
                      isRequired
                      value={editEqName}
                      onChange={setEditEqName}
                    />
                    <TextArea
                      label="Description"
                      rows={3}
                      value={editEqDescription}
                      onChange={setEditEqDescription}
                    />
                    <TextInput
                      label="Quantity in Stock"
                      inputMode="numeric"
                      isRequired
                      value={editEqStockText}
                      onChange={setEditEqStockText}
                    />
                    <TextInput
                      label="Replacement Price ($)"
                      inputMode="decimal"
                      isRequired
                      value={editEqFeeText}
                      onChange={setEditEqFeeText}
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
                  isDisabled={savingEqEdit}
                  onClick={() => setEditingEquipment(null)}
                />
                <Button
                  type="submit"
                  form="edit-technical-equipment-form"
                  variant="primary"
                  label="Save Changes"
                  isLoading={savingEqEdit}
                  isDisabled={savingEqEdit}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </VStack>
  );
}
