import { useMemo, useState } from 'react';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Banner } from '@astryxdesign/core/Banner';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Selector } from '@astryxdesign/core/Selector';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { VStack } from '@astryxdesign/core/VStack';
import { formatUsd } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import type { BillingView, PaymentItemView } from '../../types/nexus';

type PaymentRow = PaymentItemView & Record<string, unknown>;
const channelLabel = (channel: string) => ({
  CityOffice: 'City Office', RetailOutlet: 'Retail Outlet', CustomerPortal: 'Customer Portal', Advance: 'Advance Credit',
}[channel] ?? channel);

/** Read persisted account payments across every billing period. Never turn invoice totals into synthetic receipts. */
export function PaymentHistory({ record }: { record: BillingView }) {
  const [invoice, setInvoice] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  const [search, setSearch] = useState('');
  const payments = useMemo(() => record.payments ?? [], [record.payments]);
  const rows = useMemo(() => payments.filter(p =>
    (invoice === 'ALL' || String(p.invoiceId) === invoice) &&
    (channel === 'ALL' || p.channel === channel) &&
    [p.receiptCode, p.invoiceNumber, p.note, p.paidByUsername, p.paidByDisplayName, p.retailShopName]
      .some(value => value?.toLowerCase().includes(search.trim().toLowerCase()))
  ) as PaymentRow[], [payments, invoice, channel, search]);
  const pagination = useClientPagination(rows, { resetKey: `${record.accountId}|${invoice}|${channel}|${search}` });
  const total = (list: PaymentItemView[]) => list.reduce((sum, p) => sum + p.amount, 0);
  const selectedInvoice = record.invoices?.find(i => String(i.id) === invoice);
  const columns: TableColumn<PaymentRow>[] = [
    { key: 'receiptCode', header: 'Payment / Invoice / Date', width: proportional(1.5), renderCell: p => <VStack gap={1}>
      <Text weight="semibold">{p.receiptCode}</Text>
      <Text type="supporting">{p.invoiceNumber}</Text>
      <Text type="supporting">{p.invoiceStatus === 'RolledOver' ? 'Rolled over' : p.invoiceStatus}</Text>
      <Timestamp value={p.paidAt} format="date_time" timezoneID="UTC" isTimezoneShown />
    </VStack> },
    { key: 'amount', header: 'Amount', width: pixel(95), renderCell: p => <Text weight="semibold">{formatUsd(p.amount)}</Text> },
    { key: 'details', header: 'Channel / Recorder / Reference', width: proportional(2), renderCell: p => <VStack gap={1}>
      <Text weight="semibold">{channelLabel(p.channel)}</Text>
      <Text>{p.paidByDisplayName || p.paidByUsername || 'Not recorded'}</Text>
      {p.paidByDisplayName && p.paidByUsername && <Text type="supporting">{p.paidByUsername}</Text>}
      <Text type="supporting">{p.retailShopName || (p.retailShopId ? `Outlet #${p.retailShopId}` : 'No outlet recorded')}</Text>
      <Text type="supporting">{p.note || 'Reference / note not recorded'}</Text>
    </VStack> },
  ];

  return <VStack gap={3}>
    <Heading level={4}>Payment History</Heading>
    <Text type="supporting">All billing periods for {record.accountId}, including payments on paid and rolled-over invoices. Security deposit and advance cash receipts/refunds are in their separate ledgers. Advance Credit here is the amount applied to a bill.</Text>
    {!!record.paymentHistoryGaps?.length && <Banner status="warning" container="section" collapsible={false}
      title="Payment records need reconciliation" description="Some invoices have a paid amount that differs from their saved payment records. The totals below include saved transactions only. Verify original receipts; no missing payment has been assumed." />}
    {record.paymentHistoryGaps?.map(g => <Text key={g.invoiceId} type="supporting">{g.invoiceNumber}: invoice paid {formatUsd(g.recordedPaidAmount)}, saved payments {formatUsd(g.recordedPaymentTotal)}.</Text>)}
    <MetadataList columns={3}>
      <MetadataListItem label="Service payments to date">{formatUsd(total(payments))}</MetadataListItem>
      <MetadataListItem label="Direct payments to date">{formatUsd(total(payments.filter(p => p.channel !== 'Advance')))}</MetadataListItem>
      <MetadataListItem label="Advance applied to date">{formatUsd(total(payments.filter(p => p.channel === 'Advance')))}</MetadataListItem>
    </MetadataList>
    <HStack gap={2} wrap="wrap">
      <Selector label="Invoice payments" value={invoice} onChange={value => { pagination.setPage(1); setInvoice(value); }} options={[
        { value: 'ALL', label: 'All billing periods' },
        ...(record.invoices ?? []).map(i => ({ value: String(i.id), label: i.invoiceNumber })),
      ]} />
      <Selector label="Payment channel" value={channel} onChange={value => { pagination.setPage(1); setChannel(value); }} options={[
        { value: 'ALL', label: 'All channels' },
        ...Array.from(new Set(payments.map(p => p.channel))).sort().map(c => ({ value: c, label: channelLabel(c) })),
      ]} />
    </HStack>
    <TextInput label="Find payment by receipt, invoice, recorder, outlet or note" value={search} onChange={value => { pagination.setPage(1); setSearch(value); }} />
    {selectedInvoice && <Text>Selected invoice: paid {formatUsd(selectedInvoice.paidAmount)} · due {formatUsd(selectedInvoice.dueAmount)} · {selectedInvoice.status}. A rolled-over invoice carries its unpaid debt into the next bill; its original payments remain here.</Text>}
    <Text>{rows.length} matching payments · {formatUsd(total(rows))} recorded in this selection</Text>
    <Text type="supporting">PAY codes identify saved transactions inside Nexus. They do not verify an external bank or payment gateway receipt. Missing historical details are shown as not recorded.</Text>
    <Table<PaymentRow> aria-label="All-period payment history" columns={columns} data={pagination.paginatedItems}
      idKey="id" rowIndexStart={pagination.rowIndexStart} rowCount={pagination.totalItems}
      emptyState={<EmptyState title="No matching payments" description="Only saved payment transactions appear here. Clear filters to see other billing periods." icon={<Icon icon="info" />} isCompact />} />
    <TablePaginationFooter page={pagination.page} pageSize={pagination.pageSize} totalItems={pagination.totalItems}
      onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="All-period payment history pagination" />
  </VStack>;
}
