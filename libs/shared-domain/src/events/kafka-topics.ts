export const KafkaTopics = {
  checkout: {
    saleCompleted: 'checkout.sale.completed'
  },
  management: {
    productRegistered: 'management.product.registered',
    productPriceUpdated: 'management.product-price.updated',
    employeeRegistered: 'management.employee.registered'
  }
} as const;
