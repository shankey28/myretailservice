# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

# myretailservice

This application uses a combination of lambda functions, API gateway and step functions to create a microservice architecture pattern with separation of concerns.

Sample json to create store item using /create-store-item API gateway endpoint:

```
{
    "itemName":"Mango",
    quantity:10
}
```

Sample json to test the service using /myretail API gateway endpoint:

```
[
    {
        "itemName": "Mango",
        "quantity":,2

    }
]
```
