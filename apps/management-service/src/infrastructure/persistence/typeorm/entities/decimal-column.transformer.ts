export const decimalColumnTransformer = {
  from(value: number | string): number {
    return typeof value === 'number' ? value : Number.parseFloat(value);
  },
  to(value: number): number {
    return value;
  }
};
