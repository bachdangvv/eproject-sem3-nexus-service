import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { Divider } from '@astryxdesign/core/Divider';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Section } from '@astryxdesign/core/Section';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Token, type TokenColor } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { CopyableId, formatUsd, OrderStatusPill } from '../components/StatusViews';
import { LandingTrackPage } from '../components/landing/LandingTrackPage';
import { formatValidityLabel, SPECIFICATION_PLANS } from '../data/tariffs';
import { getFaqCatalog } from '../services/customerQueriesApi';
import { getPublicPlans, trackAccount, trackOrder } from '../services/publicApi';
import { ApiError } from '../types/nexus';
import type { ConnectionType, FaqItemView, PlanView, PublicTrackView, ServicePlan } from '../types/nexus';

type TrackingQueryType = 'order' | 'account';
type TariffTabValue = ConnectionType | 'ALL';

interface TariffRow extends Record<string, unknown> {
  id: string;
  name: string;
  validityLabel: string;
  rentalUsd: number;
  summary: string;
}

const HERO_LINES: ReadonlyArray<string> = [
  'BROADBAND · LANDLINE · DIAL-UP',
  '11-CHAR ORDER TELEMETRY',
  'ZERO-PII LIVE PROVISIONING',
];

const STRIP_MARKS: ReadonlyArray<string> = [
  'Broadband $500',
  'Landline $250',
  'Dial-Up $325',
  'Deposit discounts 25%–100%',
  '12.24% Tax',
  'Nexus Core',
];

const WORKFLOW_LINES: ReadonlyArray<string> = [
  'RETAIL ORDER INTAKE',
  'TECHNICAL FEASIBILITY',
  'CONNECTION & ACTIVATION',
  'ACCOUNT BILLING & PAYMENT',
];

const WAIVER_LINES: ReadonlyArray<string> = [
  '10–14 LINES · 25% DEPOSIT DISCOUNT',
  '15–24 LINES · 50% DEPOSIT DISCOUNT',
  '25–50 LINES · 75% DEPOSIT DISCOUNT',
  '51+ LINES · 100% DEPOSIT WAIVER',
];

const DEPOSIT_SUMMARY: ReadonlyArray<{ amount: string; label: string }> = [
  { amount: '$500', label: 'Broadband deposit' },
  { amount: '$250', label: 'Landline deposit' },
  { amount: '$325', label: 'Dial-Up deposit' },
];

const ALL_PREVIEW_PLANS: ServicePlan[] = (['B', 'T', 'D'] as const).flatMap((type) =>
  SPECIFICATION_PLANS.filter((plan) => plan.type === type).slice(0, 2),
);

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

function formatLivePlanSummary(plan: PlanView): string {
  const desc = plan.description?.trim() ?? '';
  const details: string[] = [];

  if (plan.hoursAllowance != null && !desc.includes(String(plan.hoursAllowance))) {
    details.push(`${plan.hoursAllowance} hrs`);
  }
  if (plan.speedKbps != null && !desc.includes(String(plan.speedKbps))) {
    details.push(`${plan.speedKbps} Kbps`);
  }

  if (plan.type === 'T' && !desc) {
    const rateParts: string[] = [`Local ${formatUsd(plan.localCallRate ?? 0)}/min`];
    if ((plan.stdCallRate ?? 0) > 0) {
      rateParts.push(`STD ${formatUsd(plan.stdCallRate ?? 0)}/min`);
    }
    if ((plan.mobileMsgRate ?? 0) > 0) {
      rateParts.push(`Mobile Msg ${formatUsd(plan.mobileMsgRate ?? 0)}/min`);
    }
    details.push(...rateParts);
  }

  const combined = [desc, ...details].filter(Boolean).join(' · ');
  return combined || 'Active service plan';
}

function getFaqCategoryColor(category: string): TokenColor {
  switch (category) {
    case 'Billing':
      return 'blue';
    case 'Technical':
      return 'purple';
    case 'Plan':
      return 'teal';
    default:
      return 'gray';
  }
}

