export const decimalColumnTransformer = {
  from(value: number | string | null): number | null {
    if (value === null) {
      return null;
    }

    return typeof value === 'number' ? value : Number.parseFloat(value);
  },
  to(value: number | null): number | null {
    return value;
  }
};
