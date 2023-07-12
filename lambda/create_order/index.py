import json
import os
import uuid
import boto3

dynamodb = boto3.resource('dynamodb')
store_table_name = os.environ['STORE_TABLE_NAME']
table = dynamodb.Table(store_table_name)

def handler(event, context):
    # Extract the array of items from the event JSON
    body = json.loads(event['body'])
    items = body['items']

    # Generate a random UUID as the SK for the order
    order_id = str(uuid.uuid4())

    # Prepare the item for storing in DynamoDB
    item = {
        'PK': 'Order',
        'SK': order_id,
        'order': items
    }

    # Store the order in DynamoDB
    table.put_item(Item=item)

    response = {
        'statusCode': 200,
        'body': json.dumps({'message': f'Order {order_id} created successfully.'})
    }

    return response
