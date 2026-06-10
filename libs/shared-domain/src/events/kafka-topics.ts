export const KafkaTopics = {
  checkout: {
    saleCompleted: 'checkout.sale.completed',
    saleCanceled: 'checkout.sale.canceled',
    registerClosed: 'checkout.register.closed'
  },
  management: {
    productRegistered: 'management.product.registered',
    productPriceUpdated: 'management.product-price.updated',
    employeeRegistered: 'management.employee.registered'
  }
} as const;
