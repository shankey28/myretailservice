import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')
store_table_name = os.environ['STORE_TABLE_NAME']
table = dynamodb.Table(store_table_name)

def handler(event, context):
    # Extract itemName and quantity from the query parameters
    print(event)
    params = event['item']
    itemName = params['itemName']
    quantity = params['quantity']

    # Retrieve the item from DynamoDB
    response = table.get_item(Key={'PK': 'StoreItem', 'SK': itemName})
    item = response.get('Item')

    if item and 'quantity' in item:
        item_quantity = item['quantity']
        if item_quantity >= quantity:
            message = f'{itemName} is in stock.'
        else:
            raise Exception(f'{itemName} is out of stock.')
    else:
        raise Exception(f'{itemName} does not exist.')

    response = {
        'statusCode': 200,
        'body': json.dumps({'message': message})
    }

    return response
