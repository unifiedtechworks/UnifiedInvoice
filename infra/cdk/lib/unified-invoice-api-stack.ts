import { resolve } from 'node:path';

import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
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
    });

    const healthApi = new HttpApi(this, 'HealthApi', {
      apiName: `${resourcePrefix}-http-api`,
      createDefaultStage: true,
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
  }
}
