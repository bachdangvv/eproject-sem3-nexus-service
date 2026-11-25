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
import type { DepositView, UserRole } from '../../types/nexus';

type Action = 'Collection' | 'Refund' | 'Reconciliation' | 'Cancel';
const STATUS_LABELS: Record<string, string> = {
  Uncollected: 'Awaiting deposit', PartiallyCollected: 'Partially collected', Collected: 'Collected',
  Waived: 'Deposit waived', RefundPending: 'Refund pending', Refunded: 'Refunded',
  Closed: 'Closed with no held deposit', NeedsReconciliation: 'Legacy evidence needs reconciliation',
};

/** Order deposit receipts and disbursements. A retry keeps its operation ID until the payload changes. */
export function DepositsSection({ role, refreshTrigger = 0 }: { role: UserRole; refreshTrigger?: number }) {
  const [records, setRecords] = useState<DepositView[]>([]);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action>('Collection');
  const [amount, setAmount] = useState('');
  const [refunded, setRefunded] = useState('0');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const posting = useRef(false);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const sequence = useRef(0);
  const customer = role === 'Customer';
  const load = useCallback(async (q = '') => {
    const ticket = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DepositView[]>(customer ? '/customer/deposits' : `/deposits?q=${encodeURIComponent(q.trim())}`);
      if (ticket === sequence.current) setRecords(data);
    } catch (err) {
      if (ticket === sequence.current) setError(err instanceof Error ? err.message : 'Could not load deposits.');
    } finally { if (ticket === sequence.current) setLoading(false); }
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
    if ((role === 'Retail' || role === 'Billing') && !record.needsReconciliation &&
        record.orderStatus === 'Feasible' && !record.accountId && record.remainingToCollect > 0)
      result.push({ value: 'Collection', label: 'Record deposit receipt' });
    if (role === 'Billing' && record.refundableAmount > 0)
      result.push({ value: 'Refund', label: 'Record deposit refund' });
    if (role === 'Billing' && record.needsReconciliation)
      result.push({ value: 'Reconciliation', label: 'Reconcile legacy evidence' });
    if (role === 'Retail' && !record.accountId && record.orderStatus !== 'Cancelled')
      result.push({ value: 'Cancel', label: 'Cancel this order' });
    return result;
  }, [record, role]);
  const activeAction = actions.some(a => a.value === action) ? action : actions[0]?.value;

  const submit = async () => {
    if (!record || !activeAction || posting.current) return;
    const value = Number(amount);
    const returned = Number(refunded);
    if (!note.trim() || (activeAction !== 'Cancel' && (!reference.trim() || !amount.trim() ||
        !Number.isFinite(value) || value < 0 || (activeAction !== 'Reconciliation' && value === 0))) ||
        (activeAction === 'Reconciliation' && (!refunded.trim() || !Number.isFinite(returned) || returned < 0))) {
      setError('Enter the amount, evidence reference and reason. Refunds and receipts must be positive.');
      return;
    }
    const payload = activeAction === 'Cancel' ? { reason: note.trim() } : activeAction === 'Reconciliation'
      ? { collectedAmount: value, refundedAmount: returned, reference: reference.trim(), note: note.trim() }
      : { amount: value, method, reference: reference.trim(), note: note.trim() };
    const signature = JSON.stringify({ order: record.orderId, action: activeAction, payload });
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
    const suffix = activeAction === 'Collection' ? 'collections' : activeAction === 'Refund' ? 'refunds' : 'reconcile';
    posting.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(activeAction === 'Cancel' ? `/orders/${record.orderId}/cancel` : `/deposits/${record.orderId}/${suffix}`, {
        method: 'POST', body: JSON.stringify({ ...payload, operationId: operation.current.id }),
      });
      operation.current = null;
      setNotice(`${activeAction} recorded for ${record.orderId}.`);
      setAmount(''); setReference(''); setNote('');
      await load(query);
    } catch (err) { setError(err instanceof Error ? err.message : 'The transaction was not confirmed. Retry with the same details.'); }
    finally { posting.current = false; setBusy(false); }
  };

  return <Card padding={4}>
    <VStack gap={4}>
      <Heading level={2}>Security Deposits</Heading>
      <Text type="supporting">Deposit receipts and refunds are separate from service invoices. Activation requires the full deposit or a waiver. Outstanding service debts remain separate.</Text>
      <ApiErrorBanner title="Deposit operation" error={error} onDismiss={() => setError(null)} />
      {notice && <Text>{notice}</Text>}
      {!customer && <HStack gap={2} vAlign="end">
        <TextInput label="Find by Order ID, customer name or phone" value={query} onChange={setQuery} />
        <Button label="Find deposits" isLoading={loading} isDisabled={busy || loading} onClick={() => void load(query)} />
      </HStack>}
      {loading && <Text>Loading deposit records…</Text>}
      {!loading && records.length === 0 && <Text>No matching deposit records.</Text>}
      <Selector label="Order deposit" value={record?.orderId ?? ''} options={records.map(r => ({
        value: r.orderId, label: `${r.orderId} · ${r.customerName}`,
        description: `${r.orderStatus} · ${STATUS_LABELS[r.status] ?? r.status}`,
      }))} onChange={value => { setSelected(value); setAmount(''); setReference(''); setNote(''); setNotice(null); }} />
      {record && <>
        <Text weight="semibold">{STATUS_LABELS[record.status] ?? record.status}</Text>
        {record.needsReconciliation && <Text>Receipt allocation is unresolved. Collection, activation and refund are blocked until Billing records evidence-backed totals. A quote or unpaid invoice is not proof of deposit payment.</Text>}
        <MetadataList columns={3}>
          <MetadataListItem label="Account">{record.accountId ?? 'Not activated'}</MetadataListItem>
          <MetadataListItem label="Gross deposit">{formatUsd(record.grossAmount)}</MetadataListItem>
          <MetadataListItem label={`Deposit discount (${record.discountPercent}%)`}>{formatUsd(record.grossAmount - record.requiredAmount)}</MetadataListItem>
          <MetadataListItem label="Required deposit">{formatUsd(record.requiredAmount)}</MetadataListItem>
          <MetadataListItem label="Verified collected">{formatUsd(record.collectedAmount)}</MetadataListItem>
          <MetadataListItem label="Already refunded">{formatUsd(record.refundedAmount)}</MetadataListItem>
          <MetadataListItem label="Held balance">{formatUsd(record.balance)}</MetadataListItem>
          <MetadataListItem label="Remaining to collect">{formatUsd(record.remainingToCollect)}</MetadataListItem>
          <MetadataListItem label="Refundable now">{formatUsd(record.refundableAmount)}</MetadataListItem>
        </MetadataList>
        {customer && <Text>To cancel or withdraw service, send a support query with your Order ID. Retail or Technical records the closure and Billing confirms the refund.</Text>}
        {actions.length > 0 && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
          <VStack gap={3}>
            <Selector label="Deposit action" value={activeAction ?? ''} options={actions} onChange={v => setAction(v as Action)} />
            {activeAction !== 'Cancel' && <>
              <TextInput label={activeAction === 'Reconciliation' ? 'Total previously collected, supported by evidence' : 'Amount USD'} value={amount} onChange={setAmount} />
              {activeAction === 'Reconciliation' ? <>
                <TextInput label="Total previously refunded, supported by evidence" value={refunded} onChange={setRefunded} />
                <Text>Reconciliation records historical totals only. It does not receive or send money again.</Text>
              </> : <Selector label="Payment method" value={method} options={[
                { value: 'Cash', label: 'Cash' }, { value: 'BankTransfer', label: 'Bank transfer' }, { value: 'Cheque', label: 'Cheque' },
              ]} onChange={setMethod} />}
              <TextInput label="Receipt or evidence reference" value={reference} onChange={setReference} />
            </>}
            <TextInput label={activeAction === 'Cancel' ? 'Cancellation reason' : 'Reason or evidence details'} value={note} onChange={setNote} />
            <Button type="submit" label={actions.find(a => a.value === activeAction)?.label ?? 'Record'} isLoading={busy} isDisabled={busy || loading} />
          </VStack>
        </form>}
        <Heading level={3}>Deposit history</Heading>
        {record.transactions.length === 0 && <Text>No verified transactions.</Text>}
        {record.transactions.map(t => <Card key={t.id} variant="muted" padding={3}>
          <VStack gap={1}>
            <Text weight="semibold">{t.kind} · {formatUsd(t.amount)} · {t.reference}</Text>
            <Text>{t.method} · {t.actor ?? 'Historical evidence'}{t.retailShopId ? ` · Retail shop #${t.retailShopId}` : ''} · {new Date(t.at).toLocaleString()}</Text>
            <Text>{t.note}</Text>
            <Text type="supporting">Verified totals after record: collected {formatUsd(t.collectedAfter)}, refunded {formatUsd(t.refundedAfter)}{t.sourceInvoiceId ? ` · Legacy invoice ${t.sourceInvoiceId}` : ''}</Text>
          </VStack>
        </Card>)}
      </>}
    </VStack>
  </Card>;
}
