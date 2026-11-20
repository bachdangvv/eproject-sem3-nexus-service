/* oxlint-disable react/only-export-components */
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Code } from '@astryxdesign/core/Code';
import { Divider } from '@astryxdesign/core/Divider';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Section } from '@astryxdesign/core/Section';
import { Spinner } from '@astryxdesign/core/Spinner';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { Text } from '@astryxdesign/core/Text';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import type {
  BillingStatus,
  CustomerStatus,
  OrderDetailView,
  OrderStatus,
  PublicServiceType,
  ServiceTypeCode,
} from '../types/nexus';

const SERVICE_TYPE_SHORT: Record<ServiceTypeCode, string> = {
  D: 'Dial-Up (D)',
  B: 'Broadband (B)',
  T: 'Landline (T)',
};

const SERVICE_TYPE_LABEL: Record<ServiceTypeCode, string> = {
  D: 'Dial-Up Connection',
  B: 'Broadband Connection',
  T: 'Landline Connection',
};

const PUBLIC_SERVICE_LABEL: Record<PublicServiceType, string> = {
  DIAL_UP: 'Dial-Up',
  BROADBAND: 'Broadband',
  LANDLINE: 'Landline',
};

export function formatUsd(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `$${rounded.toFixed(2)}`;
}

export function CopyableId({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const toast = useToast();
  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    toast({ body: `Copied ${label || 'ID'}: ${value}` });
  };
  return (
    <HStack gap={1} vAlign="center" wrap="nowrap">
      <Code>{value}</Code>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        label={`Copy ${label || value}`}
        icon={<Icon icon="copy" />}
        onClick={handleCopy}
      />
    </HStack>
  );
}

export function ServiceTypeToken({
  type,
}: {
  type: ServiceTypeCode | PublicServiceType;
}) {
  if (type === 'D' || type === 'DIAL_UP') {
    return (
      <Token
        size="sm"
        color="purple"
        label={type === 'D' ? SERVICE_TYPE_SHORT.D : PUBLIC_SERVICE_LABEL.DIAL_UP}
      />
    );
  }
  if (type === 'B' || type === 'BROADBAND') {
    return (
      <Token
        size="sm"
        color="blue"
        label={type === 'B' ? SERVICE_TYPE_SHORT.B : PUBLIC_SERVICE_LABEL.BROADBAND}
      />
    );
  }
  return (
    <Token
      size="sm"
      color="teal"
      label={type === 'T' ? SERVICE_TYPE_SHORT.T : PUBLIC_SERVICE_LABEL.LANDLINE}
    />
  );
}

export function StatusLabel({
  variant,
  label,
}: {
  variant: 'success' | 'warning' | 'error' | 'accent' | 'neutral';
  label: string;
}) {
  return (
    <HStack gap={1.5} vAlign="center" wrap="nowrap">
      <StatusDot variant={variant} label={label} />
      <Text type="body" textWrap="nowrap">
        {label}
      </Text>
    </HStack>
  );
}

export function OrderStatusPill({ status }: { status: OrderStatus | string }) {
  switch (status) {
    case 'Pending':
      return <StatusLabel variant="warning" label="Pending" />;
    case 'Feasible':
      return <StatusLabel variant="accent" label="Feasible" />;
    case 'NotFeasible':
      return <StatusLabel variant="error" label="Not Feasible" />;
    case 'Connected':
      return <StatusLabel variant="success" label="Connected" />;
    case 'ACTIVE':
      return <StatusLabel variant="success" label="ACTIVE" />;
    default:
      return <StatusLabel variant="neutral" label={status} />;
  }
}

export function BillingStatusPill({ status }: { status: BillingStatus }) {
  switch (status) {
    case 'Paid':
      return <StatusLabel variant="success" label="Paid" />;
    case 'PartiallyPaid':
      return <StatusLabel variant="warning" label="Partially Paid" />;
    case 'Unpaid':
      return <StatusLabel variant="error" label="Unpaid" />;
    case 'NotBilled':
      return <StatusLabel variant="neutral" label="Not Billed" />;
  }
}

