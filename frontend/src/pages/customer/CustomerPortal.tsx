/**
 * Root Customer Portal shell rendering the active customer section header and workspace panel.
 */
import { useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { useAuth } from '../../context/AuthContext';
import { RoutePath } from '../../router/router';
import { CustomerBillingSection } from './CustomerBillingSection';
import { CustomerOrdersSection } from './CustomerOrdersSection';
import { CustomerProfileSection } from './CustomerProfileSection';
import { CustomerSupportSection } from './CustomerSupportSection';
import { CUSTOMER_SECTION_META, type CustomerSection } from './customerTypes';

export function CustomerPortal({ section }: { section: CustomerSection }): JSX.Element {
  const { session } = useAuth();
  const [prevSection, setPrevSection] = useState<CustomerSection>(section);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeSectionRef = useRef<CustomerSection>(section);

  if (prevSection !== section) {
    setPrevSection(section);
    setSectionCount(null);
    setRefreshing(false);
  }

  useLayoutEffect(() => {
    activeSectionRef.current = section;
  }, [section]);

  const meta = CUSTOMER_SECTION_META[section];

  const sectionCallbacks = useMemo(
    () => ({
      onCountChange: (count: number | null) => {
        if (activeSectionRef.current === section) {
          setSectionCount(count);
        }
      },
      onRefreshingChange: (isRefreshing: boolean) => {
        if (activeSectionRef.current === section) {
          setRefreshing(isRefreshing);
        }
      },
    }),
    [section],
  );

  return (
    <VStack gap={5}>
      <Card padding={5}>
        <HStack hAlign="between" vAlign="center" gap={4} wrap="wrap">
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Token size="sm" color="blue" label={session.customerCode || 'Customer'} />
              <Token size="sm" color="purple" label={meta.tokenLabel} />
            </HStack>
            <Heading level={1}>{meta.title}</Heading>
            <Text type="supporting">{meta.subtitle}</Text>
          </VStack>

          <HStack gap={2} vAlign="center" wrap="wrap">
            {sectionCount !== null && (
              <Badge variant="neutral" label={`${sectionCount} ${meta.countLabel}`} />
            )}
            <Button variant="secondary" label="Browse Public Plans" href={RoutePath.HOME} />
            <Button
              variant="secondary"
              label="Refresh"
              isLoading={refreshing}
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
            />
          </HStack>
        </HStack>
      </Card>

      {section === 'profile' && (
        <CustomerProfileSection
          refreshTrigger={refreshTrigger}
          onCountChange={sectionCallbacks.onCountChange}
          onRefreshingChange={sectionCallbacks.onRefreshingChange}
        />
      )}
      {section === 'orders' && (
        <CustomerOrdersSection
          refreshTrigger={refreshTrigger}
          onCountChange={sectionCallbacks.onCountChange}
          onRefreshingChange={sectionCallbacks.onRefreshingChange}
        />
      )}
      {section === 'billing' && (
        <CustomerBillingSection
          refreshTrigger={refreshTrigger}
          onCountChange={sectionCallbacks.onCountChange}
          onRefreshingChange={sectionCallbacks.onRefreshingChange}
        />
      )}
      {section === 'support' && (
        <CustomerSupportSection
          refreshTrigger={refreshTrigger}
          onCountChange={sectionCallbacks.onCountChange}
          onRefreshingChange={sectionCallbacks.onRefreshingChange}
        />
      )}
    </VStack>
  );
}
