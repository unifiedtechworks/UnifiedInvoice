import { fileURLToPath } from 'node:url';

import { App, type Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';

import { UnifiedInvoiceApiStack } from '../lib/unified-invoice-api-stack.js';

const sourceAssetPath = fileURLToPath(new URL('../../../apps/api/src/', import.meta.url));

const createTemplate = (): Readonly<{ stack: Stack; template: Template }> => {
  const app = new App();
  const stack = new UnifiedInvoiceApiStack(app, 'TestStack', {
    stackName: 'unified-invoice-test-api',
    environmentName: 'test',
    apiAssetPath: sourceAssetPath,
  });
  return { stack, template: Template.fromStack(stack) };
};

describe('UnifiedInvoiceApiStack', () => {
  it('synthesizes the low-cost health API with environment tags', () => {
    const { stack, template } = createTemplate();

    expect(stack.stackName).toBe('unified-invoice-test-api');
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'unified-invoice-test-health',
      Handler: 'index.healthHandler',
      Runtime: 'nodejs22.x',
      MemorySize: 128,
      Timeout: 5,
      Tags: Match.arrayWith([
        { Key: 'Environment', Value: 'test' },
        { Key: 'ManagedBy', Value: 'CDK' },
        { Key: 'Project', Value: 'UnifiedInvoice' },
      ]),
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'unified-invoice-test-http-api',
      ProtocolType: 'HTTP',
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /health',
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/unified-invoice-test-health',
      RetentionInDays: 14,
    });
  });

  it('does not introduce deferred state, identity, or network resources', () => {
    const { template } = createTemplate();

    template.resourceCountIs('AWS::DynamoDB::Table', 0);
    template.resourceCountIs('AWS::Cognito::UserPool', 0);
    template.resourceCountIs('AWS::EC2::VPC', 0);
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });
});
