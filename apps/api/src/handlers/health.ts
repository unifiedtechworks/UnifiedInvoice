import { jsonResponse, type HttpResponse } from '../http/response';

const healthBody = Object.freeze({
  ok: true,
  service: 'unified-invoice-api',
});

export const healthHandler = async (): Promise<HttpResponse> => jsonResponse(200, healthBody);
