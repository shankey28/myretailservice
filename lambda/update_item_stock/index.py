import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')
store_table_name = os.environ['STORE_TABLE_NAME']
table = dynamodb.Table(store_table_name)

def handler(event, context):
    print(event)
    # Extract itemName and quantity from the event JSON
    body = event['item']
    itemName = body['itemName']
    quantity = body['quantity']

    # Update the item quantity in DynamoDB
    response = table.update_item(
        Key={'PK': 'StoreItem', 'SK': itemName},
        UpdateExpression='SET quantity = quantity - :qty',
        ExpressionAttributeValues={':qty': quantity},
        ReturnValues='ALL_NEW'
    )
    updated_item = response.get('Attributes')

    if updated_item and 'quantity' in updated_item:
        updated_quantity = updated_item['quantity']
        message = f'Quantity of {itemName} updated to {updated_quantity}.'
    else:
        message = f'Failed to update the quantity of {itemName}.'

    response = {
        'statusCode': 200,
        'body': json.dumps({'message': message})
    }

    return response
