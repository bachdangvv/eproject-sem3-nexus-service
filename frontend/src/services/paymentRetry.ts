export interface PaymentPayload {
  amount?: number | null;
  note?: string | null;
  invoiceId?: number | null;
  operationId?: string;
}

const pending = new Map<string, string>();

/** Keep the same receipt identity after an uncertain response, including a tab reload. */
export async function withPaymentOperation<T>(
  scope: string,
  input: PaymentPayload | undefined,
  post: (body: PaymentPayload & { operationId: string }) => Promise<T>,
): Promise<T> {
  const body = {
    invoiceId: input?.invoiceId ?? null,
    amount: input?.amount ?? null,
    note: input?.note?.trim() || null,
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([scope, body])));
  const key = `nexus.payment.${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
  let storage: Storage | undefined;
  try { storage = globalThis.sessionStorage; } catch { /* Memory fallback if browser storage is unavailable. */ }
  let stored: string | null = null;
  try { stored = storage?.getItem(key) ?? null; } catch { /* Memory fallback. */ }
  const operationId = input?.operationId ?? pending.get(key) ?? stored ?? crypto.randomUUID();
  pending.set(key, operationId);
  try { storage?.setItem(key, operationId); } catch { /* Memory fallback. */ }
  const clear = () => {
    pending.delete(key);
    try { storage?.removeItem(key); } catch { /* Memory fallback. */ }
  };
  try {
    const result = await post({ ...body, operationId });
    clear();
    return result;
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    // These responses conclusively reject the write. Network, timeout and server failures are uncertain.
    if ([400, 401, 403, 404, 409, 429].includes(status)) clear();
    throw error;
  }
}
