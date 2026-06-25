# Task 003: Money and Fixed-Point Quantity Primitives

## Status

Completed; ready for review and commit.

## Objective

Design and implement platform-independent primitives for monetary amounts, currency-aware money values, fractional quantities, rounding behavior, and JSON-safe serialized representations.

## Scope

Implemented in `packages/domain` only, with documentation under `docs/decisions` and `tasks`.

## Decisions implemented

- Internal monetary minor units, quantity units, and exact intermediate arithmetic use `bigint`.
- Monetary and quantity integer bounds are application safety bounds:
  - minimum: `-9_999_999_999_999_999`
  - maximum: `9_999_999_999_999_999`
- Explicit serialized forms use strings for BigInt-backed integer values.
- `CurrencyMinorUnitDigits` is `0 | 1 | 2 | 3 | 4`.
- `USD_CURRENCY_DEFINITION` is the only built-in currency definition.
- No supported-currency registry or ISO metadata table was added.
- `Money` and `Quantity` are immutable branded objects created through validated APIs.
- Zero and negative money/quantity values are permitted at the primitive level.
- Quantity scale is fixed at four decimal places with `QUANTITY_SCALE_FACTOR = 10_000n`.
- Excess quantity precision is rejected.
- Default rounding mode is `half_away_from_zero`.
- Rounding is BigInt-based and does not use Number rounding helpers.

## Public arithmetic scope

Implemented:

- `addMoney`
- `subtractMoney`
- `negateMoney`
- `compareMoney`
- `equalMoney`
- `compareQuantity`
- `equalQuantity`
- `multiplyMoneyByQuantity`

Not implemented:

- invoice subtotal calculation
- tax calculation
- discounts
- percentages
- rates
- payment allocation
- balance calculation
- currency conversion

## JSON policy

Internal values containing BigInt are not JSON-safe and must not be passed directly to JSON serialization, API payloads, persistence, offline storage, or structured JSON logs:

- `Money`
- `Quantity`
- `MonetaryInteger`
- `QuantityInteger`

Use:

- `serializeMoney`
- `serializeQuantity`

The implementation does not patch `BigInt.prototype.toJSON` and does not add implicit `toJSON` methods.

## Verification checklist

Required commands:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm web:build
```

Additional required verification:

- Physical Android/Hermes smoke test proving BigInt arithmetic executes under React Native 0.86/Hermes Android runtime.
- Smoke must prove at least `2n * 3n === 6n` and one small domain money operation.
- Any temporary UI changes used for smoke verification must be removed before completion.

## Android/Hermes smoke verification

Performed on physical device `R5CY11J2HMV` (`SM-S938U - 16`) with React Native 0.86/Hermes.

Commands used:

```bash
adb devices
adb reverse tcp:8081 tcp:8081
pnpm --filter @invoice/mobile exec react-native start --reset-cache
pnpm --filter @invoice/mobile exec react-native run-android --no-packager
adb shell uiautomator dump /sdcard/window.xml
adb shell cat /sdcard/window.xml
```

Results:

- `adb devices` showed `R5CY11J2HMV device`.
- `adb reverse tcp:8081 tcp:8081` returned `8081`.
- Metro started successfully and bundled `./index.js`.
- `run-android --no-packager` installed and launched the app successfully.
- Temporary on-device smoke display rendered: `BigInt arithmetic: pass; Money addition: pass`.
- The BigInt smoke executed `2n * 3n === 6n` under Hermes.
- The domain smoke parsed `1.00` and `2.00` USD money values and added them to `300n` minor units on-device.
- Temporary mobile UI changes were removed after verification.

## Deferred decisions

- Complete supported-currency metadata or ISO registry.
- Percentage/rate primitives.
- Invoice engine calculations.
- Tax and discount behavior.
- Payment allocation.
- Currency conversion and exchange rates.
- Persistence schemas and AWS-specific storage shapes.
- Locale-aware display formatting.