export function CustomerStatusPill({
  status,
}: {
  status: CustomerStatus | string;
}) {
  if (status === 'ACTIVE') {
    return <StatusLabel variant="success" label="ACTIVE" />;
  }
  if (status === 'SUSPENDED') {
    return <StatusLabel variant="error" label="SUSPENDED" />;
  }
  return <StatusLabel variant="neutral" label={status} />;
}

export function OrderLifecycleStepper({ status }: { status: OrderStatus | string }) {
  const activeStep =
    status === 'Pending'
      ? 0
      : status === 'Feasible' || status === 'NotFeasible'
        ? 1
        : 2;

  return (
    <Stepper activeStep={activeStep} density="compact" label="Order workflow progress">
      <Step step={0} label="Order Placed" description="11-char Order ID assigned" />
      <Step
        step={1}
        label={status === 'NotFeasible' ? 'Not Feasible' : 'Feasibility Check'}
        status={status === 'NotFeasible' ? 'error' : undefined}
        description="Distance & server check"
      />
      <Step step={2} label="Connected" description="16-char Account ID active" />
    </Stepper>
  );
}

export function OrderDetailDrawer({
  detail,
  isOpen,
  onOpenChange,
  isLoading = false,
  error = null,
}: {
  detail: OrderDetailView | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  const order = detail?.order ?? null;
  const req = order?.request ?? null;

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label={order ? `Order ${order.code}` : 'Order Details'}
      width={540}
    >
      <Layout
        header={
          <DrawerHeader
            title={order ? `Order ${order.code}` : 'Order Details'}
            subtitle={req ? SERVICE_TYPE_LABEL[req.type] : undefined}
            endContent={order ? <OrderStatusPill status={order.status} /> : undefined}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            {isLoading ? (
              <VStack gap={3} hAlign="center" padding={6}>
                <Spinner size="lg" label="Loading order details..." />
                <Text type="supporting">Loading order history and feedback...</Text>
              </VStack>
            ) : error ? (
              <ApiErrorBanner title="Failed to load order details" error={error} />
            ) : detail && order && req ? (
              <VStack gap={5}>
                <Card padding={4} variant="muted">
                  <OrderLifecycleStepper status={order.status} />
                </Card>

                <MetadataList columns={2} title={<Heading level={4}>Order Summary</Heading>}>
                  <MetadataListItem label="Order ID (11-char)">
                    <CopyableId value={order.code} label="Order ID" />
                  </MetadataListItem>
                  <MetadataListItem label="Account ID (16-char)">
                    {order.accountId ? (
                      <CopyableId value={order.accountId} label="Account ID" />
                    ) : (
                      <Text type="supporting">Pending activation</Text>
                    )}
                  </MetadataListItem>
                  <MetadataListItem label="Customer">{req.customerName}</MetadataListItem>
                  <MetadataListItem label="Service Plan">
                    {req.planName} ({formatUsd(req.price)})
                  </MetadataListItem>
                  <MetadataListItem label="City Territory">City {req.cityCode}</MetadataListItem>
                  <MetadataListItem label="Request ID">#{order.requestId}</MetadataListItem>
                  <MetadataListItem label="Installation Address">{req.address}</MetadataListItem>
                  <MetadataListItem label="Existing Nexus Landline">
                    {req.hasNexusLandline ? 'Yes' : 'No'}
                  </MetadataListItem>
                  <MetadataListItem label="Order Created">
                    <Timestamp value={order.createdAt} format="date_time" />
                  </MetadataListItem>
                  <MetadataListItem label="Activated At">
                    {order.activatedAt ? (
                      <Timestamp value={order.activatedAt} format="date_time" />
                    ) : (
                      <Text type="supporting">Not yet connected</Text>
                    )}
                  </MetadataListItem>
                </MetadataList>

                <Divider />

                <VStack gap={3}>
                  <Heading level={4}>Technical & Status History</Heading>
                  {detail.history.length > 0 ? (
                    <List density="compact" hasDividers>
                      {detail.history.map((evt, index) => (
                        <ListItem
                          key={`${evt.at}-${evt.status}-${index}`}
                          label={evt.status === 'NotFeasible' ? 'Not Feasible' : evt.status}
                          description={
                            <VStack gap={1}>
                              <Text type="supporting">{evt.note || 'Status recorded'}</Text>
                              {(evt.distanceOk != null ||
                                evt.serverAvailable != null ||
                                evt.landlineFeasible != null) && (
                                <HStack gap={1.5} wrap="wrap">
                                  {evt.distanceOk != null && (
                                    <Token
                                      size="sm"
                                      color={evt.distanceOk ? 'green' : 'red'}
                                      label={evt.distanceOk ? 'Distance: OK' : 'Distance: Failed'}
                                    />
                                  )}
                                  {evt.serverAvailable != null && (
                                    <Token
                                      size="sm"
                                      color={evt.serverAvailable ? 'green' : 'red'}
                                      label={
                                        evt.serverAvailable
                                          ? 'Server: Available'
                                          : 'Server: Unavailable'
                                      }
                                    />
                                  )}
                                  {evt.landlineFeasible != null && (
                                    <Token
                                      size="sm"
                                      color={evt.landlineFeasible ? 'green' : 'red'}
                                      label={
                                        evt.landlineFeasible
                                          ? 'Landline: Feasible'
                                          : 'Landline: Not Feasible'
                                      }
                                    />
                                  )}
                                </HStack>
                              )}
                              <Text type="supporting">
                                By {evt.actor} · <Timestamp value={evt.at} format="date_time" />
                              </Text>
                            </VStack>
                          }
                          startContent={<OrderStatusPill status={evt.status} />}
                        />
                      ))}
                    </List>
                  ) : (
                    <EmptyState
                      title="No status events recorded"
                      description="Timeline entries will appear as the order progresses."
                      icon={<Icon icon="info" />}
                      isCompact
                    />
                  )}
                </VStack>

                {detail.feedback.length > 0 && (
                  <>
                    <Divider />
                    <VStack gap={3}>
                      <Heading level={4}>Customer Feedback</Heading>
                      {detail.feedback.map((fb, index) => (
                        <Section key={`${fb.createdAt}-${index}`} variant="muted" padding={4}>
                          <VStack gap={2}>
                            <HStack hAlign="between" vAlign="center">
                              <Token color="green" label={`${fb.rating} / 5 Rating`} />
                              <Text type="supporting">
                                <Timestamp value={fb.createdAt} format="date_time" />
                              </Text>
                            </HStack>
                            <Text type="body">{fb.comment}</Text>
                          </VStack>
                        </Section>
                      ))}
                    </VStack>
                  </>
                )}
              </VStack>
            ) : (
              <EmptyState
                title="No order selected"
                description="Choose an order from the list to inspect its details."
                icon={<Icon icon="info" />}
                isCompact
              />
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="end">
              <Button label="Close" variant="secondary" onClick={() => onOpenChange(false)} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Drawer>
  );
}

export function ApiErrorBanner({
  error,
  title = 'Request could not be completed',
  onDismiss,
}: {
  error: string | null | undefined;
  title?: string;
  onDismiss?: () => void;
}) {
  if (!error) return null;
  return (
    <Banner
      status="error"
      container="card"
      collapsible={false}
      title={title}
      description={error}
      isDismissable={Boolean(onDismiss)}
      onDismiss={onDismiss}
    />
  );
}

export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <Banner
      status="warning"
      container="section"
      collapsible={false}
      title="Backend API Unreachable"
      description="Could not reach the Nexus API server on http://127.0.0.1:5168. Start the backend server and retry."
      endContent={
        onRetry ? (
          <Button size="sm" variant="secondary" label="Retry Connection" onClick={onRetry} />
        ) : undefined
      }
    />
  );
}
