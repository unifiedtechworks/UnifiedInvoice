# 0003: Money and Fixed-Point Quantity Representations

## Status

Accepted for Task 003.

## Context

The platform needs deterministic primitives for monetary amounts, currency-aware money values, fractional invoice quantities, rounding behavior, and JSON-safe serialization. These primitives must be independent of React, React Native, browser APIs, native APIs, AWS SDKs, DynamoDB, API Gateway, Lambda, Cognito, databases, HTTP frameworks, and UI formatting libraries.

Task 003 establishes safe primitives only. It does not implement invoice subtotal calculation, discounts, taxes, payment allocation, balances, currency conversion, exchange rates, persistence, API routes, or presentation formatting.

## Decisions

### Monetary and quantity integer representation

Internal monetary minor units, fixed-point quantity units, and exact intermediate arithmetic use `bigint`.

`bigint` was chosen over safe-integer `number` because it provides exact integer arithmetic beyond JavaScript's safe-integer ceiling and prevents accidental mixing with decimal `number` arithmetic. Safe-integer `number` was rejected because intermediate money × quantity products could exceed the safe range. String-only internal arithmetic was rejected because it would make every arithmetic operation more complex and error-prone.

The application safety bound is:

```text
-9_999_999_999_999_999
+9_999_999_999_999_999
```

This is an application safety bound, not a BigInt technical limit. Every public constructor, parser, and arithmetic result enforces the bound and returns `numeric_overflow` when the bound would be exceeded. Values are never clamped.

### Runtime and JSON compatibility

Node.js 22, Vitest, modern browser runtimes, and the current React Native 0.86/Hermes Android runtime are expected to support BigInt. TypeScript compilation alone is not treated as runtime proof; Task 003 requires an Android/Hermes physical-device smoke verification showing `2n * 3n === 6n` and a small domain money operation.

Internal values containing BigInt are not JSON-safe:

- `MonetaryInteger`
- `QuantityInteger`
- `Money`
- `Quantity`

They must not be passed directly to `JSON.stringify`, API payloads, persistence, AsyncStorage or future device storage, or structured logs expecting JSON. The platform must use explicit serializers instead. The domain package does not patch `BigInt.prototype.toJSON` and does not add implicit `toJSON` methods to money or quantity values.

### Currency metadata

Task 003 defines:

```ts
type CurrencyMinorUnitDigits = 0 | 1 | 2 | 3 | 4;

type CurrencyDefinition = Readonly<{
  code: CurrencyCode;
  minorUnitDigits: CurrencyMinorUnitDigits;
}>;
```

`USD_CURRENCY_DEFINITION` is the only built-in currency definition. Task 003 does not introduce a partial `knownCurrencyDefinitions` registry because a representative subset could be mistaken for a complete supported-currency or ISO registry. Complete supported-currency configuration or ISO metadata is deferred.

Tests may construct definitions for examples such as JPY, EUR, KWD, or synthetic test codes, but those examples are not a registry.

### Money shape and policy

`Money` is an immutable branded object:

```ts
type Money = Readonly<{
  currency: CurrencyCode;
  minorUnits: MonetaryInteger;
}>;
```

Values are created through validated public constructors and parsers. Direct object construction is rejected by compile-time brand checks. Runtime objects are frozen.

Zero and negative monetary values are allowed at the primitive level so future discounts, credits, refunds, and adjustments can be represented. Higher-level invoice rules may reject negative values where inappropriate.

Money equality includes currency and amount. Cross-currency arithmetic and ordering comparison return `currency_mismatch`. Equality across different currencies returns `false`; no currency conversion is performed.

### Quantity shape and policy

Quantities use a fixed project-wide scale of four decimal places:

```text
QUANTITY_SCALE = 4
QUANTITY_SCALE_FACTOR = 10_000n
```

Examples:

```text
1       -> 10000
1.5     -> 15000
2.25    -> 22500
0.125   -> 1250
```

`Quantity` is an immutable branded object containing fixed-scale integer units and scale `4`. Zero and negative quantities are allowed at the primitive level. Excess precision is rejected instead of rounded silently. Measurement-unit catalogs are deferred.

### Negative zero

Decimal parsing accepts and canonicalizes negative-zero forms such as `-0`, `-0.0`, `-0.00`, and `-0.0000` where the target precision permits them. There is no negative-zero distinction in `Money` or `Quantity`, and serialization emits `"0"`.

### Rounding policy

Task 003 implements only these rounding modes:

```ts
['half_away_from_zero', 'half_to_even', 'truncate', 'floor', 'ceiling'];
```

The default is `half_away_from_zero`.

Rounding is implemented with BigInt integer division and remainders. Domain calculations do not use `Math.round`, `Math.floor`, or other Number-based rounding. Money × quantity computes an exact BigInt numerator and rounds once to monetary minor units.

Examples for halfway values:

- `half_away_from_zero`: `1.5 -> 2`, `-1.5 -> -2`
- `half_to_even`: `2.5 -> 2`, `3.5 -> 4`, `-2.5 -> -2`, `-3.5 -> -4`
- `truncate`: `1.5 -> 1`, `-1.5 -> -1`
- `floor`: `1.5 -> 1`, `-1.5 -> -2`
- `ceiling`: `1.5 -> 2`, `-1.5 -> -1`

Tax-jurisdiction-specific rounding rules are deferred.

### Parsing rules

Parsing APIs are machine/domain parsers, not user-facing input formatters. UI layers may later normalize friendly input before calling the domain parser.

Strict machine-input rules:

- no whitespace padding
- no leading `+`
- no scientific notation
- no grouping separators
- no currency symbols
- no bare decimals
- no trailing decimal point
- no excessive precision
- no noncanonical leading-zero forms such as `001.23`

Money decimal parsing validates fractional digits against a supplied `CurrencyDefinition`. Quantity decimal parsing allows at most four fractional digits.

### Serialization contracts

JSON-safe serialized contracts are:

```ts
type SerializedMoney = Readonly<{
  currency: string;
  minorUnits: string;
}>;

type SerializedQuantity = Readonly<{
  units: string;
  scale: number;
}>;
```

Deserializers accept `unknown`, validate the complete runtime shape, and reject extra properties for canonical machine contracts. String integer fields preserve precision for values larger than `Number.MAX_SAFE_INTEGER` and are suitable for future API payloads, DynamoDB-compatible storage mapping, and offline storage.

## Consequences

- Financial primitive arithmetic is exact and deterministic.
- JSON contracts are explicit and precision-safe.
- Android/Hermes BigInt support must be verified at runtime for this milestone.
- Future invoice-engine tasks can build totals, taxes, discounts, rates, and allocation behavior on these primitives without changing the core representation.

## Deferred

- Invoice subtotal, discount, tax, payment allocation, balance, and lifecycle calculations.
- Percentage/rate primitives.
- Currency conversion and exchange rates.
- Complete supported-currency configuration or ISO currency metadata registry.
- Locale-aware presentation formatting.
- Persistence schemas and AWS-specific attribute shapes.
