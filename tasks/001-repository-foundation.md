# Task 001: Repository Foundation

## Status

Completed.

## Commands run

- `volta --version`
- `node --version`
- `npm --version`
- `java -version`
- `javac -version`
- `where.exe node`
- `where.exe java`
- `corepack prepare pnpm@11.9.0 --activate`
- `volta install pnpm@11.9.0`
- `git init -b main`
- `npx @react-native-community/cli@20.1.3 init Mobile --version 0.86.0 --directory apps/mobile --skip-install`
- `pnpm install`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm format`
- `pnpm test`
- `pnpm build`
- `pnpm web:build`
- `powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'apps/mobile/android'; .\gradlew.bat assembleDebug"`
- `pnpm --filter @invoice/mobile exec react-native bundle --platform android --dev true --entry-file index.js --bundle-output "$env:TEMP\invoice-test.bundle" --assets-dest "$env:TEMP\invoice-assets" --reset-cache`
- `pnpm --filter @invoice/mobile exec react-native start --reset-cache`
- `adb reverse tcp:8081 tcp:8081`
- `pnpm --filter @invoice/mobile exec react-native run-android --no-packager`

## Exact selected versions

- Volta: `2.0.2`
- Node.js: `v22.23.1`
- npm: `10.9.8`
- pnpm: `11.9.0`
- Java/JDK: Temurin `17.0.19`
- React Native: `0.86.0`
- React: `19.2.3`
- React DOM: `19.2.3`
- React Native for Web: `0.21.2`
- TypeScript: `6.0.3`
- Vite: `8.1.0`
- Vitest: `4.1.9`
- ESLint: `10.5.0`
- `@eslint/js`: `10.0.1`
- Prettier: `3.8.4`
- Gradle wrapper: `9.3.1`
- Android Gradle Plugin: `8.12.0`
- Kotlin Gradle plugin: `2.1.20`
- Android compile SDK: `36`
- Android target SDK: `36`
- Android min SDK: `24`
- Android build tools: `36.0.0`
- Android NDK: `27.1.12297006`

## Verification results

