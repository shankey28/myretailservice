import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Duration } from 'aws-cdk-lib/core';

export class MyRetailServicesStack extends cdk.Stack {
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

    // Grant DynamoDB read/write permissions to the Lambda functions
    storeDBTable.grantReadWriteData(createStoreItemLambda);
    storeDBTable.grantReadWriteData(isItemInStockLambda);
    storeDBTable.grantReadWriteData(createOrderLambda);

    // API Gateway
    const api = new apigw.RestApi(this, 'MyRetailAPI');

    const createStoreItemIntegration = new apigw.LambdaIntegration(createStoreItemLambda);
    api.root.addResource('create-store-item').addMethod('POST', createStoreItemIntegration);

    const isItemInStockIntegration = new apigw.LambdaIntegration(isItemInStockLambda);
    api.root.addResource('is-item-in-stock').addMethod('GET', isItemInStockIntegration);

    const createOrderIntegration = new apigw.LambdaIntegration(createOrderLambda);
    api.root.addResource('create-order').addMethod('POST', createOrderIntegration);
  }
}
