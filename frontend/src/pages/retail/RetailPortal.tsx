import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { RetailCustomersSection } from './RetailCustomersSection';
import { RetailOrdersSection } from './RetailOrdersSection';
import { RetailRequestsSection } from './RetailRequestsSection';
import { RETAIL_SECTION_META, type RetailSection } from './retailTypes';

export function RetailPortal({ section }: { section: RetailSection }): JSX.Element {
  const [prevSection, setPrevSection] = useState<RetailSection>(section);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeSectionRef = useRef<RetailSection>(section);
  const isMountedRef = useRef(true);

  if (prevSection !== section) {
    setPrevSection(section);
    setItemCount(null);
    setIsRefreshing(false);
  }

  useLayoutEffect(() => {
    activeSectionRef.current = section;
  }, [section]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const meta = RETAIL_SECTION_META[section];

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const sectionCallbacks = useMemo(
    () => ({
      onCountChange: (count: number | null) => {
        if (isMountedRef.current && activeSectionRef.current === section) {
          setItemCount(count);
        }
      },
      onRefreshingChange: (refreshing: boolean) => {
        if (isMountedRef.current && activeSectionRef.current === section) {
          setIsRefreshing(refreshing);
        }
      },
    }),
    [section],
  );

  const renderSection = () => {
    const sharedProps = {
      refreshTrigger,
      onCountChange: sectionCallbacks.onCountChange,
      onRefreshingChange: sectionCallbacks.onRefreshingChange,
    };

    switch (section) {
      case 'customers':
        return <RetailCustomersSection key="customers" {...sharedProps} />;
      case 'requests':
        return <RetailRequestsSection key="requests" {...sharedProps} />;
      case 'orders':
        return <RetailOrdersSection key="orders" {...sharedProps} />;
    }
  };

  return (
    <VStack gap={6}>
      <Card padding={5}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <Token size="sm" color="blue" label="Retail" />
              <Token size="sm" color="teal" label={meta.tokenLabel} />
            </HStack>
            <Heading level={1}>{meta.title}</Heading>
            <Text type="supporting">{meta.subtitle}</Text>
          </VStack>

          <HStack gap={3} vAlign="center">
            <Badge
              variant="neutral"
              label={itemCount !== null ? `${itemCount} ${meta.countLabel}` : '...'}
            />
            <Button
              size="sm"
              variant="secondary"
              label="Refresh"
              isLoading={isRefreshing}
              isDisabled={isRefreshing}
              onClick={handleRefresh}
            />
          </HStack>
        </HStack>
      </Card>

      {renderSection()}
    </VStack>
  );
}
