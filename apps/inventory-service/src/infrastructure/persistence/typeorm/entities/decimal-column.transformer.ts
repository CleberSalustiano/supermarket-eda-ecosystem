export const decimalColumnTransformer = {
  to(value: number | null): number | null {
    return value;
  },
  from(value: string | number | null): number | null {
    if (value === null) {
      return null;
    }

    return Number.parseFloat(String(value));
  }
};