export function HomePage({
  initialMode = 'home',
}: {
  initialMode?: 'home' | 'track';
}): JSX.Element {
  const [trackType, setTrackType] = useState<TrackingQueryType>('order');
  const [trackQuery, setTrackQuery] = useState('');
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [trackResult, setTrackResult] = useState<PublicTrackView | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [tariffTab, setTariffTab] = useState<TariffTabValue>('B');
  const [livePlans, setLivePlans] = useState<PlanView[] | null>(null);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [plansFallback, setPlansFallback] = useState(false);
  const [faqItems, setFaqItems] = useState<FaqItemView[]>([]);
  const [faqCategory, setFaqCategory] = useState<string>('ALL');
  const [faqLoaded, setFaqLoaded] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (initialMode === 'track') {
      return () => {
        isMountedRef.current = false;
      };
    }
    getPublicPlans()
      .then((plans) => {
        if (!isMountedRef.current) return;
        setLivePlans(plans);
        setPlansFallback(false);
        setPlansLoaded(true);
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        setLivePlans(null);
        setPlansFallback(true);
        setPlansLoaded(true);
      });
    getFaqCatalog()
      .then((items) => {
        if (!isMountedRef.current) return;
        setFaqItems(items);
        setFaqLoaded(true);
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        setFaqItems([]);
        setFaqLoaded(true);
      });
    return () => {
      isMountedRef.current = false;
    };
  }, [initialMode]);

  const filteredFaqItems = useMemo(
    () =>
      faqCategory === 'ALL'
        ? faqItems
        : faqItems.filter((item) => item.category === faqCategory),
    [faqCategory, faqItems],
  );

  const scrollToTariffs = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.getElementById('tariffs-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

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

  const tariffRows: TariffRow[] = useMemo(() => {
    if (livePlans !== null) {
      const activePlans = livePlans.filter((plan) => plan.active);
      const filtered =
        tariffTab === 'ALL'
          ? activePlans
          : activePlans.filter((plan) => plan.type === tariffTab);
      return filtered.map((plan) => ({
        id: String(plan.id),
        name: plan.name,
        validityLabel: formatValidityLabel(plan.validityMonths),
        rentalUsd: plan.price,
        summary: formatLivePlanSummary(plan),
      }));
    }

    const source =
      tariffTab === 'ALL'
        ? ALL_PREVIEW_PLANS
        : SPECIFICATION_PLANS.filter((plan) => plan.type === tariffTab);
    return source.map((plan) => ({
      id: plan.id,
      name: plan.name,
      validityLabel: plan.validityLabel,
      rentalUsd: plan.rentalUsd,
      summary: plan.callRatesSummary || plan.description,
    }));
  }, [livePlans, tariffTab]);

  const tariffColumns: TableColumn<TariffRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Plan',
        width: proportional(3),
        renderCell: (item) => (
          <VStack gap={0.5}>
            <Text weight="medium">{item.name}</Text>
            <Text type="supporting" maxLines={1}>
              {item.summary}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'validityLabel',
        header: 'Cycle',
        width: pixel(104),
        renderCell: (item) => <Text type="supporting">{item.validityLabel}</Text>,
      },
      {
        key: 'rentalUsd',
        header: 'Rental',
        width: pixel(96),
        align: 'end',
        renderCell: (item) => (
          <Text weight="semibold" hasTabularNumbers>
            {formatUsd(item.rentalUsd)}
          </Text>
        ),
      },
    ],
    [],
  );

  if (initialMode === 'track') {
    return <LandingTrackPage />;
  }

  return (
    <VStack gap={10}>
      {/* Band 1: Asymmetric Hero + Monochrome Mark Strip */}
      <Section variant="transparent" paddingBlock={10} paddingInline={0}>
        <VStack gap={10}>
          <Section variant="transparent" paddingBlock={8} paddingInline={0}>
            <Grid columns={{ minWidth: 240, max: 3 }} gap={8} align="center">
              <VStack gap={5} hAlign="start">
                <Heading level={1} type="display-1">
                  Connected Infrastructure
                </Heading>
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <Button variant="primary" label="View Plans" onClick={scrollToTariffs} />
                </HStack>
              </VStack>

              <HStack hAlign="center" vAlign="center">
                <Text type="glyph" display="block" justify="center">
                  ▲
                </Text>
              </HStack>

              <VStack gap={1.5} hAlign="start">
                {HERO_LINES.map((line) => (
                  <Text key={line} type="eyebrow" display="block">
                    {line}
                  </Text>
                ))}
              </VStack>
            </Grid>
          </Section>

          <Section variant="transparent" paddingBlock={8} paddingInline={0}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={6}>
              {STRIP_MARKS.map((mark) => (
                <Text key={mark} type="wordmark">
                  {mark}
                </Text>
              ))}
            </HStack>
          </Section>
        </VStack>
      </Section>

      {/* Band 2: Order Telemetry Showcase (Left Window + Right Editorial) */}
      <Section variant="transparent" paddingBlock={10} paddingInline={0}>
        <VStack gap={8}>
          <Section variant="transparent" padding={0} maxWidth={560}>
            <Heading level={2} type="display-2">
              Track installations on a network built for clarity
            </Heading>
          </Section>

          <Grid columns={{ minWidth: 320, max: 2 }} gap={8} align="center">
            <Card padding={5}>
              <VStack gap={4}>
                <SegmentedControl
                  size="sm"
                  label="Lookup by"
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

                <Heading level={3}>Check installation status</Heading>

                <form onSubmit={handleTrackSubmit}>
                  <FormLayout>
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
                    <HStack gap={2} wrap="wrap" vAlign="center">
                      <Button
                        type="submit"
                        size="sm"
                        variant="primary"
                        label="Check Status"
                        isLoading={isLoadingTrack}
                        isDisabled={isLoadingTrack}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label="Sample: B0000000001"
                        onClick={() => {
                          setTrackType('order');
                          setTrackQuery('B0000000001');
                          setTrackError(null);
                        }}
                      />
                    </HStack>
                  </FormLayout>
                </form>

                {trackError && (
                  <Banner
                    status="warning"
                    container="section"
                    collapsible={false}
                    title="Status Not Found"
                    description={trackError}
                  />
                )}

                {trackResult && (
                  <VStack gap={2}>
                    <Divider />
                    <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
                      <CopyableId value={trackResult.orderId || trackResult.id} label="Order Code" />
                      <OrderStatusPill status={trackResult.status} />
                    </HStack>
                    <Text type="supporting">
                      City {trackResult.cityCode}
                      {trackResult.accountId ? ` · Account ${trackResult.accountId}` : ''}
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Card>

            <Section variant="transparent" paddingBlock={4} paddingInline={0}>
              <VStack gap={5} hAlign="start">
                <Section variant="transparent" padding={0} maxWidth={420}>
                  <Text type="large">
                    <Text type="inherit" weight="semibold">
                      Nexus Communication System
                    </Text>{' '}
                    connects retail shops, field feasibility engineers, and billing desks on one
                    deterministic lifecycle.
                  </Text>
                </Section>

                <VStack gap={1.5} hAlign="start">
                  <Text type="supporting">Workflow</Text>
                  {WORKFLOW_LINES.map((line) => (
                    <Text key={line} type="eyebrow" display="block">
                      {line}
                    </Text>
                  ))}
                </VStack>
              </VStack>
            </Section>
          </Grid>
        </VStack>
      </Section>

      {/* Band 3: Tariffs & Volume Scale (Left Editorial + Right Heading & Tariff Window) */}
      <Section id="tariffs-section" variant="transparent" paddingBlock={10} paddingInline={0}>
        <Grid columns={{ minWidth: 320, max: 2 }} gap={8} align="center">
          <VStack gap={5} hAlign="start">
            <Section variant="transparent" padding={0} maxWidth={420}>
              <Text type="large">
                <Text type="inherit" weight="semibold">
                  Refundable security deposit
                </Text>{' '}
                is $500 for Broadband, $250 for Landline, and $325 for Dial-Up — billed before
                12.24% statutory service tax.
              </Text>
            </Section>

            <VStack gap={1.5} hAlign="start">
              <Text type="supporting">Volume waivers</Text>
              {WAIVER_LINES.map((line) => (
                <Text key={line} type="eyebrow" display="block">
                  {line}
                </Text>
              ))}
            </VStack>
          </VStack>

          <VStack gap={6}>
            <Heading level={2} type="display-2">
              Deploy tariffs that scale from single lines to enterprise
            </Heading>

            <Card padding={5}>
              <VStack gap={4}>
                <SegmentedControl
                  size="sm"
                  label="Service category"
                  value={tariffTab}
                  onChange={(val) => setTariffTab(val as TariffTabValue)}
                >
                  <SegmentedControlItem value="B" label="Broadband" />
                  <SegmentedControlItem value="T" label="Landline" />
                  <SegmentedControlItem value="D" label="Dial-Up" />
                  <SegmentedControlItem value="ALL" label="All" />
                </SegmentedControl>

                {!plansLoaded ? (
                  <VStack gap={2} hAlign="center" padding={4}>
                    <Spinner size="sm" label="Loading service plans..." />
                    <Text type="supporting">Loading tariff catalog...</Text>
                  </VStack>
                ) : (
                  <>
                    <Table
                      aria-label="Nexus Service Plans and Tariffs"
                      density="compact"
                      idKey="id"
                      columns={tariffColumns}
                      data={tariffRows}
                    />
                    {plansFallback && (
                      <Text type="supporting">
                        Showing reference tariff catalog (live service catalog unavailable).
                      </Text>
                    )}
                  </>
                )}

                <Divider />

                <Grid columns={{ minWidth: 110, max: 3 }} gap={3}>
                  {DEPOSIT_SUMMARY.map((item) => (
                    <VStack key={item.label} gap={0.5}>
                      <Text weight="semibold" hasTabularNumbers>
                        {item.amount}
                      </Text>
                      <Text type="supporting">{item.label}</Text>
                    </VStack>
                  ))}
                </Grid>
              </VStack>
            </Card>
          </VStack>
        </Grid>
      </Section>

      {/* Band 4: Public Dynamic FAQ Catalog */}
      <Section id="faq-section" variant="transparent" paddingBlock={10} paddingInline={0}>
        <VStack gap={6}>
          <HStack hAlign="between" vAlign="end" wrap="wrap" gap={4}>
            <VStack gap={2}>
              <Text type="eyebrow">KNOWLEDGE BASE</Text>
              <Heading level={2} type="display-2">
                Frequently asked questions
              </Heading>
            </VStack>

            <SegmentedControl
              size="sm"
              label="FAQ category"
              value={faqCategory}
              onChange={setFaqCategory}
            >
              <SegmentedControlItem value="ALL" label="All" />
              <SegmentedControlItem value="Billing" label="Billing" />
              <SegmentedControlItem value="Technical" label="Technical" />
              <SegmentedControlItem value="Plan" label="Plan" />
              <SegmentedControlItem value="General" label="General" />
            </SegmentedControl>
          </HStack>

          <Card padding={5}>
            {filteredFaqItems.length > 0 ? (
              <CollapsibleGroup type="multiple" hasDividers>
                {filteredFaqItems.map((item) => (
                  <Collapsible
                    key={item.id}
                    value={String(item.id)}
                    trigger={
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Token
                          size="sm"
                          color={getFaqCategoryColor(item.category)}
                          label={item.category}
                        />
                        <Text weight="medium">{item.question}</Text>
                      </HStack>
                    }
                  >
                    <VStack gap={1.5}>
                      <Text type="supporting" weight="semibold">
                        {item.subject}
                      </Text>
                      <Text type="body">{item.answer}</Text>
                    </VStack>
                  </Collapsible>
                ))}
              </CollapsibleGroup>
            ) : (
              <Text type="supporting">
                {faqLoaded
                  ? faqItems.length === 0
                    ? 'Published customer FAQs will appear here when the Nexus service catalog is available.'
                    : 'No published FAQ entries match this category.'
                  : 'Loading frequently asked questions...'}
              </Text>
            )}
          </Card>
        </VStack>
      </Section>

      {/* Minimal Footer */}
      <Section variant="transparent" dividers={['top']} paddingBlock={5} paddingInline={0}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Text type="eyebrow">▲ NEXUS COMMUNICATION SYSTEM</Text>
          <Text type="eyebrow">BROADBAND · LANDLINE · DIAL-UP</Text>
        </HStack>
      </Section>
    </VStack>
  );
}
