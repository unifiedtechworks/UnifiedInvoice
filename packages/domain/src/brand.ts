declare const domainBrand: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly [domainBrand]: TBrand;
};

export const brandString = <TBrand extends string>(value: string): Brand<string, TBrand> =>
  value as Brand<string, TBrand>;
