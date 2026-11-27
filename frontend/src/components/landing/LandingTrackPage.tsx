/**
 * Public zero-PII order and account status tracking page (/track).
 */
import { useCallback, useState, type FormEvent, type JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import {
  CopyableId,
  OrderLifecycleStepper,
  OrderStatusPill,
  ServiceTypeToken,
} from '../StatusViews';
import { trackAccount, trackOrder } from '../../services/publicApi';
import { ApiError } from '../../types/nexus';
import type { PublicTrackView } from '../../types/nexus';

type TrackingQueryType = 'order' | 'account';

function formatTrackingError(
  err: unknown,
  trackType: TrackingQueryType,
  normalized: string,
): string {
  if (err instanceof ApiError && err.status === 404) {
    return `No record found for ${trackType === 'order' ? 'Order Code' : 'Account ID'} "${normalized}".`;
  }
  if (err instanceof ApiError) {
    return err.detail || err.message || 'Unable to check status right now.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unable to reach the tracking service.';
}

export function LandingTrackPage(): JSX.Element {
  const [trackType, setTrackType] = useState<TrackingQueryType>('order');
  const [trackQuery, setTrackQuery] = useState('');
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [trackResult, setTrackResult] = useState<PublicTrackView | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const handlePerformTrack = useCallback(async () => {
    const normalized = trackQuery.trim().toUpperCase();
    if (!normalized) {
      setTrackError(
        trackType === 'order'
          ? 'Enter an 11-character Order Code (e.g. B0000000001).'
          : 'Enter a 16-character Account ID (e.g. B101000000000001).',
      );
      setTrackResult(null);
      return;
    }

    setIsLoadingTrack(true);
    setTrackError(null);
    setTrackResult(null);

    try {
      const result =
        trackType === 'order' ? await trackOrder(normalized) : await trackAccount(normalized);
      setTrackResult(result);
    } catch (err) {
      setTrackError(formatTrackingError(err, trackType, normalized));
    } finally {
      setIsLoadingTrack(false);
    }
  }, [trackQuery, trackType]);

  const handleTrackSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void handlePerformTrack();
    },
    [handlePerformTrack],
  );

  return (
    <VStack gap={6}>
      <VStack gap={2} hAlign="start">
        <Text type="eyebrow" display="block">
          ▲ PUBLIC STATUS TELEMETRY
        </Text>
        <Heading level={1} type="display-2">
          Track Order or Account
        </Heading>
        <Text type="supporting">
          Enter the 11-character Order Code from your retail receipt (e.g. B0000000001) or your
          16-character Account ID (e.g. B101000000000001) for live installation status.
        </Text>
      </VStack>

      <Card padding={5}>
        <form onSubmit={handleTrackSubmit}>
          <FormLayout>
            <SegmentedControl
              size="sm"
              label="Lookup Type"
              value={trackType}
              onChange={(val) => {
                setTrackType(val as TrackingQueryType);
                setTrackResult(null);
                setTrackError(null);
              }}
            >
              <SegmentedControlItem value="order" label="Order Code" />
              <SegmentedControlItem value="account" label="Account ID" />
            </SegmentedControl>

            <HStack gap={3} vAlign="end" wrap="wrap">
              <TextInput
                label={trackType === 'order' ? 'Order Code' : 'Account ID'}
                placeholder={
                  trackType === 'order' ? 'e.g. B0000000001' : 'e.g. B101000000000001'
                }
                value={trackQuery}
                onChange={setTrackQuery}
                hasClear
                autoCapitalize="characters"
                hasAutoCorrect={false}
                hasSpellCheck={false}
                isRequired
              />
              <Button
                type="submit"
                variant="primary"
                label="Check Status"
                icon={<Icon icon="search" />}
                isLoading={isLoadingTrack}
                isDisabled={isLoadingTrack}
              />
            </HStack>
          </FormLayout>
        </form>
      </Card>

      {isLoadingTrack && (
        <VStack gap={2} hAlign="center" padding={4}>
          <Spinner size="md" label="Checking order status..." />
          <Text type="supporting">Checking status...</Text>
        </VStack>
      )}

      {trackError && (
        <Banner
          status="warning"
          container="section"
          collapsible={false}
          title="Status Not Available"
          description={trackError}
        />
      )}

      {trackResult && (
        <Card padding={5}>
          <VStack gap={4}>
            <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
              <Heading level={2}>
                {trackResult.type === 'order' ? 'Order Status' : 'Account Status'}
              </Heading>
              <OrderStatusPill status={trackResult.status} />
            </HStack>

            <OrderLifecycleStepper status={trackResult.status} />

            <Divider />

            <MetadataList columns="multi">
              <MetadataListItem label="Order Code">
                <CopyableId value={trackResult.orderId || trackResult.id} label="Order Code" />
              </MetadataListItem>
              <MetadataListItem label="Account ID">
                {trackResult.accountId ? (
                  <CopyableId value={trackResult.accountId} label="Account ID" />
                ) : (
                  <Text type="supporting">Pending activation</Text>
                )}
              </MetadataListItem>
              <MetadataListItem label="Service Type">
                <ServiceTypeToken type={trackResult.serviceType} />
              </MetadataListItem>
              <MetadataListItem label="City Code">
                <Text weight="semibold">City {trackResult.cityCode}</Text>
              </MetadataListItem>
            </MetadataList>
          </VStack>
        </Card>
      )}
    </VStack>
  );
}
