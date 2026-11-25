import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner, formatUsd } from '../../components/StatusViews';
import { apiRequest } from '../../services/apiClient';
import type { AdvanceView, UserRole } from '../../types/nexus';

type Action = 'Collection' | 'Allocation' | 'Refund';
const STATUS_LABELS: Record<string, string> = {
  NotConfigured: 'Advance policy not configured', NotRequired: 'No advance requested', Waived: 'Advance waived',
  Uncollected: 'Optional advance quoted', PartiallyCollected: 'Partially received', Available: 'Credit available',
  FullyAllocated: 'Advance fully used', RefundPending: 'Unused advance refundable', Refunded: 'Unused advance refunded',
  Closed: 'Closed with no unused advance',
};

/** Advance cash and invoice allocation share a retry identity; quotes and waivers are never credit. */
export function AdvancesSection({ role, refreshTrigger = 0, onChanged }: {
  role: UserRole; refreshTrigger?: number; onChanged?: () => void;
}) {
  const [records, setRecords] = useState<AdvanceView[]>([]);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action>('Collection');
  const [amount, setAmount] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const posting = useRef(false);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const sequence = useRef(0);
  const customer = role === 'Customer';
  const load = useCallback(async (q = '') => {
    const ticket = ++sequence.current;
    setLoading(true); setError(null);
    try {
      const data = await apiRequest<AdvanceView[]>(customer ? '/customer/advances' : `/advances?q=${encodeURIComponent(q.trim())}`);
      if (ticket === sequence.current) setRecords(data);
    } catch (err) { if (ticket === sequence.current) setError(err instanceof Error ? err.message : 'Could not load advances.'); }
    finally { if (ticket === sequence.current) setLoading(false); }
  }, [customer]);
  const cancelLoad = useCallback(() => { sequence.current++; }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; cancelLoad(); };
  }, [load, refreshTrigger, cancelLoad]);
  const record = records.find(r => r.orderId === selected);
  const actions = useMemo(() => {
    if (!record) return [];
    const result: Array<{ value: Action; label: string }> = [];
    const closed = record.orderStatus === 'Cancelled' || record.orderStatus === 'NotFeasible' || record.connectionStatus === 'PermanentlyInactive';
    if ((role === 'Retail' || role === 'Billing') && record.perConnectionAmount != null && !closed &&
        (record.orderStatus === 'Feasible' || record.orderStatus === 'Connected') && record.remainingToCollect > 0)
      result.push({ value: 'Collection', label: 'Record advance receipt' });
    if (role === 'Billing' && record.availableAmount > 0 && record.openInvoices.length > 0)
      result.push({ value: 'Allocation', label: 'Apply advance to invoice' });
    if (role === 'Billing' && record.refundableAmount > 0)
      result.push({ value: 'Refund', label: 'Record unused advance refund' });
    return result;
  }, [record, role]);
  const activeAction = actions.some(a => a.value === action) ? action : actions[0]?.value;

  const submit = async () => {
    if (!record || !activeAction || posting.current) return;
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0 || !reference.trim() || !note.trim() ||
        (activeAction === 'Allocation' && !record.openInvoices.some(i => String(i.id) === invoiceId))) {
      setError('Enter a positive amount, receipt reference, reason and an open invoice for allocation.');
      return;
    }
    const payload = { amount: value, reference: reference.trim(), note: note.trim(),
      ...(activeAction === 'Allocation' ? { invoiceId: Number(invoiceId) } : { method }) };
    const signature = JSON.stringify({ order: record.orderId, action: activeAction, payload });
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
    const suffix = activeAction === 'Collection' ? 'collections' : activeAction === 'Allocation' ? 'allocations' : 'refunds';
    posting.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      await apiRequest(`/advances/${record.orderId}/${suffix}`, {
        method: 'POST', body: JSON.stringify({ ...payload, operationId: operation.current.id }),
      });
      operation.current = null;
      setNotice(`${activeAction} recorded for ${record.orderId}.`);
      setAmount(''); setReference(''); setNote('');
      await load(query);
      onChanged?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Transaction not confirmed. Retry with the same details.'); }
    finally { posting.current = false; setBusy(false); }
  };

  return <Card padding={4}>
    <VStack gap={4}>
      <Heading level={2}>Advance Payments</Heading>
      <Text type="supporting">Optional prepayments are separate from security deposits. Only actual receipts create credit. Billing applies credit to an issued invoice without changing its charges or tax.</Text>
      <ApiErrorBanner title="Advance operation" error={error} onDismiss={() => setError(null)} />
      {notice && <Text>{notice}</Text>}
      {!customer && <HStack gap={2} vAlign="end">
        <TextInput label="Find advance by Order, Account, customer or phone" value={query} onChange={setQuery} />
        <Button label="Find advances" isLoading={loading} isDisabled={busy || loading} onClick={() => void load(query)} />
      </HStack>}
      {loading && <Text>Loading advance records…</Text>}
      {!loading && records.length === 0 && <Text>No matching advance records.</Text>}
      <Selector label="Order advance" isDisabled={busy} value={record?.orderId ?? ''} options={records.map(r => ({
        value: r.orderId, label: `${r.orderId} · ${r.customerName}`,
        description: `${STATUS_LABELS[r.status] ?? r.status} · ${formatUsd(r.availableAmount)} available`,
      }))} onChange={value => { setSelected(value); setInvoiceId(''); setAmount(''); setReference(''); setNote(''); setNotice(null); }} />
      {record && <>
        <Text weight="semibold">{STATUS_LABELS[record.status] ?? record.status}</Text>
        {record.perConnectionAmount == null && <Text>No advance policy was recorded for this Order. Existing payments and deposits are not converted into advance credit. Admin configuration applies to future confirmed Orders.</Text>}
        <MetadataList columns={3}>
          <MetadataListItem label="Account">{record.accountId ?? 'Not activated'}</MetadataListItem>
          <MetadataListItem label="Advance per line at confirmation">{record.perConnectionAmount == null ? 'Not configured' : formatUsd(record.perConnectionAmount)}</MetadataListItem>
          <MetadataListItem label="Gross advance quote">{formatUsd(record.grossAmount)}</MetadataListItem>
          <MetadataListItem label={`Bulk waiver (${record.discountPercent}%)`}>{formatUsd(record.grossAmount - record.quotedAmount)}</MetadataListItem>
          <MetadataListItem label="Optional advance quote">{formatUsd(record.quotedAmount)}</MetadataListItem>
          <MetadataListItem label="Actually received">{formatUsd(record.receivedAmount)}</MetadataListItem>
          <MetadataListItem label="Applied to invoices">{formatUsd(record.allocatedAmount)}</MetadataListItem>
          <MetadataListItem label="Already refunded">{formatUsd(record.refundedAmount)}</MetadataListItem>
          <MetadataListItem label="Unused credit">{formatUsd(record.availableAmount)}</MetadataListItem>
        </MetadataList>
        {actions.length > 0 && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
          <VStack gap={3}>
            <Selector label="Advance action" isDisabled={busy} value={activeAction ?? ''} options={actions} onChange={v => setAction(v as Action)} />
            {activeAction === 'Allocation' && <Selector label="Invoice to settle with advance" value={invoiceId} isDisabled={busy}
              options={record.openInvoices.map(i => ({ value: String(i.id), label: `${i.number} · ${formatUsd(i.dueAmount)} due` }))} onChange={setInvoiceId} />}
            <TextInput label="Advance amount USD" value={amount} onChange={setAmount} isDisabled={busy} />
            {activeAction !== 'Allocation' && <Selector label="Advance payment method" value={method} isDisabled={busy}
              options={[{ value: 'Cash', label: 'Cash' }, { value: 'BankTransfer', label: 'Bank transfer' }, { value: 'Cheque', label: 'Cheque' }]} onChange={setMethod} />}
            <TextInput label="Advance receipt or allocation reference" value={reference} onChange={setReference} isDisabled={busy} />
            <TextInput label="Advance reason" value={note} onChange={setNote} isDisabled={busy} />
            <Button type="submit" label={actions.find(a => a.value === activeAction)?.label ?? 'Record advance'} isLoading={busy} isDisabled={busy || loading} />
          </VStack>
        </form>}
        {record.refundableAmount > 0 && <Text>Unused advance refundable: {formatUsd(record.refundableAmount)}. Any invoice settlement is an explicit Billing allocation, separate from this refund.</Text>}
        <Heading level={3}>Advance history</Heading>
        {record.transactions.length === 0 && <Text>No advance money has been recorded.</Text>}
        {record.transactions.map(t => <Card key={t.id} variant="muted" padding={3}>
          <VStack gap={1}>
            <Text weight="semibold">{t.kind} · {formatUsd(t.amount)} · {t.reference}</Text>
            <Text>{t.method} · {t.actor}{t.retailShopId ? ` · Retail shop #${t.retailShopId}` : ''} · {new Date(t.at).toLocaleString()}</Text>
            <Text>{t.note}</Text>
            <Text type="supporting">Unused credit after record: {formatUsd(t.availableAfter)}{t.invoiceId ? ` · Invoice #${t.invoiceId} · Payment #${t.paymentId}` : ''}</Text>
          </VStack>
        </Card>)}
      </>}
    </VStack>
  </Card>;
}
