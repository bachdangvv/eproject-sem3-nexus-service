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
import { TechnicalAssessmentsSection } from './TechnicalAssessmentsSection';
import { TechnicalConnectionsSection } from './TechnicalConnectionsSection';
import { TechnicalOrdersSection } from './TechnicalOrdersSection';
import { TECHNICAL_SECTION_META, type TechnicalSection } from './technicalTypes';

const SECTION_ROUTE_MAP: Record<TechnicalSection, RoutePathValue> = {
  assessments: RoutePath.TECHNICAL_ASSESSMENTS,
  connections: RoutePath.TECHNICAL_CONNECTIONS,
  orders: RoutePath.TECHNICAL_ORDERS,
};

export function TechnicalPortal({ section }: { section: TechnicalSection }): JSX.Element {
  const { navigate } = useRouter();

  const [prevSection, setPrevSection] = useState<TechnicalSection>(section);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeSectionRef = useRef<TechnicalSection>(section);
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

  const meta = TECHNICAL_SECTION_META[section];

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
      case 'assessments':
        return <TechnicalAssessmentsSection key="assessments" {...sharedProps} />;
      case 'connections':
        return <TechnicalConnectionsSection key="connections" {...sharedProps} />;
      case 'orders':
        return <TechnicalOrdersSection key="orders" {...sharedProps} />;
    }
  };

  return (
    <VStack gap={6}>
      <Card padding={5}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={4}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <Token size="sm" color="blue" label="Technical" />
              <Token size="sm" color="teal" label={meta.tokenLabel} />
            </HStack>
            <Heading level={1}>{meta.title}</Heading>
            <Text type="supporting">{meta.subtitle}</Text>
          </VStack>

          <HStack gap={3} vAlign="center" wrap="wrap">
            <SegmentedControl
              label="Technical portal sections"
              value={section}
              onChange={(val) => {
                const target = val as TechnicalSection;
                if (target !== section) {
                  navigate(SECTION_ROUTE_MAP[target]);
                }
              }}
            >
              <SegmentedControlItem value="assessments" label="Assessments" />
              <SegmentedControlItem value="connections" label="Connections" />
              <SegmentedControlItem value="orders" label="All Orders" />
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
