'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { seedLocalData } = require('./seed');

const TENANT = '8f6d7df2-0d8a-4c81-9ad3-6f9c3c5198b1';
const baseUrls = {
  checkout: 'http://c',
  inventory: 'http://i',
  management: 'http://m'
};
const data = {
  tenantId: TENANT,
  employees: [{ employeeCode: 'CASHIER-01', fullName: 'Ana Souza', role: 'CASHIER', pin: '4821' }],
  products: [
    { barcode: '1111', name: 'Coffee', unitOfMeasure: 'UN', registrationPrice: 10, price: 9, quantity: 4, unitCost: 5 }
  ],
  supplierInvoice: { supplierReference: 'SEED-INV-0001' }
};
const timeouts = { catalogMs: 60, pollMs: 5 };

function reply(status, body) {
  return { status, json: async () => body };
}

/** Routes: function(call) => reply | undefined. Records each call. */
function fakeFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const call = {
      method: init.method ?? 'GET',
      url: url.replace(/\?.*$/, ''),
      body: init.body ? JSON.parse(init.body) : undefined
    };
    calls.push(call);
    return handler(call, calls) ?? reply(500, { message: `unexpected ${call.method} ${call.url}` });
  };
  return { fetchImpl, calls };
}

const run = (fetchImpl, state = {}) =>
  seedLocalData({ fetchImpl, baseUrls, data, state, timeouts, log: () => {} });

const summary = (calls) => calls.map((call) => `${call.method} ${call.url}`);

test('fresh run: employees, register, price update, catalog poll, invoice with exact bodies', async () => {
  let priced = false;
  const { fetchImpl, calls } = fakeFetch((call) => {
    if (call.url === 'http://m/employees') return reply(201, { employeeId: 'emp-1' });
    if (call.url === 'http://c/catalog-items/barcodes/1111') {
      return priced
        ? reply(200, { productId: 'prod-1', unitPrice: 9, active: true })
        : reply(404, { message: 'not found' });
    }
    if (call.url === 'http://m/products') return reply(201, { productId: 'prod-1' });
    if (call.url === 'http://m/products/prod-1/price') {
      priced = true;
      return reply(200, {});
    }
    if (call.url === 'http://i/supplier-invoices') return reply(201, {});
  });

  const state = await run(fetchImpl);

  assert.deepEqual(summary(calls), [
    'POST http://m/employees',
    'GET http://c/catalog-items/barcodes/1111',
    'POST http://m/products',
    'PUT http://m/products/prod-1/price',
    'GET http://c/catalog-items/barcodes/1111',
    'POST http://i/supplier-invoices'
  ]);
  assert.deepEqual(calls[0].body, {
    tenantId: TENANT,
    employeeCode: 'CASHIER-01',
    fullName: 'Ana Souza',
    role: 'CASHIER',
    pin: '4821'
  });
  assert.deepEqual(calls[2].body, {
    tenantId: TENANT,
    name: 'Coffee',
    barcode: '1111',
    unitOfMeasure: 'UN',
    price: 10
  });
  assert.deepEqual(calls[3].body, { tenantId: TENANT, price: 9 });
  assert.deepEqual(calls[5].body, {
    tenantId: TENANT,
    supplierReference: 'SEED-INV-0001',
    items: [{ productId: 'prod-1', barcode: '1111', name: 'Coffee', unitOfMeasure: 'UN', quantity: 4, unitCost: 5 }]
  });
  assert.equal(state.employees['CASHIER-01'].employeeId, 'emp-1');
  assert.equal(state.products['1111'], 'prod-1');
});

test('re-run: 409s and an up-to-date catalog do not fail nor repeat the price update', async () => {
  const { fetchImpl, calls } = fakeFetch((call) => {
    if (call.url === 'http://m/employees') return reply(409, { message: 'already registered' });
    if (call.url === 'http://c/catalog-items/barcodes/1111') {
      return reply(200, { productId: 'prod-1', unitPrice: '9.00', active: true });
    }
    if (call.url === 'http://i/supplier-invoices') return reply(409, { message: 'exists' });
  });

  const state = await run(fetchImpl, { employees: { 'CASHIER-01': { employeeId: 'emp-1' } }, products: {} });

  assert.equal(calls.some((call) => call.method === 'PUT'), false);
  assert.equal(calls.some((call) => call.url === 'http://m/products'), false);
  assert.equal(state.employees['CASHIER-01'].employeeId, 'emp-1');
  assert.equal(state.products['1111'], 'prod-1');
});

test('409 on product registration uses the id from the catalog lookup for the price update', async () => {
  let priced = false;
  const { fetchImpl, calls } = fakeFetch((call) => {
    if (call.url === 'http://m/employees') return reply(409, { message: 'x' });
    if (call.url === 'http://c/catalog-items/barcodes/1111') {
      return reply(200, { productId: 'prod-catalog', unitPrice: priced ? 9 : 10, active: true });
    }
    if (call.url === 'http://m/products') return reply(409, { message: 'Barcode already registered' });
    if (call.url === 'http://m/products/prod-catalog/price') {
      priced = true;
      return reply(200, {});
    }
    if (call.url === 'http://i/supplier-invoices') return reply(201, {});
  });

  await run(fetchImpl);

  assert.ok(calls.some((call) => call.method === 'PUT' && call.url === 'http://m/products/prod-catalog/price'));
});

test('400 "must differ" re-emits the event via registrationPrice then price', async () => {
  let priceEvents = 0;
  const { fetchImpl, calls } = fakeFetch((call) => {
    if (call.url === 'http://m/employees') return reply(409, { message: 'x' });
    if (call.url === 'http://c/catalog-items/barcodes/1111') {
      return priceEvents >= 2
        ? reply(200, { productId: 'prod-1', unitPrice: 9, active: true })
        : reply(404, {});
    }
    if (call.url === 'http://m/products') return reply(201, { productId: 'prod-1' });
    if (call.url === 'http://m/products/prod-1/price') {
      if (call.body.price === 9 && priceEvents === 0) {
        priceEvents = -1;
        return reply(400, { message: 'New price must differ from the current price' });
      }
      priceEvents = priceEvents === -1 ? 1 : 2;
      return reply(200, {});
    }
    if (call.url === 'http://i/supplier-invoices') return reply(201, {});
  });

  await run(fetchImpl);

  const prices = calls.filter((call) => call.method === 'PUT').map((call) => call.body.price);
  assert.deepEqual(prices, [9, 10, 9]);
});

test('catalog that never converges rejects naming the missing barcode', async () => {
  const { fetchImpl } = fakeFetch((call) => {
    if (call.url === 'http://m/employees') return reply(409, { message: 'x' });
    if (call.url === 'http://c/catalog-items/barcodes/1111') return reply(404, {});
    if (call.url === 'http://m/products') return reply(201, { productId: 'prod-1' });
    if (call.url === 'http://m/products/prod-1/price') return reply(200, {});
  });

  await assert.rejects(run(fetchImpl), /missing barcodes: 1111/);
});
