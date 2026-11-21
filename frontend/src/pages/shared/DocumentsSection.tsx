/**
 * Customer KYC and billing document archival section with multipart binary file upload,
 * year/city/customer/type indexing, and inline preview/download.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FileInput } from '@astryxdesign/core/FileInput';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { Token, type TokenColor } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, CopyableId } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { getCities } from '../../services/catalogApi';
import {
  getCustomers,
  getDocumentDownloadUrl,
  getDocuments,
  recordDocument,
  uploadDocument,
} from '../../services/operationsApi';
import {
  ApiError,
  type CityView,
  type CustomerDocumentType,
  type CustomerDocumentView,
  type CustomerView,
} from '../../types/nexus';

type DocumentRow = CustomerDocumentView & Record<string, unknown>;
type SubmitMode = 'upload' | 'url';

export interface DocumentsSectionProps {
  refreshTrigger: number;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
  portalRole?: 'Admin' | 'Retail';
}

const DOCUMENT_TYPE_LABELS: Record<CustomerDocumentType, string> = {
  AddressProof: 'Address Proof',
  RegistrationForm: 'Registration Form',
  PaymentReceipt: 'Payment Receipt',
  Other: 'Other',
};

const DOCUMENT_TYPE_COLORS: Record<CustomerDocumentType, TokenColor> = {
  AddressProof: 'blue',
  RegistrationForm: 'purple',
  PaymentReceipt: 'green',
  Other: 'gray',
};

const DOCUMENT_TYPE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Document Types' },
  { value: 'AddressProof', label: 'Address Proof' },
  { value: 'RegistrationForm', label: 'Registration Form' },
  { value: 'PaymentReceipt', label: 'Payment Receipt' },
  { value: 'Other', label: 'Other' },
];

const DOCUMENT_TYPE_FORM_OPTIONS: Array<{ value: CustomerDocumentType; label: string }> = [
  { value: 'AddressProof', label: 'Address Proof' },
  { value: 'RegistrationForm', label: 'Registration Form' },
  { value: 'PaymentReceipt', label: 'Payment Receipt' },
  { value: 'Other', label: 'Other' },
];

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx';
const ALLOWED_EXTENSION_LIST = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.txt', '.csv', '.doc', '.docx'];
const CURRENT_YEAR = new Date().getFullYear();

function hasAllowedDocumentExtension(fileNameOrPath: string): boolean {
  const lower = fileNameOrPath.trim().toLowerCase().split('?')[0]?.split('#')[0] ?? '';
  return ALLOWED_EXTENSION_LIST.some((ext) => lower.endsWith(ext));
}

function formatDocTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type as CustomerDocumentType] ?? type;
}

function getDocTypeColor(type: string): TokenColor {
  return DOCUMENT_TYPE_COLORS[type as CustomerDocumentType] ?? 'gray';
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.detail || err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function DocumentsSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
  portalRole = 'Retail',
}: DocumentsSectionProps): JSX.Element {
  const toast = useToast();

  const [documents, setDocuments] = useState<CustomerDocumentView[]>([]);
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [cities, setCities] = useState<CityView[]>([]);

  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detailTarget, setDetailTarget] = useState<CustomerDocumentView | null>(null);

  // Record / Upload dialog state
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [customerLookupQuery, setCustomerLookupQuery] = useState('');
  const [submitMode, setSubmitMode] = useState<SubmitMode>('upload');
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formDocType, setFormDocType] = useState<CustomerDocumentType>('AddressProof');
  const [formTitle, setFormTitle] = useState('');
  const [formYear, setFormYear] = useState<number>(CURRENT_YEAR);
  const [formCityCode, setFormCityCode] = useState('');
  const [formFilePathOrUrl, setFormFilePathOrUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const trimmedSearch = searchInput.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(trimmedSearch), 300);
    return () => window.clearTimeout(timer);
  }, [trimmedSearch]);

  // Load reference catalogs (customers and cities) once on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([getCustomers(), getCities()])
      .then(([customerList, cityList]) => {
        if (cancelled || !isMountedRef.current) return;
        setCustomers(customerList);
        setCities(cityList);
      })
      .catch(() => {
        // Non-fatal: documents table still loads even if catalog dropdowns fail
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRecordOpen) return;
    const trimmed = customerLookupQuery.trim();
    const timer = window.setTimeout(() => {
      getCustomers(trimmed || undefined)
        .then((customerList) => {
          if (isMountedRef.current) {
            setCustomers(customerList);
          }
        })
        .catch(() => {
          // Preserve existing customer list on lookup failure
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerLookupQuery, isRecordOpen]);

  const fetchDocuments = useCallback(
    async (
      params: { year: string; cityCode: string; customerId: string; documentType: string },
      silent = false,
    ) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const parsedYear = params.year !== 'ALL' ? Number(params.year) : undefined;
        const parsedCustomerId =
          params.customerId !== 'ALL' ? Number(params.customerId) : undefined;

        const data = await getDocuments({
          year: parsedYear && Number.isInteger(parsedYear) ? parsedYear : undefined,
          cityCode: params.cityCode !== 'ALL' ? params.cityCode : undefined,
          customerId:
            parsedCustomerId && Number.isInteger(parsedCustomerId) ? parsedCustomerId : undefined,
          documentType: params.documentType !== 'ALL' ? params.documentType : undefined,
        });

        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setDocuments(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractApiErrorMessage(err, 'Failed to load archived documents.'));
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
        return fetchDocuments(
          {
            year: yearFilter,
            cityCode: cityFilter,
            customerId: customerFilter,
            documentType: typeFilter,
          },
          isSilent,
        );
      }
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [cityFilter, customerFilter, fetchDocuments, refreshTrigger, typeFilter, yearFilter]);

  const cityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cities) {
      map.set(c.code, c.name);
    }
    return map;
  }, [cities]);

  const yearOptions = useMemo(() => {
    const yearSet = new Set<number>();
    for (let y = CURRENT_YEAR + 1; y >= 2000; y -= 1) {
      yearSet.add(y);
    }
    for (const doc of documents) {
      yearSet.add(doc.year);
    }
    const sorted = Array.from(yearSet).sort((a, b) => b - a);
    return [
      { value: 'ALL', label: 'All Years' },
      ...sorted.map((y) => ({ value: String(y), label: String(y) })),
    ];
  }, [documents]);

  const cityFilterOptions = useMemo(() => {
    const known = new Map<string, string>();
    for (const city of cities) {
      known.set(city.code, `${city.code} — ${city.name}`);
    }
    for (const doc of documents) {
      if (!known.has(doc.cityCode)) {
        known.set(doc.cityCode, `City ${doc.cityCode}`);
      }
    }
    return [
      { value: 'ALL', label: 'All Cities' },
      ...Array.from(known.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, label]) => ({ value: code, label })),
    ];
  }, [cities, documents]);

  const customerFilterOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of customers) {
      map.set(c.id, `${c.code} · ${c.name} (${c.phone})`);
    }
    for (const doc of documents) {
      if (!map.has(doc.customerId)) {
        map.set(
          doc.customerId,
          `CUS-${String(doc.customerId).padStart(6, '0')} · ${doc.customerName}`,
        );
      }
    }
    return [
      { value: 'ALL', label: 'All Customers' },
      ...Array.from(map.entries())
        .sort(([a], [b]) => a - b)
        .map(([id, label]) => ({ value: String(id), label })),
    ];
  }, [customers, documents]);

  const customerModalOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: String(c.id),
        label: `${c.code} · ${c.name} (${c.phone})`,
      })),
    [customers],
  );

  const cityModalOptions = useMemo(
    () =>
      cities.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    [cities],
  );

  const filteredDocuments = useMemo<DocumentRow[]>(() => {
    const needle = debouncedSearch.toLowerCase();
    return documents
      .filter((doc) => {
        if (!needle) return true;
        return (
          String(doc.id).includes(needle) ||
          doc.title.toLowerCase().includes(needle) ||
          doc.customerName.toLowerCase().includes(needle) ||
          doc.cityCode.toLowerCase().includes(needle) ||
          doc.filePathOrUrl.toLowerCase().includes(needle) ||
          (doc.originalFileName ? doc.originalFileName.toLowerCase().includes(needle) : false)
        );
      })
      .map((doc) => ({ ...doc }));
  }, [debouncedSearch, documents]);

  const pagination = useClientPagination(filteredDocuments, {
    resetKey: `${yearFilter}::${cityFilter}::${customerFilter}::${typeFilter}::${debouncedSearch}`,
  });

  const hasActiveFilters =
    yearFilter !== 'ALL' ||
    cityFilter !== 'ALL' ||
    customerFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    Boolean(searchInput);

  const openRecordModal = () => {
    const defaultCustomer =
      customerFilter !== 'ALL'
        ? customers.find((c) => String(c.id) === customerFilter) ?? customers[0]
        : customers[0];
    setCustomerLookupQuery('');
    setSubmitMode('upload');
    setFormCustomerId(defaultCustomer ? String(defaultCustomer.id) : '');
    setFormDocType('AddressProof');
    setFormTitle('');
    setFormYear(
      yearFilter !== 'ALL' && Number.isInteger(Number(yearFilter))
        ? Number(yearFilter)
        : new Date().getFullYear(),
    );
    setFormCityCode(
      defaultCustomer?.cityCode ??
        (cityFilter !== 'ALL' ? cityFilter : cities[0]?.code ?? ''),
    );
    setFormFilePathOrUrl('');
    setSelectedFile(null);
    setFormError(null);
    setIsRecordOpen(true);
  };

  const handleCustomerSelectInModal = (val: string) => {
    setFormCustomerId(val);
    const chosen = customers.find((c) => String(c.id) === val);
    if (chosen?.cityCode) {
      setFormCityCode(chosen.cityCode);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const parsedCustomerId = Number(formCustomerId);
    if (!Number.isInteger(parsedCustomerId) || parsedCustomerId < 1) {
      setFormError('Select a customer for this archival record.');
      return;
    }

    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) {
      setFormError('Document title is required.');
      return;
    }
    if (trimmedTitle.length > 200) {
      setFormError('Document title must not exceed 200 characters.');
      return;
    }

    if (!Number.isInteger(formYear) || formYear < 2000 || formYear > 2100) {
      setFormError('Archival year must be between 2000 and 2100.');
      return;
    }

    const trimmedCity = formCityCode.trim();
    if (!/^[0-9]{3}$/.test(trimmedCity)) {
      setFormError('Select a valid 3-digit territory city code.');
      return;
    }

    if (submitMode === 'upload') {
      if (!selectedFile) {
        setFormError('Select a document file to upload.');
        return;
      }
      if (selectedFile.size <= 0) {
        setFormError('Selected file cannot be empty (0 bytes).');
        return;
      }
      if (selectedFile.size > MAX_DOCUMENT_SIZE_BYTES) {
        setFormError('File exceeds the 10 MB upload limit.');
        return;
      }
      if (!hasAllowedDocumentExtension(selectedFile.name)) {
        setFormError(
          'Unsupported file extension. Allowed: PDF, PNG, JPG, JPEG, WEBP, TXT, CSV, DOC, DOCX.',
        );
        return;
      }
    } else {
      const trimmedPath = formFilePathOrUrl.trim();
      if (!trimmedPath) {
        setFormError('File path or URL is required.');
        return;
      }
      if (trimmedPath.length > 500) {
        setFormError('File path or URL must not exceed 500 characters.');
        return;
      }
      if (trimmedPath.includes('..') || trimmedPath.includes('\\')) {
        setFormError('File path or URL cannot contain ".." or backslash traversal characters.');
        return;
      }
      if (!/^https?:\/\/\S+$/i.test(trimmedPath) && !hasAllowedDocumentExtension(trimmedPath)) {
        setFormError(
          'Provide an http(s):// URL or a document path ending with an allowed extension (.pdf, .png, .jpg, .jpeg, .webp, .txt, .csv, .doc, .docx).',
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const created =
        submitMode === 'upload' && selectedFile
          ? await uploadDocument({
              customerId: parsedCustomerId,
              documentType: formDocType,
              title: trimmedTitle,
              year: formYear,
              cityCode: trimmedCity,
              file: selectedFile,
            })
          : await recordDocument({
              customerId: parsedCustomerId,
              documentType: formDocType,
              title: trimmedTitle,
              filePathOrUrl: formFilePathOrUrl.trim(),
              year: formYear,
              cityCode: trimmedCity,
            });

      if (!isMountedRef.current) return;
      setIsRecordOpen(false);
      toast({
        body: `Archived "${created.title}" (#${created.id}) for ${created.customerName}`,
      });
      pagination.focusItem((row) => row.id === created.id);
      await fetchDocuments(
        {
          year: yearFilter,
          cityCode: cityFilter,
          customerId: customerFilter,
          documentType: typeFilter,
        },
        true,
      );
    } catch (err) {
      if (!isMountedRef.current) return;
      setFormError(extractApiErrorMessage(err, 'Failed to archive customer document.'));
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const columns: TableColumn<DocumentRow>[] = [
    {
      key: 'id',
      header: 'Doc ID',
      width: pixel(84),
      renderCell: (row) => <Code>{`#${row.id}`}</Code>,
    },
    {
      key: 'customer',
      header: 'Customer',
      width: proportional(1.4, { minWidth: 180 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="semibold">{row.customerName}</Text>
          <CopyableId
            value={`CUS-${String(row.customerId).padStart(6, '0')}`}
            label="Customer Code"
          />
        </VStack>
      ),
    },
    {
      key: 'documentType',
      header: 'Type',
      width: pixel(155),
      renderCell: (row) => (
        <Token
          size="sm"
          color={getDocTypeColor(row.documentType)}
          label={formatDocTypeLabel(row.documentType)}
        />
      ),
    },
    {
      key: 'title',
      header: 'Title & Reference',
      width: proportional(1.8, { minWidth: 210 }),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Text weight="medium">{row.title}</Text>
          <Text type="supporting" maxLines={1}>
            {row.originalFileName || row.filePathOrUrl}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'year',
      header: 'Year',
      width: pixel(80),
      renderCell: (row) => <Code>{String(row.year)}</Code>,
    },
    {
      key: 'cityCode',
      header: 'City',
      width: pixel(140),
      renderCell: (row) => {
        const cityName = cityNameMap.get(row.cityCode);
        return (
          <Token
            size="sm"
            color="gray"
            label={cityName ? `${row.cityCode} · ${cityName}` : `City ${row.cityCode}`}
          />
        );
      },
    },
    {
      key: 'uploaded',
      header: 'Archived',
      width: pixel(180),
      renderCell: (row) => (
        <VStack gap={0.5}>
          <Timestamp value={row.uploadedAt} format="date_time" />
          <Text type="supporting">
            {row.uploadedByName || `Staff #${row.uploadedById}`}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(210),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={1.5} hAlign="end" vAlign="center" wrap="nowrap">
          {row.hasStoredFile && (
            <>
              <Link href={getDocumentDownloadUrl(row.id)} download isStandalone>
                Download
              </Link>
              <Button
                size="sm"
                variant="secondary"
                label="Preview"
                onClick={() =>
                  window.open(
                    getDocumentDownloadUrl(row.id, true),
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              />
            </>
          )}
          <Button
            size="sm"
            variant={row.hasStoredFile ? 'ghost' : 'secondary'}
            label="Inspect"
            onClick={() => setDetailTarget(row)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <Card padding={5}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <Selector
              label="Archival Year"
              options={yearOptions}
              value={yearFilter}
              onChange={setYearFilter}
            />
            <Selector
              label="Territory City"
              hasSearch
              searchPlaceholder="Filter cities..."
              options={cityFilterOptions}
              value={cityFilter}
              onChange={setCityFilter}
            />
            <Selector
              label="Customer"
              hasSearch
              searchPlaceholder="Search customer..."
              options={customerFilterOptions}
              value={customerFilter}
              onChange={setCustomerFilter}
            />
            <Selector
              label="Document Type"
              options={DOCUMENT_TYPE_FILTER_OPTIONS}
              value={typeFilter}
              onChange={setTypeFilter}
            />
            <TextInput
              type="search"
              label="Search Archive"
              placeholder="Title, customer, path..."
              value={searchInput}
              onChange={setSearchInput}
              hasClear
            />
          </HStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                label="Reset filters"
                onClick={() => {
                  setYearFilter('ALL');
                  setCityFilter('ALL');
                  setCustomerFilter('ALL');
                  setTypeFilter('ALL');
                  setSearchInput('');
                }}
              />
            )}
            <Text type="supporting" hasTabularNumbers>
              {`Total: ${filteredDocuments.length} document${filteredDocuments.length === 1 ? '' : 's'}`}
            </Text>
            <Button
              variant="primary"
              label="Record Document"
              icon={<Icon icon="upload" />}
              onClick={openRecordModal}
            />
          </HStack>
        </HStack>

        <ApiErrorBanner
          title="Failed to load customer documents"
          error={loadError}
          onDismiss={() => setLoadError(null)}
        />

        {loading ? (
          <Center padding={8}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label="Loading document archive..." />
              <Text type="supporting">
                {`Fetching ${portalRole} document archive records...`}
              </Text>
            </VStack>
          </Center>
        ) : filteredDocuments.length === 0 ? (
          <EmptyState
            title="No archived documents found"
            description={
              hasActiveFilters
                ? 'No documents match the active Year, City, Customer, or Type filters.'
                : 'No customer documents have been archived yet.'
            }
            icon={<Icon icon="info" />}
            actions={
              <Button
                variant="primary"
                label="Record First Document"
                icon={<Icon icon="upload" />}
                onClick={openRecordModal}
              />
            }
          />
        ) : (
          <VStack gap={3}>
            <Table<DocumentRow>
              aria-label="Customer Document Archive"
              density="compact"
              dividers="rows"
              hasHover
              idKey="id"
              data={pagination.paginatedItems}
              columns={columns}
              rowIndexStart={pagination.rowIndexStart}
              rowCount={pagination.totalItems}
            />
            <TablePaginationFooter
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              label="Customer documents pagination"
            />
          </VStack>
        )}
      </VStack>

      {/* Record / Upload Document Dialog */}
      <Dialog
        isOpen={isRecordOpen}
        onOpenChange={(open) => {
          if (!submitting) setIsRecordOpen(open);
        }}
        purpose="form"
        width={560}
      >
        <Layout
          header={
            <DialogHeader
              title="Record Customer Document"
              subtitle="Upload a scanned file or register an archival document path or URL."
              onOpenChange={(open) => {
                if (!submitting) setIsRecordOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Could not archive document"
                  error={formError}
                  onDismiss={() => setFormError(null)}
                />

                <SegmentedControl
                  label="Submission Mode"
                  value={submitMode}
                  onChange={(val) => {
                    setSubmitMode(val as SubmitMode);
                    setFormError(null);
                  }}
                >
                  <SegmentedControlItem value="upload" label="Upload File" />
                  <SegmentedControlItem value="url" label="Path / URL" />
                </SegmentedControl>

                <form id="record-document-form" onSubmit={handleSubmit}>
                  <FormLayout>
                    <TextInput
                      type="search"
                      label="Lookup Customer in Server Directory"
                      placeholder="Type CUS code, name, or phone to search all customers..."
                      startIcon={<Icon icon="search" />}
                      hasClear
                      value={customerLookupQuery}
                      onChange={setCustomerLookupQuery}
                      width="100%"
                    />

                    <Selector
                      label="Customer"
                      hasSearch
                      searchPlaceholder="Search customers..."
                      placeholder="Select subscriber..."
                      isRequired
                      options={customerModalOptions}
                      value={formCustomerId}
                      onChange={handleCustomerSelectInModal}
                      width="100%"
                    />

                    <Selector
                      label="Document Type"
                      isRequired
                      options={DOCUMENT_TYPE_FORM_OPTIONS}
                      value={formDocType}
                      onChange={(val) => setFormDocType(val as CustomerDocumentType)}
                      width="100%"
                    />

                    <TextInput
                      label="Document Title"
                      placeholder="e.g. Electricity Utility Bill 2026"
                      value={formTitle}
                      onChange={setFormTitle}
                      isRequired
                      width="100%"
                    />

                    <NumberInput
                      label="Archival Year"
                      value={formYear}
                      onChange={setFormYear}
                      min={2000}
                      max={2100}
                      step={1}
                      isIntegerOnly
                      hasNumberSteppers
                      isRequired
                      width="100%"
                    />

                    <Selector
                      label="Territory City"
                      hasSearch
                      searchPlaceholder="Search territory cities..."
                      placeholder="Select 3-digit city..."
                      isRequired
                      options={cityModalOptions}
                      value={formCityCode}
                      onChange={setFormCityCode}
                      width="100%"
                    />

                    {submitMode === 'upload' ? (
                      <FileInput
                        label="Document File"
                        mode="dropzone"
                        accept={ACCEPTED_EXTENSIONS}
                        maxSize={MAX_DOCUMENT_SIZE_BYTES}
                        description="Max 10 MB. Accepted: PDF, PNG, JPG, WEBP, TXT, CSV, DOC, DOCX."
                        isRequired
                        value={selectedFile}
                        onChange={(fileOrFiles) =>
                          setSelectedFile(
                            Array.isArray(fileOrFiles) ? (fileOrFiles[0] ?? null) : fileOrFiles,
                          )
                        }
                        width="100%"
                      />
                    ) : (
                      <TextInput
                        label="File Path or URL"
                        placeholder="/documents/2026/101/utility_bill.pdf"
                        value={formFilePathOrUrl}
                        onChange={setFormFilePathOrUrl}
                        isRequired
                        width="100%"
                      />
                    )}
                  </FormLayout>
                </form>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button
                  variant="ghost"
                  label="Cancel"
                  isDisabled={submitting}
                  onClick={() => setIsRecordOpen(false)}
                />
                <Button
                  type="submit"
                  form="record-document-form"
                  variant="primary"
                  label={submitMode === 'upload' ? 'Upload & Archive' : 'Record Document'}
                  isLoading={submitting}
                  isDisabled={submitting}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* Document Inspection Drawer */}
      <Drawer
        isOpen={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
        label={detailTarget ? `Document #${detailTarget.id}` : 'Document Details'}
        width={520}
      >
        <Layout
          header={
            <DrawerHeader
              title={detailTarget ? detailTarget.title : 'Document Details'}
              subtitle={
                detailTarget
                  ? `${detailTarget.customerName} · ${formatDocTypeLabel(detailTarget.documentType)}`
                  : undefined
              }
              endContent={
                detailTarget ? (
                  <Token
                    size="sm"
                    color={getDocTypeColor(detailTarget.documentType)}
                    label={formatDocTypeLabel(detailTarget.documentType)}
                  />
                ) : undefined
              }
              onOpenChange={(open) => {
                if (!open) setDetailTarget(null);
              }}
            />
          }
          content={
            <LayoutContent>
              {detailTarget && (
                <VStack gap={5}>
                  <MetadataList columns={2} title={<Heading level={4}>Archive Metadata</Heading>}>
                    <MetadataListItem label="Document ID">
                      <Code>{`#${detailTarget.id}`}</Code>
                    </MetadataListItem>
                    <MetadataListItem label="Archival Year">
                      <Code>{String(detailTarget.year)}</Code>
                    </MetadataListItem>
                    <MetadataListItem label="Customer">
                      {detailTarget.customerName}
                    </MetadataListItem>
                    <MetadataListItem label="Customer Code">
                      <CopyableId
                        value={`CUS-${String(detailTarget.customerId).padStart(6, '0')}`}
                        label="Customer Code"
                      />
                    </MetadataListItem>
                    <MetadataListItem label="Territory City">
                      {cityNameMap.get(detailTarget.cityCode)
                        ? `${detailTarget.cityCode} — ${cityNameMap.get(detailTarget.cityCode)}`
                        : `City ${detailTarget.cityCode}`}
                    </MetadataListItem>
                    <MetadataListItem label="Uploaded By">
                      {detailTarget.uploadedByName || `Staff #${detailTarget.uploadedById}`}
                    </MetadataListItem>
                    <MetadataListItem label="Uploaded At">
                      <Timestamp value={detailTarget.uploadedAt} format="date_time" />
                    </MetadataListItem>
                    <MetadataListItem label="Storage Mode">
                      {detailTarget.hasStoredFile ? 'Stored Binary File' : 'Reference Path / URL'}
                    </MetadataListItem>
                    <MetadataListItem label="File Path or URL">
                      <CopyableId value={detailTarget.filePathOrUrl} label="Path/URL" />
                    </MetadataListItem>
                    {detailTarget.hasStoredFile && (
                      <>
                        <MetadataListItem label="Original Filename">
                          {detailTarget.originalFileName || '—'}
                        </MetadataListItem>
                        <MetadataListItem label="Content Type">
                          {detailTarget.contentType || '—'}
                        </MetadataListItem>
                        <MetadataListItem label="File Size">
                          {formatFileSize(detailTarget.fileSizeBytes)}
                        </MetadataListItem>
                      </>
                    )}
                  </MetadataList>

                  {detailTarget.hasStoredFile ? (
                    <Card padding={4} variant="muted">
                      <HStack gap={3} vAlign="center" wrap="wrap">
                        <Link href={getDocumentDownloadUrl(detailTarget.id)} download isStandalone>
                          Download Stored File
                        </Link>
                        <Button
                          size="sm"
                          variant="secondary"
                          label="Open Inline Preview"
                          icon={<Icon icon="externalLink" />}
                          onClick={() =>
                            window.open(
                              getDocumentDownloadUrl(detailTarget.id, true),
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }
                        />
                      </HStack>
                    </Card>
                  ) : /^https?:\/\//i.test(detailTarget.filePathOrUrl) ? (
                    <Card padding={4} variant="muted">
                      <Link href={detailTarget.filePathOrUrl} isExternalLink isStandalone>
                        Open External Document URL
                      </Link>
                    </Card>
                  ) : null}
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end">
                <Button
                  label="Close"
                  variant="secondary"
                  onClick={() => setDetailTarget(null)}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Drawer>
    </Card>
  );
}
