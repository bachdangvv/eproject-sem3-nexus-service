import type { JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { Text } from '@astryxdesign/core/Text';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  BillingStatusPill,
  CopyableId,
  ServiceTypeToken,
  formatUsd,
} from '../../components/StatusViews';
import type { BillingView } from '../../types/nexus';
import { formatCityLabel, parseAccountIdMetadata } from './billingTypes';

export interface BillingAccountDrawerProps {
  record: BillingView | null;
  citiesByCode: Record<string, string>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  actionLoading?: boolean;
  error?: string | null;
  onDismissError?: () => void;
  onRefresh?: (accountId: string) => void;
  onCreateBill?: (accountId: string) => void;
  onRecordPayment?: (accountId: string) => void;
}

export function BillingAccountDrawer({
  record,
  citiesByCode,
  isOpen,
  onOpenChange,
  isLoading = false,
  actionLoading = false,
  error = null,
  onDismissError,
  onRefresh,
  onCreateBill,
  onRecordPayment,
}: BillingAccountDrawerProps): JSX.Element {
  const parsedMeta = record ? parseAccountIdMetadata(record.accountId) : null;
  const activeStep =
    record?.status === 'Paid' ? 2 : record?.status === 'Unpaid' ? 1 : 0;

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label={record ? `Account ${record.accountId}` : 'Billing Account Details'}
      width={540}
    >
      <Layout
        header={
          <DrawerHeader
            title={record ? `Account ${record.accountId}` : 'Billing Account Details'}
            subtitle={record ? `${record.customerName} - ${record.planName}` : undefined}
            endContent={record ? <BillingStatusPill status={record.status} /> : undefined}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            {isLoading && !record ? (
              <VStack gap={3} hAlign="center" padding={6}>
                <Spinner size="lg" label="Loading billing account..." />
                <Text type="supporting">Retrieving live billing account status...</Text>
              </VStack>
            ) : record ? (
              <VStack gap={5}>
                <ApiErrorBanner
                  title="Billing action failed"
                  error={error}
                  onDismiss={onDismissError}
                />

                <Card padding={4} variant="muted">
                  <Stepper
                    activeStep={activeStep}
                    density="compact"
                    label="Billing lifecycle progress"
                  >
                    <Step
                      step={0}
                      label="Connection Active"
                      description="16-char Account ID provisioned"
                    />
                    <Step
                      step={1}
                      label="Billing Record Created"
                      description="Plan price locked as Unpaid"
                    />
                    <Step
                      step={2}
                      label="Payment Recorded"
                      description="Full manual payment settled"
                    />
                  </Stepper>
                </Card>

                <MetadataList columns={2} title={<Heading level={4}>Billing Summary</Heading>}>
                  <MetadataListItem label="Account ID (16-char)">
                    <CopyableId value={record.accountId} label="Account ID" />
                  </MetadataListItem>
                  <MetadataListItem label="Order ID (11-char)">
                    <CopyableId value={record.orderId} label="Order ID" />
                  </MetadataListItem>
                  <MetadataListItem label="Customer Name">
                    {record.customerName}
                  </MetadataListItem>
                  <MetadataListItem label="Service Plan">
                    {record.planName}
                  </MetadataListItem>
                  <MetadataListItem label="Service Type">
                    {parsedMeta ? (
                      <ServiceTypeToken type={parsedMeta.serviceType} />
                    ) : (
                      <Text type="supporting">Unknown</Text>
                    )}
                  </MetadataListItem>
                  <MetadataListItem label="Territory City">
                    {formatCityLabel(parsedMeta?.cityCode, citiesByCode)}
                  </MetadataListItem>
                  <MetadataListItem label="Plan / Billed Amount">
                    <Text weight="semibold">{formatUsd(record.amount)}</Text>
                  </MetadataListItem>
                  <MetadataListItem label="Billing Status">
                    <BillingStatusPill status={record.status} />
                  </MetadataListItem>
                  <MetadataListItem label="Amount Due">
                    <Text weight="semibold">
                      {record.status === 'Paid' ? '$0.00' : formatUsd(record.amount)}
                    </Text>
                  </MetadataListItem>
                  <MetadataListItem label="Amount Paid">
                    <Text weight="semibold">
                      {record.status === 'Paid' ? formatUsd(record.amount) : '$0.00'}
                    </Text>
                  </MetadataListItem>
                  <MetadataListItem label="Paid At (UTC)">
                    {record.paidAt ? (
                      <Timestamp
                        value={record.paidAt}
                        format="date_time"
                        timezoneID="UTC"
                        isTimezoneShown
                      />
                    ) : (
                      <Text type="supporting">Not yet paid</Text>
                    )}
                  </MetadataListItem>
                </MetadataList>

                <Divider />

                {record.status === 'NotBilled' ? (
                  <Banner
                    status="info"
                    container="section"
                    collapsible={false}
                    title="Ready for Invoicing"
                    description="Create a billing record to lock the current plan price and transition this account to Unpaid."
                  />
                ) : record.status === 'Unpaid' ? (
                  <Banner
                    status="warning"
                    container="section"
                    collapsible={false}
                    title="Payment Pending"
                    description="A billing record exists. Record full manual payment once funds are collected."
                  />
                ) : (
                  <Banner
                    status="success"
                    container="section"
                    collapsible={false}
                    title="Payment Receipt Recorded"
                    description="Full manual payment has been settled and locked for this connection."
                  />
                )}
              </VStack>
            ) : (
              <VStack gap={4}>
                <ApiErrorBanner
                  title="Failed to load billing account"
                  error={error}
                  onDismiss={onDismissError}
                />
                <EmptyState
                  title="No account selected"
                  description="Look up or choose a connected account to inspect its billing details."
                  icon={<Icon icon="info" />}
                  isCompact
                />
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
              <HStack gap={2} wrap="wrap">
                {record && onRefresh ? (
                  <Button
                    variant="secondary"
                    label="Refresh Status"
                    isLoading={isLoading}
                    isDisabled={isLoading || actionLoading}
                    onClick={() => onRefresh(record.accountId)}
                  />
                ) : null}
              </HStack>
              <HStack gap={2} wrap="wrap">
                {record && record.status === 'NotBilled' && onCreateBill ? (
                  <Button
                    variant="primary"
                    label="Create Billing Record"
                    isLoading={actionLoading}
                    isDisabled={actionLoading || isLoading}
                    onClick={() => onCreateBill(record.accountId)}
                  />
                ) : null}
                {record && record.status === 'Unpaid' && onRecordPayment ? (
                  <Button
                    variant="primary"
                    label="Record Full Payment"
                    isLoading={actionLoading}
                    isDisabled={actionLoading || isLoading}
                    onClick={() => onRecordPayment(record.accountId)}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  label="Close"
                  onClick={() => onOpenChange(false)}
                />
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />
    </Drawer>
  );
}
