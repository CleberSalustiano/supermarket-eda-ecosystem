'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_TIMEOUTS = { catalogMs: 90_000, pollMs: 1_000 };

async function callJson(fetchImpl, method, url, body) {
  const response = await fetchImpl(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, body: payload };
}

const errorMessage = (result) => {
  const message = result.body?.message;
  return Array.isArray(message) ? message.join('; ') : String(message ?? '');
};

function describeFailure(step, result) {
  return new Error(`${step} failed with HTTP ${result.status}: ${errorMessage(result)}`);
}

function createContext({ fetchImpl, baseUrls, data, state, log, timeouts }) {
  const catalogUrl = (barcode) =>
    `${baseUrls.checkout}/catalog-items/barcodes/${encodeURIComponent(barcode)}?tenantId=${data.tenantId}`;
  return {
    data,
    state,
    log,
    baseUrls,
    timeouts: { ...DEFAULT_TIMEOUTS, ...timeouts },
    call: (method, url, body) => callJson(fetchImpl, method, url, body),
    lookup: (barcode) => callJson(fetchImpl, 'GET', catalogUrl(barcode))
  };
}

async function seedEmployees(ctx) {
  for (const employee of ctx.data.employees) {
    const result = await ctx.call('POST', `${ctx.baseUrls.management}/employees`, {
      tenantId: ctx.data.tenantId,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      role: employee.role,
      pin: employee.pin
    });
    if (result.status === 201) {
      ctx.state.employees[employee.employeeCode] = { employeeId: result.body.employeeId };
      ctx.log(`employee ${employee.employeeCode}: registered`);
    } else if (result.status === 409) {
      ctx.state.employees[employee.employeeCode] = ctx.state.employees[employee.employeeCode] ?? {
        employeeId: null,
        note: 'already registered; id unavailable (no employee read endpoint)'
      };
      ctx.log(`employee ${employee.employeeCode}: already registered`);
    } else {
      throw describeFailure(`Registering employee ${employee.employeeCode}`, result);
    }
  }
}

async function registerProduct(ctx, product, lookup) {
  const result = await ctx.call('POST', `${ctx.baseUrls.management}/products`, {
    tenantId: ctx.data.tenantId,
    name: product.name,
    barcode: product.barcode,
    unitOfMeasure: product.unitOfMeasure,
    price: product.registrationPrice
  });
  if (result.status === 201) {
    ctx.log(`product ${product.barcode}: registered`);
    return result.body.productId;
  }
  if (result.status === 409) {
    const productId = lookup.body?.productId ?? ctx.state.products[product.barcode];
    if (!productId) {
      throw new Error(
        `product ${product.barcode} exists in management but its id is unknown; run \`npm run local:up -- --reset\``
      );
    }
    ctx.log(`product ${product.barcode}: already registered`);
    return productId;
  }
  throw describeFailure(`Registering product ${product.barcode}`, result);
}

async function updatePrice(ctx, productId, price) {
  return ctx.call('PUT', `${ctx.baseUrls.management}/products/${productId}/price`, {
    tenantId: ctx.data.tenantId,
    price
  });
}

async function applyPrice(ctx, product, productId) {
  let result = await updatePrice(ctx, productId, product.price);
  if (result.status === 400 && /must differ/i.test(errorMessage(result))) {
    ctx.log(`product ${product.barcode}: price already current in management; re-emitting price event`);
    const reset = await updatePrice(ctx, productId, product.registrationPrice);
    if (reset.status !== 200) {
      throw describeFailure(`Re-emitting price for ${product.barcode}`, reset);
    }
    result = await updatePrice(ctx, productId, product.price);
  }
  if (result.status !== 200) {
    throw describeFailure(`Updating price of ${product.barcode}`, result);
  }
  ctx.log(`product ${product.barcode}: price update to ${product.price}`);
}

const isCatalogCurrent = (lookup, product) =>
  lookup.status === 200 && Number(lookup.body.unitPrice) === product.price && lookup.body.active === true;

async function seedProducts(ctx) {
  for (const product of ctx.data.products) {
    const lookup = await ctx.lookup(product.barcode);
    if (isCatalogCurrent(lookup, product)) {
      ctx.state.products[product.barcode] = lookup.body.productId;
      ctx.log(`product ${product.barcode}: already in checkout catalog at ${product.price}`);
      continue;
    }
    const productId = await registerProduct(ctx, product, lookup);
    ctx.state.products[product.barcode] = productId;
    await applyPrice(ctx, product, productId);
  }
}

async function waitForCatalog(ctx) {
  const deadline = Date.now() + ctx.timeouts.catalogMs;
  let missing = ctx.data.products;
  while (true) {
    const lookups = await Promise.all(missing.map((product) => ctx.lookup(product.barcode)));
    missing = missing.filter((product, index) => !isCatalogCurrent(lookups[index], product));
    if (missing.length === 0) {
      ctx.log('checkout catalog is up to date');
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Checkout catalog did not converge; missing barcodes: ${missing.map((p) => p.barcode).join(', ')}. ` +
          'Check .local-run/logs/checkout-service.log, .local-run/logs/management-service.log and the ' +
          'Kafka UI topic management.product-price.updated at http://localhost:8080.'
      );
    }
    await sleep(ctx.timeouts.pollMs);
  }
}

async function seedSupplierInvoice(ctx) {
  const { supplierReference } = ctx.data.supplierInvoice;
  const result = await ctx.call('POST', `${ctx.baseUrls.inventory}/supplier-invoices`, {
    tenantId: ctx.data.tenantId,
    supplierReference,
    items: ctx.data.products.map((product) => ({
      productId: ctx.state.products[product.barcode],
      barcode: product.barcode,
      name: product.name,
      unitOfMeasure: product.unitOfMeasure,
      quantity: product.quantity,
      unitCost: product.unitCost
    }))
  });
  if (result.status === 201) {
    ctx.log(`supplier invoice ${supplierReference}: received`);
  } else if (result.status === 409) {
    ctx.log(`supplier invoice ${supplierReference}: already received`);
  } else {
    throw describeFailure(`Receiving supplier invoice ${supplierReference}`, result);
  }
}

async function seedLocalData({ fetchImpl = fetch, baseUrls, data, state, log = () => {}, timeouts }) {
  const seedState = { employees: {}, products: {}, ...state };
  seedState.employees = { ...seedState.employees };
  seedState.products = { ...seedState.products };
  const ctx = createContext({ fetchImpl, baseUrls, data, state: seedState, log, timeouts });

  await seedEmployees(ctx);
  await seedProducts(ctx);
  await waitForCatalog(ctx);
  await seedSupplierInvoice(ctx);
  return seedState;
}

module.exports = { seedLocalData };
