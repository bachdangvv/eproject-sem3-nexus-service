import { useCallback, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { Card } from '@astryxdesign/core/Card';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import type { OrderAdvancedSearchFilters } from '../types/nexus';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDateValue(value: string): ISODateString | undefined {
  const trimmed = value.trim();
  return ISO_DATE_PATTERN.test(trimmed) ? (trimmed as ISODateString) : undefined;
}

const SERVICE_TYPE_SELECT_OPTIONS = [
  { value: 'ALL', label: 'All Services (ALL)' },
  { value: 'B', label: 'Broadband (B)' },
  { value: 'D', label: 'Dial-Up (D)' },
  { value: 'T', label: 'Telephone (T)' },
];

export interface OrderAdvancedSearchPanelProps {
  filters: OrderAdvancedSearchFilters;
  onChange: (filters: OrderAdvancedSearchFilters) => void;
  onSearch: (filters: OrderAdvancedSearchFilters) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function OrderAdvancedSearchPanel({
  filters,
  onChange,
  onSearch,
  onReset,
  isLoading = false,
}: OrderAdvancedSearchPanelProps): JSX.Element {
  const dateError =
    filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
      ? 'From date cannot be after To date.'
      : null;

  const updateField = useCallback(
    (field: keyof OrderAdvancedSearchFilters, value: string) => {
      onChange({ ...filters, [field]: value });
    },
    [filters, onChange],
  );

  const hasActiveFilters = Boolean(
    filters.code.trim() ||
      filters.customerName.trim() ||
      (filters.serviceType && filters.serviceType !== 'ALL') ||
      filters.fromDate.trim() ||
      filters.toDate.trim() ||
      filters.phone.trim(),
  );

  const handleSearchSubmit = () => {
    if (dateError) {
      return;
    }
    onSearch(filters);
  };

  const handleResetFilters = () => {
    onReset();
  };

  return (
    <Card padding={4} variant="muted">
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <HStack gap={2} vAlign="center">
            <Icon icon="search" size="sm" />
            <Heading level={3}>
              5-Criteria Advanced Order Search
            </Heading>
          </HStack>
          <HStack gap={2} vAlign="center">
            {hasActiveFilters && <Token size="sm" color="blue" label="Filters Active" />}
            <Badge variant="neutral" label="5 Criteria" />
          </HStack>
        </HStack>

        <Grid columns={{ minWidth: 220, max: 3 }} gap={4} width="100%">
          {/* (1) Unique Code */}
          <TextInput
            label="Unique Code"
            placeholder="Order ID (e.g. B0000000001) or Account ID"
            description="11-char Order ID or 16-char Connection Account ID"
            value={filters.code}
            onChange={(val) => updateField('code', val)}
            onEnter={handleSearchSubmit}
            hasClear
          />

          {/* (2) Customer Name */}
          <TextInput
            label="Customer Name"
            placeholder="Substring search..."
            description="Case-insensitive customer name match"
            value={filters.customerName}
            onChange={(val) => updateField('customerName', val)}
            onEnter={handleSearchSubmit}
            hasClear
          />

          {/* (3) Service Type */}
          <Selector
            label="Service Type"
            options={SERVICE_TYPE_SELECT_OPTIONS}
            value={filters.serviceType}
            onChange={(val) => updateField('serviceType', val)}
          />

          {/* (4a) Placed From Date */}
          <DateInput
            label="From Date"
            description="Earliest order creation date"
            value={toIsoDateValue(filters.fromDate)}
            onChange={(val) => updateField('fromDate', val ?? '')}
            hasClear
          />

          {/* (4b) Placed To Date */}
          <DateInput
            label="To Date"
            description="Latest order creation date"
            value={toIsoDateValue(filters.toDate)}
            onChange={(val) => updateField('toDate', val ?? '')}
            status={dateError ? { type: 'error', message: dateError } : undefined}
            hasClear
          />

          {/* (5) Customer Phone */}
          <TextInput
            label="Customer Phone"
            placeholder="e.g. +84912345678 or partial number"
            description="Customer phone substring match"
            value={filters.phone}
            onChange={(val) => updateField('phone', val)}
            onEnter={handleSearchSubmit}
            hasClear
          />
        </Grid>

        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Text type="supporting">
            {hasActiveFilters
              ? 'Multi-criteria filters applied. Press Search to query the database.'
              : 'Enter any combination of the 5 criteria to query matching orders.'}
          </Text>
          <HStack gap={2}>
            <Button
              variant="secondary"
              label="Reset Filters"
              onClick={handleResetFilters}
              isDisabled={isLoading || !hasActiveFilters}
            />
            <Button
              variant="primary"
              label="Search"
              icon={<Icon icon="search" />}
              onClick={handleSearchSubmit}
              isLoading={isLoading}
            />
          </HStack>
        </HStack>
      </VStack>
    </Card>
  );
}
