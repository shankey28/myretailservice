import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Duration } from 'aws-cdk-lib/core';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class MyRetailServicesStack extends cdk.Stack {
  public readonly apiEndpointOutput: cdk.CfnOutput;
  public readonly dynamoDBTableOutput: cdk.CfnOutput;
  public readonly createStoreItemLambdaOutput: cdk.CfnOutput;
  public readonly isItemInStockLambdaOutput: cdk.CfnOutput;
  public readonly createOrderLambdaOutput: cdk.CfnOutput;
  public readonly updateItemStockLambdaOutput: cdk.CfnOutput;
  

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table
    const storeDBTable = new dynamodb.Table(this, 'storeDB', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Lambda functions
    const createStoreItemLambda = new lambda.Function(this, 'createStoreItemLambda', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('lambda/create_store_item'), // Path to your Python Lambda function code
      handler: 'index.handler',
      environment: {
        STORE_TABLE_NAME: storeDBTable.tableName,
      },
    });

    const isItemInStockLambda = new lambda.Function(this, 'isItemInStockLambda', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('lambda/is_item_in_stock'), // Path to your Python Lambda function code
      handler: 'index.handler',
      environment: {
        STORE_TABLE_NAME: storeDBTable.tableName,
      },
    });

    const createOrderLambda = new lambda.Function(this, 'createOrderLambda', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('lambda/create_order'), // Path to your Python Lambda function code
      handler: 'index.handler',
      environment: {
        STORE_TABLE_NAME: storeDBTable.tableName,
      },
    });

    const updateItemStockLambda = new lambda.Function(this, 'updateItemStockLambda', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('lambda/update_item_stock'), // Path to your Python Lambda function code
      handler: 'index.handler',
      environment: {
        STORE_TABLE_NAME: storeDBTable.tableName,
      },
    });
    // Grant DynamoDB read/write permissions to the Lambda functions
    storeDBTable.grantReadWriteData(createStoreItemLambda);
    storeDBTable.grantReadWriteData(isItemInStockLambda);
    storeDBTable.grantReadWriteData(createOrderLambda);
    storeDBTable.grantReadWriteData(updateItemStockLambda);

    // API Gateway
    const api = new apigw.RestApi(this, 'MyRetailAPI');

    const createStoreItemIntegration = new apigw.LambdaIntegration(createStoreItemLambda);
    api.root.addResource('create-store-item').addMethod('POST', createStoreItemIntegration);

    const isItemInStockIntegration = new apigw.LambdaIntegration(isItemInStockLambda);
    api.root.addResource('is-item-in-stock').addMethod('GET', isItemInStockIntegration);

    const createOrderIntegration = new apigw.LambdaIntegration(createOrderLambda);
    api.root.addResource('create-order').addMethod('POST', createOrderIntegration);

    const updateItemStockIntegration = new apigw.LambdaIntegration(updateItemStockLambda);
    api.root.addResource('update-item-stock').addMethod('POST', updateItemStockIntegration);


        // Step Functions tasks
        const isItemInStockMapState = new sfn.Map(this, 'IsItemInStockMapState', {
          itemsPath: '$.order',
          resultPath: sfn.JsonPath.DISCARD,
          parameters: {'item.$': '$$.Map.Item.Value'}
        }).iterator(new tasks.LambdaInvoke(this, 'IsItemInStockTask', {
          lambdaFunction: isItemInStockLambda
        }));
    
        const updateItemMapState = new sfn.Map(this, 'UpdateItemMapState', {
          itemsPath: '$.order',
          resultPath: sfn.JsonPath.DISCARD,
          parameters: {'item.$': '$$.Map.Item.Value'}
        }).iterator(new tasks.LambdaInvoke(this, 'UpdateItemTask', {
          lambdaFunction: updateItemStockLambda,
          resultPath: sfn.JsonPath.DISCARD,
        }));
    
        const createOrderTask = new tasks.LambdaInvoke(this, 'CreateOrderTask', {
          lambdaFunction: createOrderLambda,
          inputPath: '$.order',
        });
    
        const parallelState = new cdk.aws_stepfunctions.Parallel(this, 'parallelState', {});

        parallelState.branch(updateItemMapState, createOrderTask);

        const definition = isItemInStockMapState.next(parallelState);

        const stateMachine = new sfn.StateMachine(this, 'MyRetailStateMachine', {
          definition,
          timeout: cdk.Duration.minutes(5),
        });
    
        const invokeStateMachineRole = new cdk.aws_iam.Role(this, 'invokeStateMachineRole', {
          assumedBy: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
        });
        
        invokeStateMachineRole.addToPolicy(
          new cdk.aws_iam.PolicyStatement({
            actions: ['states:StartExecution'],
            resources: [stateMachine.stateMachineArn],
          }),
        );
    // POST route to directly invoke the Step Functions state machine
    const invokeStateMachineIntegration = new apigw.AwsIntegration({
      service: 'states',
      action: 'StartExecution',
      integrationHttpMethod: 'POST',
      options: {
        credentialsRole: invokeStateMachineRole,
        passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_MATCH,
        requestParameters: {
          'integration.request.header.Content-Type': `'application/x-amz-json-1.0'`,
          'integration.request.header.X-Amz-Target': `'AWSStepFunctions.StartExecution'`,
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `$input.json('$')`,
            },
          },
        ],
      },
    });

    const invokeStateMachineMethod = api.root.addResource('myretail').addMethod(
      'POST',
      new cdk.aws_apigateway.Integration({
        type: cdk.aws_apigateway.IntegrationType.AWS,
        integrationHttpMethod: 'POST',
        uri: `arn:aws:apigateway:${cdk.Aws.REGION}:states:action/StartExecution`,
        options: {
          credentialsRole: invokeStateMachineRole,
          requestTemplates: {
            'application/json': `{
            "input": "{\\"order\\": $util.escapeJavaScript($input.json('$'))}",
            "stateMachineArn": "${stateMachine.stateMachineArn}"
          }`,
          },
          integrationResponses: [
            {
              statusCode: '200',
              responseTemplates: {
                'application/json': `{
                "statusCode": 200,
                "body": { "message": "OK!" }"
              }`,
              },
            },
          ],
        },
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
          },
        ],
      },
    );

        // Output parameters
        this.apiEndpointOutput = new cdk.CfnOutput(this, 'APIEndpoint', {
          value: api.url,
          description: 'Endpoint of the API Gateway',
        });
    
        this.dynamoDBTableOutput = new cdk.CfnOutput(this, 'DynamoDBTable', {
          value: storeDBTable.tableName,
          description: 'Name of the DynamoDB table',
        });
    
        this.createStoreItemLambdaOutput = new cdk.CfnOutput(this, 'CreateStoreItemLambda', {
          value: createStoreItemLambda.functionName,
          description: 'Name of the Create Store Item Lambda function',
        });
    
        this.isItemInStockLambdaOutput = new cdk.CfnOutput(this, 'IsItemInStockLambda', {
          value: isItemInStockLambda.functionName,
          description: 'Name of the Is Item In Stock Lambda function',
        });
    
        this.createOrderLambdaOutput = new cdk.CfnOutput(this, 'CreateOrderLambda', {
          value: createOrderLambda.functionName,
          description: 'Name of the Create Order Lambda function',
        });

        this.updateItemStockLambdaOutput = new cdk.CfnOutput(this, 'UpdateItemStockLambda', {
          value: updateItemStockLambda.functionName,
          description: 'Name of the Update Item Stock Lambda function',
        });

      // Output parameter
      new cdk.CfnOutput(this, 'StateMachineARN', {
        value: stateMachine.stateMachineArn,
        description: 'ARN of the Step Functions state machine',
      });


  }
}
