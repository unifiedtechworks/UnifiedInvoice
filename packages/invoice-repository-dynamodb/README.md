# DynamoDB invoice repository adapter

`@invoice/invoice-repository-dynamodb` is the future durable DynamoDB adapter for the storage-
neutral `@invoice/invoice-repository` port.

Task 011A provides only the public package and factory shape. The factory intentionally throws:

```text
createDynamoDbInvoiceRepository is scaffolded but not implemented. Task 011B will add DynamoDB persistence behavior.
```

The options identify the invoice table and an already-authenticated owner scope. There is no AWS
SDK client, DynamoDB call, partial repository behavior, infrastructure resource, or raw stored-
record write API yet.

## Local commands

```powershell
pnpm --filter @invoice/invoice-repository-dynamodb test
pnpm --filter @invoice/invoice-repository-dynamodb typecheck
pnpm --filter @invoice/invoice-repository-dynamodb lint
pnpm --filter @invoice/invoice-repository-dynamodb build
```

Task 011B will add core lifecycle persistence. List/query behavior may follow in 011C, and API
composition remains separate in 011D or the existing API integration task split.
