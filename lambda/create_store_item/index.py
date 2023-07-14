import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')
store_table_name = os.environ['STORE_TABLE_NAME']
table = dynamodb.Table(store_table_name)

def handler(event, context):
    # Extract itemName and quantity from the event JSON
    body = json.loads(event['body'])
    itemName = body['itemName']
    quantity = int(body['quantity'])
    
    # Store the values in DynamoDB
    item = {
        'PK': 'StoreItem',
        'SK': itemName,
        'quantity': quantity
    }
    table.put_item(Item=item)
    
    response = {
        'statusCode': 200,
        'body': json.dumps({'message': 'Store item created successfully.'})
    }
    
    return response
