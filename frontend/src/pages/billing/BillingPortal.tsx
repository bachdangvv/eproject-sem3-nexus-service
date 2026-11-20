import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
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
import { getBillingAccounts } from '../../services/billingApi';
import { getCities } from '../../services/catalogApi';
import type { BillingView } from '../../types/nexus';
import { BillingAccountsSection } from './BillingAccountsSection';
import { BillingPaymentsSection } from './BillingPaymentsSection';
import { BillingRegistrySection } from './BillingRegistrySection';
import { BILLING_SECTION_META, type BillingSection } from './billingTypes';

const SECTION_ROUTE_MAP: Record<BillingSection, RoutePathValue> = {
  lookup: RoutePath.BILLING_ACCOUNTS,
  payments: RoutePath.BILLING_PAYMENTS,
  registry: RoutePath.BILLING_REGISTRY,
};

export function BillingPortal({
  section = 'lookup',
}: {
  section?: BillingSection;
}): JSX.Element {
  const { navigate } = useRouter();

  const [prevSection, setPrevSection] = useState<BillingSection>(section);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [records, setRecords] = useState<BillingView[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [citiesByCode, setCitiesByCode] = useState<Record<string, string>>({});

  const activeSectionRef = useRef<BillingSection>(section);
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
    let cancelled = false;

    void Promise.resolve()
      .then(() => getCities())
      .then((cities) => {
        if (cancelled || !isMountedRef.current) return;
        const nextMap: Record<string, string> = {};
        for (const city of cities) {
          nextMap[city.code] = city.name;
        }
        setCitiesByCode(nextMap);
      })
      .catch(() => {
        // Non-fatal: fallback displays City {code}
      });

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => getBillingAccounts())
      .then((data) => {
        if (!cancelled && isMountedRef.current) {
          setRecords(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const handleRecordUpsert = useCallback((record: BillingView) => {
    setRecords((prev) => {
      const index = prev.findIndex((item) => item.accountId === record.accountId);
      if (index >= 0) {
        const next = [...prev];
        next[index] = record;
        return next;
      }
      return [record, ...prev];
    });
  }, []);

  const handleBatchRefresh = useCallback((updatedRecords: BillingView[]) => {
    setRecords((prev) => {
      const map = new Map<string, BillingView>();
      for (const item of updatedRecords) {
        map.set(item.accountId, item);
      }
      return prev.map((item) => map.get(item.accountId) ?? item);
    });
  }, []);

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

  const meta = BILLING_SECTION_META[section];

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const renderSection = () => {
    const sharedProps = {
      records,
      selectedAccountId,
      citiesByCode,
      refreshTrigger,
      onRecordUpsert: handleRecordUpsert,
      onBatchRefresh: handleBatchRefresh,
      onSelectAccount: setSelectedAccountId,
      onCountChange: sectionCallbacks.onCountChange,
      onRefreshingChange: sectionCallbacks.onRefreshingChange,
    };

    switch (section) {
      case 'lookup':
        return <BillingAccountsSection key="lookup" {...sharedProps} />;
      case 'payments':
        return <BillingPaymentsSection key="payments" {...sharedProps} />;
      case 'registry':
        return <BillingRegistrySection key="registry" {...sharedProps} />;
    }
  };

  return (
    <VStack gap={6}>
      <Card padding={5}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <Token size="sm" color="blue" label="Billing" />
              <Token size="sm" color="teal" label={meta.tokenLabel} />
            </HStack>
            <Heading level={1}>{meta.title}</Heading>
            <Text type="supporting">{meta.subtitle}</Text>
          </VStack>

          <HStack gap={3} vAlign="center" wrap="wrap">
            <SegmentedControl
              label="Billing portal sections"
              value={section}
              onChange={(val) => {
                const target = val as BillingSection;
                if (target !== section) {
                  navigate(SECTION_ROUTE_MAP[target]);
                }
              }}
            >
              <SegmentedControlItem value="lookup" label="Account Lookup" />
              <SegmentedControlItem value="payments" label="Payments" />
              <SegmentedControlItem value="registry" label="Registry" />
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

      {renderSection()}
    </VStack>
  );
}
