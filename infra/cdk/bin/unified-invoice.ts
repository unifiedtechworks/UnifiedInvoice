#!/usr/bin/env node

import { App } from 'aws-cdk-lib';

import { UnifiedInvoiceApiStack } from '../lib/unified-invoice-api-stack.js';

const contextArguments = process.argv.flatMap((argument, index, argumentsList) => {
  if (argument === '--context' || argument === '-c') {
    return argumentsList[index + 1] ?? [];
  }
  if (argument.startsWith('--context=')) {
    return argument.slice('--context='.length);
  }
  if (argument.startsWith('-c=')) {
    return argument.slice('-c='.length);
  }
  return [];
});
const environmentContext = contextArguments
  .map((argument) => {
    const [key, value] = argument.split('=', 2);
    return { key, value };
  })
  .find(({ key }) => key === 'environment')?.value;

const app = new App(
  environmentContext === undefined ? {} : { context: { environment: environmentContext } },
);
const configuredEnvironment = app.node.tryGetContext('environment') as unknown;
const environmentName = configuredEnvironment === undefined ? 'dev' : configuredEnvironment;

if (typeof environmentName !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(environmentName)) {
  throw new TypeError(
    'CDK context "environment" must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens.',
  );
}

new UnifiedInvoiceApiStack(app, `UnifiedInvoiceApi-${environmentName}`, {
  stackName: `unified-invoice-${environmentName}-api`,
  environmentName,
});

app.synth();
