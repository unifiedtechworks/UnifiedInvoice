import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

type Item = Record<string, unknown>;

const keyOf = (value: Item): string => `${String(value.PK)}|${String(value.SK)}`;
const clone = <T>(value: T): T => structuredClone(value);
const namedError = (name: string): Error => Object.assign(new Error(name), { name });

const conditionMatches = (existing: Item | undefined, input: Record<string, unknown>): boolean => {
  const expression = input.ConditionExpression;
  const values = input.ExpressionAttributeValues as Record<string, unknown> | undefined;
  if (typeof expression !== 'string') return true;
  if (expression.startsWith('attribute_not_exists')) {
    if (existing === undefined) return true;
    return values?.[':invoiceId'] !== undefined && existing.invoiceId === values[':invoiceId'];
  }
  if (existing === undefined) return false;
  if (values?.[':expectedVersion'] !== undefined) {
    const record = existing.record as Item | undefined;
    return (
      record?.version === values[':expectedVersion'] && record.kind === values[':expectedKind']
    );
  }
  if (values?.[':invoiceId'] !== undefined) return existing.invoiceId === values[':invoiceId'];
  return true;
};

export class FakeDynamoDbDocumentClient {
  private items = new Map<string, Item>();
  private nextError: unknown;
  private commandError: Readonly<{ commandName: string; error: unknown }> | undefined;

  asClient(): DynamoDBDocumentClient {
    return this as unknown as DynamoDBDocumentClient;
  }

  failNext(error: unknown): void {
    this.nextError = error;
  }

  failNextCommand(commandName: string, error: unknown): void {
    this.commandError = { commandName, error };
  }

  getItem(pk: string, sk: string): Item | undefined {
    const item = this.items.get(`${pk}|${sk}`);
    return item === undefined ? undefined : clone(item);
  }

  setItem(item: Item): void {
    this.items.set(keyOf(item), clone(item));
  }

  deleteItem(pk: string, sk: string): void {
    this.items.delete(`${pk}|${sk}`);
  }

  async send(command: unknown): Promise<Record<string, unknown>> {
    if (this.nextError !== undefined) {
      const error = this.nextError;
      this.nextError = undefined;
      throw error;
    }
    if (
      this.commandError !== undefined &&
      isObjectWithConstructorName(command, this.commandError.commandName)
    ) {
      const error = this.commandError.error;
      this.commandError = undefined;
      throw error;
    }
    if (command instanceof GetCommand) {
      const key = command.input.Key as Item;
      const item = this.items.get(keyOf(key));
      return item === undefined ? {} : { Item: clone(item) };
    }
    if (command instanceof PutCommand) {
      const item = command.input.Item as Item;
      const existing = this.items.get(keyOf(item));
      if (!conditionMatches(existing, command.input as Record<string, unknown>))
        throw namedError('ConditionalCheckFailedException');
      this.items.set(keyOf(item), clone(item));
      return {};
    }
    if (command instanceof DeleteCommand) {
      const key = command.input.Key as Item;
      const existing = this.items.get(keyOf(key));
      if (!conditionMatches(existing, command.input as Record<string, unknown>))
        throw namedError('ConditionalCheckFailedException');
      this.items.delete(keyOf(key));
      return {};
    }
    if (command instanceof TransactWriteCommand) {
      const transactionItems = new Map(this.items);
      try {
        for (const operation of command.input.TransactItems ?? []) {
          if (operation.ConditionCheck !== undefined) {
            const key = operation.ConditionCheck.Key as Item;
            const existing = transactionItems.get(keyOf(key));
            if (!conditionMatches(existing, operation.ConditionCheck as Record<string, unknown>))
              throw namedError('ConditionalCheckFailedException');
          }
          if (operation.Put !== undefined) {
            const item = operation.Put.Item as Item;
            const existing = transactionItems.get(keyOf(item));
            if (!conditionMatches(existing, operation.Put as Record<string, unknown>))
              throw namedError('ConditionalCheckFailedException');
            transactionItems.set(keyOf(item), clone(item));
          }
        }
      } catch {
        throw namedError('TransactionCanceledException');
      }
      this.items = transactionItems;
      return {};
    }
    throw new Error('Unsupported fake DynamoDB command.');
  }
}

const isObjectWithConstructorName = (value: unknown, name: string): boolean =>
  typeof value === 'object' && value !== null && value.constructor.name === name;
