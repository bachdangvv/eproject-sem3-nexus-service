import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withPaymentOperation } from '../src/services/paymentRetry.ts';

test('lost response retries the same receipt and permits a new receipt after success', async () => {
  const saved = new Map();
  const ids = [];
  let loseResponse = true;
  const post = async body => {
    ids.push(body.operationId);
    saved.set(body.operationId, body);
    if (loseResponse) { loseResponse = false; throw { status: 504 }; }
    return body;
  };
  const scope = `billing:${crypto.randomUUID()}`;
  const payload = { amount: 100, invoiceId: 1, note: ' Receipt ' };
  await assert.rejects(withPaymentOperation(scope, payload, post));
  const replay = await withPaymentOperation(scope, payload, post);
  assert.equal(ids[0], ids[1]);
  assert.equal(saved.size, 1);
  assert.equal(replay.note, 'Receipt');
  await withPaymentOperation(scope, payload, post);
  assert.notEqual(ids[1], ids[2]);
  assert.equal(saved.size, 2);
});

test('retry identity survives reloading the module through tab storage', async () => {
  const storage = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } });
  try {
    let originalId;
    const scope = `retail:${crypto.randomUUID()}`;
    await assert.rejects(withPaymentOperation(scope, { amount: 10 }, async body => {
      originalId = body.operationId; throw new Error('connection lost');
    }));
    const reloaded = await import(`../src/services/paymentRetry.ts?reload=${crypto.randomUUID()}`);
    const result = await reloaded.withPaymentOperation(scope, { amount: 10 }, async body => body);
    assert.equal(result.operationId, originalId);
    assert.equal(storage.size, 0);
  } finally { delete globalThis.sessionStorage; }
});

test('different actors, invoices and amounts cannot share a pending receipt', async () => {
  const ids = [];
  const post = async body => { ids.push(body.operationId); throw { status: 503 }; };
  const scope = crypto.randomUUID();
  for (const [actor, payload] of [
    ['one', { invoiceId: 1, amount: 10 }], ['two', { invoiceId: 1, amount: 10 }],
    ['one', { invoiceId: 2, amount: 10 }], ['one', { invoiceId: 1, amount: 20 }],
  ]) await assert.rejects(withPaymentOperation(`${actor}:${scope}`, payload, post));
  assert.equal(new Set(ids).size, 4);
});

test('a definite rejection clears the rejected operation instead of replaying it forever', async () => {
  const scope = crypto.randomUUID(); const ids = [];
  await assert.rejects(withPaymentOperation(scope, { amount: 10 }, async body => {
    ids.push(body.operationId); throw { status: 409 };
  }));
  await withPaymentOperation(scope, { amount: 10 }, async body => ids.push(body.operationId));
  assert.notEqual(ids[0], ids[1]);
});
