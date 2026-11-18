import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, CopyableId } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { createCity, getCities } from '../../services/catalogApi';
import type { CityView } from '../../types/nexus';
import {
  CITY_CODE_REGEX,
  extractErrorMessage,
  extractFieldErrors,
  type AdminSectionProps,
  type CityRow,
} from './adminTypes';

export function CitiesSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [cities, setCities] = useState<CityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<{ code?: string; name?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadCities = useCallback(
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
        const data = await getCities();
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setCities(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load territory cities.'));
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
    void loadCities(isSilent);
  }, [loadCities, refreshTrigger]);

  const trimmedCode = code.trim();
  const trimmedName = name.trim();
  const isCodeFormatValid = CITY_CODE_REGEX.test(trimmedCode);
  const isDuplicateCode = useMemo(
    () => isCodeFormatValid && cities.some((city) => city.code === trimmedCode),
    [cities, isCodeFormatValid, trimmedCode],
  );
  const isNameValid = trimmedName.length >= 1 && trimmedName.length <= 100;
  const isFormValid = isCodeFormatValid && !isDuplicateCode && isNameValid;

  const codeStatus = useMemo(() => {
    if (serverFieldErrors.code) {
      return { type: 'error' as const, message: serverFieldErrors.code };
    }
    if (!trimmedCode && !codeTouched) {
      return undefined;
    }
    if (!isCodeFormatValid) {
      return {
        type: 'error' as const,
        message: 'City code must be exactly 3 numeric digits (e.g. 102).',
      };
    }
    if (isDuplicateCode) {
      return {
        type: 'error' as const,
        message: `City code ${trimmedCode} is already registered.`,
      };
    }
    return {
      type: 'success' as const,
      message: `Valid 3-digit territory code (${trimmedCode}).`,
    };
  }, [codeTouched, isCodeFormatValid, isDuplicateCode, serverFieldErrors.code, trimmedCode]);

  const nameStatus = useMemo(() => {
    if (serverFieldErrors.name) {
      return { type: 'error' as const, message: serverFieldErrors.name };
    }
    if (!trimmedName && !nameTouched) {
      return undefined;
    }
    if (!trimmedName) {
      return { type: 'error' as const, message: 'City name is required.' };
    }
    if (trimmedName.length > 100) {
      return { type: 'error' as const, message: 'City name must be 100 characters or fewer.' };
    }
    return undefined;
  }, [nameTouched, serverFieldErrors.name, trimmedName]);

  const cityRows = useMemo<CityRow[]>(() => cities.map((city) => ({ ...city })), [cities]);
  const pagination = useClientPagination(cityRows);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setCodeTouched(true);
    setNameTouched(true);
    setSubmitError(null);
    setServerFieldErrors({});

    if (!isFormValid) {
      return;
    }

    setSubmitting(true);
    try {
      const created = await createCity({ code: trimmedCode, name: trimmedName });
      if (!isMountedRef.current) return;
      setCode('');
      setName('');
      setCodeTouched(false);
      setNameTouched(false);
      toast({ body: `Registered city ${created.code} (${created.name}).` });
      pagination.focusItem((item) => item.code === created.code);
      await loadCities(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const fields = extractFieldErrors(err);
      setServerFieldErrors({
        code: fields.code,
        name: fields.name,
      });
      setSubmitError(extractErrorMessage(err, 'Could not register territory city.'));
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const columns: TableColumn<CityRow>[] = [
    {
      key: 'code',
      header: 'City Code',
      width: pixel(145),
      renderCell: (row) => <CopyableId value={row.code} label="City Code" />,
    },
    {
      key: 'name',
      header: 'City Name',
      width: proportional(1, { minWidth: 160 }),
      renderCell: (row) => <Text weight="semibold">{row.name}</Text>,
    },
  ];

  return (
    <Grid columns={{ minWidth: 320, max: 2 }} gap={6} align="start">
      <Card padding={6}>
        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={2}>Register Territory City</Heading>
            <Text type="supporting">
              Each city uses an immutable 3-digit numeric code embedded in subscriber Account IDs.
            </Text>
          </VStack>

          <ApiErrorBanner
            title="Could not register city"
            error={submitError}
            onDismiss={() => setSubmitError(null)}
          />

          <form onSubmit={(e) => void handleSubmit(e)}>
            <FormLayout>
              <TextInput
                label="City Code (3 Digits)"
                placeholder="e.g. 102"
                inputMode="numeric"
                description="Must be exactly 3 ASCII digits (000–999)."
                isRequired
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setCodeTouched(true);
                  setServerFieldErrors((prev) => ({ ...prev, code: undefined }));
                  setSubmitError(null);
                }}
                status={codeStatus}
              />
              <TextInput
                label="City Name"
                placeholder="e.g. Ho Chi Minh City"
                isRequired
                value={name}
                onChange={(value) => {
                  setName(value);
                  setNameTouched(true);
                  setServerFieldErrors((prev) => ({ ...prev, name: undefined }));
                  setSubmitError(null);
                }}
                status={nameStatus}
              />
              <HStack gap={2} vAlign="center">
                <Button
                  type="submit"
                  variant="primary"
                  label="Create City"
                  isLoading={submitting}
                  isDisabled={!isFormValid || submitting}
                />
              </HStack>
            </FormLayout>
          </form>
        </VStack>
      </Card>

      <Card padding={6}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Registered Territory Cities</Heading>
              <Badge variant="neutral" label={cities.length} />
            </HStack>
          </HStack>

          <ApiErrorBanner
            title="Failed to load cities"
            error={loadError}
            onDismiss={() => setLoadError(null)}
          />

          {loading && cities.length === 0 ? (
            <Center padding={8}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading territory cities..." />
                <Text type="supporting">Loading registered cities...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<CityRow>
                aria-label="Registered Territory Cities"
                density="compact"
                dividers="rows"
                hasHover
                idKey="code"
                columns={columns}
                data={pagination.paginatedItems}
                rowIndexStart={pagination.rowIndexStart}
                rowCount={pagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No territory cities registered"
                    description="Use the form to add the first 3-digit territory city."
                    icon={<Icon icon="info" />}
                    isCompact
                  />
                }
              />
              <TablePaginationFooter
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                label="Territory cities pagination"
              />
            </>
          )}
        </VStack>
      </Card>
    </Grid>
  );
}
