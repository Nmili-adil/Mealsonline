/**
 * Money helpers. All monetary values are stored and transmitted as integer
 * minor units (centimes of Moroccan dirham). 1 MAD = 100 minor units.
 * Never use floating point for money.
 */

export const MAD_MINOR_UNITS = 100;

export function toMinor(major: number): number {
  return Math.round(major * MAD_MINOR_UNITS);
}

export function fromMinor(minor: number): number {
  return minor / MAD_MINOR_UNITS;
}

export function sumMinor(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

const madFormatter = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
});

export function formatMAD(minor: number): string {
  return madFormatter.format(fromMinor(minor));
}

/** Multiply minor units by a quantity without floating point drift. */
export function multiplyMinor(unitMinor: number, quantity: number): number {
  return unitMinor * quantity;
}
