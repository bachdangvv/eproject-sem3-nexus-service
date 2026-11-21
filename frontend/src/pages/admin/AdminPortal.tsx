/**
 * Admin operations portal shell routing across service plans, products, cities/outlets,
 * employees, customers/documents, vendors/procurement, and customer queries.
 */
import { useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { RoutePath, useRouter } from '../../router/router';
import { ADMIN_SECTION_META, type AdminSection } from './adminTypes';
import { CitiesSection } from './CitiesSection';
import { CustomersSection } from './CustomersSection';
import { EmployeesSection } from './EmployeesSection';
import { PlansSection } from './PlansSection';
import { ProductsSection } from './ProductsSection';
import { PurchasesSection } from './PurchasesSection';
import { RetailShopsSection } from './RetailShopsSection';
import { VendorPaymentsSection } from './VendorPaymentsSection';
import { VendorsSection } from './VendorsSection';
import { CustomerQueriesSection } from '../shared/CustomerQueriesSection';
import { PlanChangesSection } from '../shared/PlanChangesSection';

export function AdminPortal({ section }: { section: AdminSection }): JSX.Element {
  const { navigate } = useRouter();
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
        return <CustomersSection key="customers" initialView="directory" {...sharedProps} />;
      case 'retail-shops':
        return <RetailShopsSection key="retail-shops" {...sharedProps} />;
      case 'vendors':
        return <VendorsSection key="vendors" {...sharedProps} />;
      case 'purchases':
        return <PurchasesSection key="purchases" {...sharedProps} />;
      case 'vendor-payments':
        return <VendorPaymentsSection key="vendor-payments" {...sharedProps} />;
      case 'documents':
        return <CustomersSection key="customers-docs" initialView="documents" {...sharedProps} />;
      case 'plan-changes':
        return <PlanChangesSection key="plan-changes" roleMode="admin" {...sharedProps} />;
      case 'queries':
        return <CustomerQueriesSection key="queries" portalRole="Admin" {...sharedProps} />;
    }
  };

  const renderSubTabs = () => {
    if (section === 'plans' || section === 'plan-changes') {
      return (
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <SegmentedControl
            label="Service plans workspace view"
            value={section}
            onChange={(val) =>
              navigate(val === 'plan-changes' ? RoutePath.ADMIN_PLAN_CHANGES : RoutePath.ADMIN_PLANS)
            }
          >
            <SegmentedControlItem value="plans" label="Plans Catalog" />
            <SegmentedControlItem value="plan-changes" label="Plan Change Requests" />
          </SegmentedControl>
        </HStack>
      );
    }

    if (section === 'cities' || section === 'retail-shops') {
      return (
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <SegmentedControl
            label="Cities and retail outlets workspace view"
            value={section}
            onChange={(val) =>
              navigate(val === 'retail-shops' ? RoutePath.ADMIN_RETAIL_SHOPS : RoutePath.ADMIN_CITIES)
            }
          >
            <SegmentedControlItem value="cities" label="Territory Cities" />
            <SegmentedControlItem value="retail-shops" label="Retail Outlets" />
          </SegmentedControl>
        </HStack>
      );
    }

    if (section === 'vendors' || section === 'purchases' || section === 'vendor-payments') {
      return (
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <SegmentedControl
            label="Vendors and procurement workspace view"
            value={section}
            onChange={(val) => {
              if (val === 'purchases') navigate(RoutePath.ADMIN_PURCHASES);
              else if (val === 'vendor-payments') navigate(RoutePath.ADMIN_VENDOR_PAYMENTS);
              else navigate(RoutePath.ADMIN_VENDORS);
            }}
          >
            <SegmentedControlItem value="vendors" label="Vendors Directory" />
            <SegmentedControlItem value="purchases" label="Equipment Purchases" />
            <SegmentedControlItem value="vendor-payments" label="Vendor Payments" />
          </SegmentedControl>
        </HStack>
      );
    }

    return null;
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

      {renderSubTabs()}
      {renderSection()}
    </VStack>
  );
}
