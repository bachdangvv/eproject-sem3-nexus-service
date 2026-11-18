import { useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { ADMIN_SECTION_META, type AdminSection } from './adminTypes';
import { CitiesSection } from './CitiesSection';
import { CustomersSection } from './CustomersSection';
import { EmployeesSection } from './EmployeesSection';
import { PlansSection } from './PlansSection';
import { ProductsSection } from './ProductsSection';

export function AdminPortal({ section }: { section: AdminSection }): JSX.Element {
  const [prevSection, setPrevSection] = useState<AdminSection>(section);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeSectionRef = useRef<AdminSection>(section);

  if (prevSection !== section) {
    setPrevSection(section);
    setItemCount(null);
    setIsRefreshing(false);
  }

  useLayoutEffect(() => {
    activeSectionRef.current = section;
  }, [section]);

  const meta = ADMIN_SECTION_META[section];

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const sectionCallbacks = useMemo(
    () => ({
      onCountChange: (count: number | null) => {
        if (activeSectionRef.current === section) {
          setItemCount(count);
        }
      },
      onRefreshingChange: (refreshing: boolean) => {
        if (activeSectionRef.current === section) {
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
      case 'plans':
        return <PlansSection key="plans" {...sharedProps} />;
      case 'products':
        return <ProductsSection key="products" {...sharedProps} />;
      case 'cities':
        return <CitiesSection key="cities" {...sharedProps} />;
      case 'employees':
        return <EmployeesSection key="employees" {...sharedProps} />;
      case 'customers':
        return <CustomersSection key="customers" {...sharedProps} />;
    }
  };

  return (
    <VStack gap={6}>
      <Card padding={5}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <Token size="sm" color="purple" label="Admin" />
              <Token size="sm" color="blue" label={meta.tokenLabel} />
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
