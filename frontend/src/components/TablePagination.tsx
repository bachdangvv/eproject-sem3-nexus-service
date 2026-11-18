import type { JSX } from 'react';
import { Divider } from '@astryxdesign/core/Divider';
import { HStack } from '@astryxdesign/core/HStack';
import { Pagination } from '@astryxdesign/core/Pagination';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../hooks/useClientPagination';

export function TablePaginationFooter({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  label = 'Table pagination',
  minVisibleTotal = DEFAULT_PAGE_SIZE,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  label?: string;
  minVisibleTotal?: number;
}): JSX.Element | null {
  if (totalItems <= minVisibleTotal) {
    return null;
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <VStack gap={3}>
      <Divider />
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Text type="supporting" hasTabularNumbers>
          {`Showing ${startItem}-${endItem} of ${totalItems}`}
        </Text>
        <Pagination
          size="sm"
          variant="pages"
          page={page}
          onChange={onPageChange}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={onPageSizeChange}
          label={label}
        />
      </HStack>
    </VStack>
  );
}
