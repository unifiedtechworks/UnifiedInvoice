export type HttpResponse = Readonly<{
  statusCode: number;
  headers: Readonly<Record<string, string>>;
  body: string;
}>;

export const jsonResponse = (statusCode: number, body: unknown): HttpResponse =>
  Object.freeze({
    statusCode,
    headers: Object.freeze({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
