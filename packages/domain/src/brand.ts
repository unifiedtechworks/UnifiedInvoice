declare const domainBrand: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly [domainBrand]: TBrand;
};

export type BrandedObject<TBrand extends string> = {
  readonly [domainBrand]: TBrand;
};

export const brandString = <TBrand extends string>(value: string): Brand<string, TBrand> =>
  value as Brand<string, TBrand>;

export const brandBigInt = <TBrand extends string>(value: bigint): Brand<bigint, TBrand> =>
  value as Brand<bigint, TBrand>;
