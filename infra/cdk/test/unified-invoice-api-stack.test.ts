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
      Environment: {
        Variables: {
          APP_ENV: 'test',
          COGNITO_USER_POOL_CLIENT_ID: {
            Ref: Match.stringLikeRegexp('UserPoolClient'),
          },
          COGNITO_USER_POOL_ID: {
            Ref: Match.stringLikeRegexp('UserPool'),
          },
          INVOICES_TABLE_NAME: {
            Ref: Match.stringLikeRegexp('InvoicesTable'),
          },
        },
      },
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
      AuthorizationType: 'NONE',
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/unified-invoice-test-health',
      RetentionInDays: 14,
    });
    template.hasOutput('HealthApiUrl', {});
    template.hasOutput('HealthFunctionName', {});

    const routes = template.findResources('AWS::ApiGatewayV2::Route');
    expect(Object.values(routes)).toHaveLength(1);
    expect(JSON.stringify(routes)).not.toContain('/invoices');
  });

  it('creates the low-cost invoice repository table', () => {
    const { template } = createTemplate();

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'unified-invoice-test-invoices',
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
    });
    template.hasOutput('InvoicesTableName', {
      Value: {
        Ref: Match.stringLikeRegexp('InvoicesTable'),
      },
    });
  });

  it('grants only the DynamoDB table actions needed by the repository adapter', () => {
    const { template } = createTemplate();

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
              'dynamodb:Query',
              'dynamodb:TransactWriteItems',
            ]),
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [Match.stringLikeRegexp('InvoicesTable'), 'Arn'],
            },
          }),
        ]),
      },
    });

    const policies = template.findResources('AWS::IAM::Policy');
    expect(JSON.stringify(policies)).not.toContain('dynamodb:Scan');
    expect(JSON.stringify(policies)).not.toContain('dynamodb:*');
  });

  it('creates the Cognito auth scaffold for future invoice routes', () => {
    const { template } = createTemplate();

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'unified-invoice-test-users',
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
      },
      UsernameAttributes: ['email'],
      AccountRecoverySetting: {
        RecoveryMechanisms: [
          {
            Name: 'verified_email',
            Priority: 1,
          },
        ],
      },
      MfaConfiguration: 'OFF',
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 12,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          RequireUppercase: true,
        }),
      },
    });
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'unified-invoice-test-web-client',
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith([
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ]),
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
      Name: 'unified-invoice-test-jwt-authorizer',
      JwtConfiguration: {
        Audience: [
          {
            Ref: Match.stringLikeRegexp('UserPoolClient'),
          },
        ],
        Issuer: {
          'Fn::Join': Match.anyValue(),
        },
      },
    });
    template.hasOutput('UserPoolId', {
      Value: {
        Ref: Match.stringLikeRegexp('UserPool'),
      },
    });
    template.hasOutput('UserPoolClientId', {
      Value: {
        Ref: Match.stringLikeRegexp('UserPoolClient'),
      },
    });
  });

  it('does not introduce deferred routes, network, domain, or app bucket resources', () => {
    const { template } = createTemplate();

    template.resourceCountIs('AWS::EC2::VPC', 0);
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
    template.resourceCountIs('AWS::ApiGatewayV2::DomainName', 0);
    template.resourceCountIs('AWS::S3::Bucket', 0);
  });
});
