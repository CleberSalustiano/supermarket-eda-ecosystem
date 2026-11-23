'use strict';

const SERVICE_URLS = [
  ['checkout-service', 'http://localhost:3001'],
  ['inventory-service', 'http://localhost:3002'],
  ['management-service', 'http://localhost:3003'],
  ['Kafka UI', 'http://localhost:8080']
];

const WEB_URLS = [
  ['management-web', 'http://localhost:4100'],
  ['checkout-web', 'http://localhost:4101'],
  ['inventory-web', 'http://localhost:4102']
];

const MOBILE_URL = ['Expo (operations-mobile)', 'http://localhost:8081'];

const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (header, rows) => [row(header), row(header.map(() => '---')), ...rows.map(row)].join('\n');
const formatMoney = (value) => Number(value).toFixed(2);

function renderUrls({ withFrontend, withMobile }) {
  const urls = [...(withFrontend ? WEB_URLS : []), ...(withFrontend && withMobile ? [MOBILE_URL] : []), ...SERVICE_URLS];
  return urls.map(([name, url]) => `- ${name}: ${url}`).join('\n');
}

function renderEmployees(data, state) {
  return table(
    ['Code', 'Name', 'Role', 'PIN', 'employeeId'],
    data.employees.map((employee) => [
      employee.employeeCode,
      employee.fullName,
      employee.role,
      employee.pin,
      state.employees?.[employee.employeeCode]?.employeeId ?? 'unknown'
    ])
  );
}

function renderProducts(data, state) {
  return table(
    ['Barcode', 'Name', 'Unit', 'Price', 'productId', 'Received qty'],
    data.products.map((product) => [
      product.barcode,
      product.name,
      product.unitOfMeasure,
      formatMoney(product.price),
      state.products?.[product.barcode] ?? 'unknown',
      String(product.quantity)
    ])
  );
}

function renderTestData({ data, state, today, withFrontend = true, withMobile = false, logDir }) {
  const cashierId = state.employees?.['CASHIER-01']?.employeeId;
  const session = data.checkoutSession;
  return [
    '# Local test data',
    '',
    '## URLs',
    renderUrls({ withFrontend, withMobile }),
    '',
    `Tenant ID: \`${data.tenantId}\``,
    '',
    '## Employees',
    renderEmployees(data, state),
    '',
    '## Opening a register in checkout-web',
    `- registerId: \`${session.registerId}\``,
    `- operatorId: \`${cashierId ?? 'unknown (CASHIER-01 id unavailable)'}\` (checkout does not validate operators yet; the pre-filled default \`2b6b69a3-1c2e-442e-928a-8f0614aa7d0e\` also works)`,
    `- Opening float: \`${session.openingFloatAmount}\``,
    '- Manager approval (cancel a paid or completed sale): employee code `MANAGER-01` or `ADMIN-01` plus that employee\'s PIN from the table above. Checked by management-service; 5 wrong PINs lock the code for 15 minutes, 10 failures lock the register for 15 minutes.',
    '',
    '## Products',
    renderProducts(data, state),
    '',
    '## Profit and loss',
    `In management-web, open the report with fromDate=${today} and toDate=${today}.`,
    '',
    '## Caveats',
    '- New products registered in management-web need one price update before checkout can scan them (Decision 3).',
    '- inventory-web is still a health-only shell.',
    '- On a physical phone, the mobile app needs `EXPO_PUBLIC_FRONTEND_INVENTORY_API_BASE_URL` / `EXPO_PUBLIC_FRONTEND_MANAGEMENT_API_BASE_URL` pointed at the Mac LAN IP (not automated).',
    '',
    '## Operating',
    `- Logs: \`${logDir ?? '.local-run/logs'}\``,
    '- Stop everything: `npm run local:down` (from backend-services/)',
    ''
  ].join('\n');
}

module.exports = { renderTestData };
