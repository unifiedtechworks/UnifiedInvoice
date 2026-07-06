import { resolve } from 'node:path';

import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import { CfnAuthorizer, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AccountRecovery, Mfa, UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export type UnifiedInvoiceApiStackProps = StackProps &
  Readonly<{
    environmentName: string;
    apiAssetPath?: string;
  }>;

const defaultApiAssetPath = resolve(process.cwd(), '../../apps/api/dist');

export class UnifiedInvoiceApiStack extends Stack {
  constructor(scope: Construct, id: string, props: UnifiedInvoiceApiStackProps) {
    super(scope, id, props);

    const resourcePrefix = `unified-invoice-${props.environmentName}`;

    Tags.of(this).add('Project', 'UnifiedInvoice');
    Tags.of(this).add('ManagedBy', 'CDK');
    Tags.of(this).add('Environment', props.environmentName);

    const invoicesTable = new Table(this, 'InvoicesTable', {
      tableName: `${resourcePrefix}-invoices`,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPool = new UserPool(this, 'UserPool', {
      userPoolName: `${resourcePrefix}-users`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      mfa: Mfa.OFF,
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: `${resourcePrefix}-web-client`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    const healthLogGroup = new LogGroup(this, 'HealthLogGroup', {
      logGroupName: `/aws/lambda/${resourcePrefix}-health`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const healthFunction = new LambdaFunction(this, 'HealthFunction', {
      functionName: `${resourcePrefix}-health`,
      description: 'Returns the Unified Invoice API scaffold health status',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.X86_64,
      handler: 'index.healthHandler',
      code: Code.fromAsset(props.apiAssetPath ?? defaultApiAssetPath),
      memorySize: 128,
      timeout: Duration.seconds(5),
      logGroup: healthLogGroup,
      environment: {
        APP_ENV: props.environmentName,
        COGNITO_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        INVOICES_TABLE_NAME: invoicesTable.tableName,
      },
    });

    healthFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:TransactWriteItems',
        ],
        resources: [invoicesTable.tableArn],
      }),
    );

    const healthApi = new HttpApi(this, 'HealthApi', {
      apiName: `${resourcePrefix}-http-api`,
      createDefaultStage: true,
    });

    new CfnAuthorizer(this, 'InvoiceJwtAuthorizer', {
      apiId: healthApi.apiId,
      authorizerType: 'JWT',
      identitySource: ['$request.header.Authorization'],
      name: `${resourcePrefix}-jwt-authorizer`,
      jwtConfiguration: {
        audience: [userPoolClient.userPoolClientId],
        issuer: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      },
    });

    healthApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFunction),
    });

    new CfnOutput(this, 'HealthApiUrl', {
      description: 'Environment health endpoint',
      value: `${healthApi.apiEndpoint}/health`,
    });
    new CfnOutput(this, 'HealthFunctionName', {
      description: 'Health Lambda function name',
      value: healthFunction.functionName,
    });
    new CfnOutput(this, 'InvoicesTableName', {
      description: 'Invoice repository DynamoDB table name',
      value: invoicesTable.tableName,
    });
    new CfnOutput(this, 'UserPoolId', {
      description: 'Cognito User Pool ID for future authenticated routes',
      value: userPool.userPoolId,
    });
    new CfnOutput(this, 'UserPoolClientId', {
      description: 'Cognito User Pool Client ID for future web/API clients',
      value: userPoolClient.userPoolClientId,
    });
  }
}