- `pnpm install`: passed; generated `pnpm-lock.yaml`; `esbuild@0.27.7` postinstall completed after explicit approval in `pnpm-workspace.yaml`.
- `pnpm typecheck`: passed across real workspaces.
- `pnpm lint`: passed across real workspaces.
- `pnpm format:check`: passed after running `pnpm format`.
- `pnpm test`: passed; Vitest ran `packages/invoice-engine/test/invoice-engine.test.ts` with `1 passed`.
- `pnpm build`: passed; builds shared packages plus web through an explicit filtered build strategy.
- `pnpm web:build`: passed; Vite produced `apps/web/dist/index.html` and bundled assets.
- `apps\mobile\android\gradlew.bat assembleDebug`: passed; generated `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (`121,023,889` bytes at verification time).
- `pnpm list react react-native --depth 0 -r`: confirmed app/UI workspaces use `react@19.2.3` and `react-native@0.86.0`.
- Metro bundle verification: passed; wrote `C:\Users\sethb\AppData\Local\Temp\invoice-test.bundle` and copied 5 asset files.
- Android physical smoke test: passed on connected `SM-S938U - 16`; Metro bundled `./index.js` without resolution errors, `run-android --no-packager` installed and launched the app, and the device rendered the shared domain/UI content without HTTP 500.

## Metro pnpm correction

### Original error

Metro returned HTTP 500 while bundling for Android with:

```text
Unable to resolve module:
@babel/runtime/helpers/interopRequireDefault
```

### Confirmed dependency state

- `@babel/runtime@7.29.7` is listed under `apps/mobile/package.json` regular `dependencies`.
- `apps/mobile/node_modules/@babel/runtime` exists as a pnpm junction.
- The junction target is under the repository root pnpm store:
  `node_modules/.pnpm/@babel+runtime@7.29.7/node_modules/@babel/runtime`.
- Node resolution succeeded for `@babel/runtime/helpers/interopRequireDefault`.

### Root cause

The generated `apps/mobile/metro.config.js` used only React Native's default Metro config. It did not include the repository root in `watchFolders` and did not explicitly include app-local then repository-root `nodeModulesPaths`. Under pnpm, Metro could see the app workspace but could fail to follow the `@babel/runtime` junction target into root `node_modules/.pnpm`, even though Node could resolve it.

### Configuration change

`apps/mobile/metro.config.js` now keeps the React Native default through `getDefaultConfig(projectRoot)` and adds the smallest monorepo-specific configuration:

```js
const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
```

No `disableHierarchicalLookup`, broad React/React Native aliases, shameful hoisting, or third-party Metro resolver was added.

## Deviations

- `corepack prepare pnpm@11.9.0 --activate` prepared pnpm, but the `pnpm` shim was not available on PATH in the active shell. pnpm `11.9.0` was installed through Volta instead.
- The React Native initializer created a nested Git repository under `apps/mobile/.git`; it was removed so the root repository is the only Git repository.
- `npm view eslint version` returned `10.5.0`, but `@eslint/js@10.5.0` does not exist. `@eslint/js` was pinned to the published latest `10.0.1`.
- pnpm `11.9.0` blocked `esbuild@0.27.7` build scripts by default. `esbuild` was explicitly approved in `pnpm-workspace.yaml` because it is required by Vite/tsup.
- TypeScript `6.0.3` reports `baseUrl` deprecation as TS5101. `ignoreDeprecations: "6.0"` was added to the shared config while retaining path mappings for this foundation milestone.
- Package-level project references were removed from `invoice-engine` and `web` typecheck configs to avoid requiring pre-built declaration outputs during `tsc --noEmit`; workspace imports are still verified through path mappings and package dependencies.
- Package `tsconfig.json` files use tsup for declaration/build output and keep TypeScript configs focused on `tsc --noEmit` verification.
- Generated mobile-local ESLint and Prettier configs were removed so the workspace uses the root ESLint flat config and root Prettier config consistently.
- The mobile lint script invokes the root ESLint binary directly to avoid the generated template's local ESLint 8 dependency loading the root ESLint 10 flat config with incompatible plugin rules.
- The root ESLint config uses non-type-aware TypeScript recommended rules for linting, while `pnpm typecheck` provides strict type-aware verification separately.
- Root `pnpm build` uses an explicit filtered build strategy for shared packages and web. Android is verified separately with the required Gradle `assembleDebug` command.
- Vite 8/Rolldown requires the `react-native` alias replacement to be an absolute resolved path, so `apps/web/vite.config.ts` resolves `react-native-web` with `createRequire(...).resolve(...)`.
- The generated Android Gradle files were adjusted for pnpm workspace linking. `@react-native/gradle-plugin` and `@react-native/codegen` are explicit mobile dev dependencies, and app-level React Native paths resolve through `apps/mobile/node_modules` links.
- The official React Native initializer generated iOS files unavoidably. They were left in place but not configured or verified; Android remains the only native verification target for this milestone.
- The generated Metro config required a minimal monorepo adjustment for pnpm junction visibility: repository-root `watchFolders` plus app-local/root `nodeModulesPaths`.

## Unresolved environment issues

- Android command-line tools / `sdkmanager` are not installed.
- Android emulator is present but not on PATH.
- Git on Windows emitted long-path warnings while traversing ignored dependency/build directories. Source checks and build verification completed successfully.

## Files created or modified

Created or modified source/config/documentation includes:

- Root workspace/tooling: `.clinerules/project.md`, `.editorconfig`, `.gitignore`, `.prettierignore`, `.prettierrc.json`, `eslint.config.js`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`.
- Mobile app: `apps/mobile/**`, including generated bare React Native Android files under `apps/mobile/android/**`, generated iOS files under `apps/mobile/ios/**`, and milestone edits to `apps/mobile/App.tsx`, `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `apps/mobile/android/settings.gradle`, and `apps/mobile/android/app/build.gradle`.
- Metro correction: `apps/mobile/metro.config.js`.
- Web app: `apps/web/package.json`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/vite-env.d.ts`.
- Shared packages: `packages/domain/**`, `packages/invoice-engine/**`, `packages/validation/**`, `packages/api-client/**`, `packages/ui/**`.
- Documentation placeholders: `services/README.md`, `infrastructure/README.md`.
- Documentation/task records: `docs/architecture.md`, `docs/development-environment.md`, `docs/decisions/0001-monorepo-foundation.md`, `tasks/001-repository-foundation.md`.
