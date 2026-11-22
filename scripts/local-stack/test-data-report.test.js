'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const data = require('./seed-data.json');
const { renderTestData } = require('./test-data-report');

test('report contains tenant, manager code, every barcode and every URL', () => {
  const state = {
    employees: { 'CASHIER-01': { employeeId: 'emp-1' } },
    products: Object.fromEntries(data.products.map((product, index) => [product.barcode, `prod-${index}`]))
  };

  const report = renderTestData({ data, state, today: '2026-11-22', withFrontend: true, withMobile: true });

  assert.ok(report.includes(data.tenantId));
  assert.ok(report.includes('MANAGER-01'));
  assert.ok(report.includes('emp-1'));
  assert.ok(report.includes('fromDate=2026-11-22'));
  for (const product of data.products) {
    assert.ok(report.includes(product.barcode), product.barcode);
  }
  for (const port of [4100, 4101, 4102, 8081, 3001, 3002, 3003, 8080]) {
    assert.ok(report.includes(`http://localhost:${port}`), String(port));
  }
});

test('report marks unknown ids and omits web URLs in backend-only mode', () => {
  const report = renderTestData({ data, state: { employees: {}, products: {} }, today: '2026-11-22', withFrontend: false });

  assert.ok(report.includes('unknown'));
  assert.equal(report.includes('http://localhost:4101'), false);
});
