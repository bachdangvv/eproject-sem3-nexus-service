/**
 * Retail storefront portal shell routing across customer onboarding, service requests,
 * orders, connection lifecycle/plan changes, in-store billing, and queries/FAQ.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { RoutePath, useRouter, type RoutePathValue } from '../../router/router';
import { RetailBillingSection } from './RetailBillingSection';
import { RetailCustomersSection } from './RetailCustomersSection';
import { RetailLifecycleSection } from './RetailLifecycleSection';
import { RetailOrdersSection } from './RetailOrdersSection';
import { RetailRequestsSection } from './RetailRequestsSection';
import { CustomerQueriesSection } from '../shared/CustomerQueriesSection';
import { PlanChangesSection } from '../shared/PlanChangesSection';
import { RETAIL_SECTION_META, type RetailSection } from './retailTypes';

const SECTION_ROUTE_MAP: Record<RetailSection, RoutePathValue> = {
  customers: RoutePath.RETAIL_CUSTOMERS,
  requests: RoutePath.RETAIL_REQUESTS,
  orders: RoutePath.RETAIL_ORDERS,
  billing: RoutePath.RETAIL_BILLING,
  lifecycle: RoutePath.RETAIL_LIFECYCLE,
  documents: RoutePath.RETAIL_DOCUMENTS,
  'plan-changes': RoutePath.RETAIL_PLAN_CHANGES,
  queries: RoutePath.RETAIL_QUERIES,
};

export function RetailPortal({ section }: { section: RetailSection }): JSX.Element {
  const { navigate } = useRouter();

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
        return <RetailCustomersSection key="customers" initialView="directory" {...sharedProps} />;
      case 'requests':
        return <RetailRequestsSection key="requests" {...sharedProps} />;
      case 'orders':
        return <RetailOrdersSection key="orders" {...sharedProps} />;
      case 'billing':
        return <RetailBillingSection key="billing" {...sharedProps} />;
      case 'lifecycle':
        return <RetailLifecycleSection key="lifecycle" {...sharedProps} />;
      case 'documents':
        return <RetailCustomersSection key="customers-docs" initialView="documents" {...sharedProps} />;
      case 'plan-changes':
        return <PlanChangesSection key="plan-changes" roleMode="retail" {...sharedProps} />;
      case 'queries':
        return <CustomerQueriesSection key="queries" portalRole="Retail" {...sharedProps} />;
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

          <HStack gap={3} vAlign="center" wrap="wrap">
            <SegmentedControl
              label="Retail portal sections"
              value={
                section === 'documents'
                  ? 'customers'
                  : section === 'plan-changes'
                    ? 'lifecycle'
                    : section
              }
              onChange={(val) => {
                const target = val as RetailSection;
                if (target !== section) {
                  navigate(SECTION_ROUTE_MAP[target]);
                }
              }}
            >
              <SegmentedControlItem value="customers" label="Customers" />
              <SegmentedControlItem value="requests" label="Requests" />
              <SegmentedControlItem value="orders" label="Orders" />
              <SegmentedControlItem value="lifecycle" label="Connections" />
              <SegmentedControlItem value="billing" label="Billing & Payments" />
              <SegmentedControlItem value="queries" label="Queries & FAQ" />
            </SegmentedControl>
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

      {(section === 'lifecycle' || section === 'plan-changes') && (
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <SegmentedControl
            label="Retail connection management view"
            value={section}
            onChange={(val) =>
              navigate(
                val === 'plan-changes'
                  ? RoutePath.RETAIL_PLAN_CHANGES
                  : RoutePath.RETAIL_LIFECYCLE,
              )
            }
          >
            <SegmentedControlItem value="lifecycle" label="Connection Lifecycle" />
            <SegmentedControlItem value="plan-changes" label="Plan Change Requests" />
          </SegmentedControl>
        </HStack>
      )}

      {renderSection()}
    </VStack>
  );
}
