export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(
  value: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function errorResponse(error: unknown): Response {
  const failure =
    error instanceof ApiError
      ? error
      : new ApiError(
          500,
          'INTERNAL_ERROR',
          'The recorded report service could not complete the request.',
        );
  return json(
    { demo: true, error: { code: failure.code, message: failure.message } },
    failure.status,
  );
}

export function endpoint(
  method: string,
  handler: (request: Request) => Response | Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== method)
      return json(
        {
          demo: true,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Use ${method} for this endpoint.`,
          },
        },
        405,
        { Allow: method },
      );
    try {
      if (new URL(request.url).search)
        throw new ApiError(400, 'INVALID_REQUEST', 'Query parameters are not supported.');
      if (
        method === 'GET' &&
        (Number(request.headers.get('content-length') ?? 0) > 0 ||
          request.headers.has('transfer-encoding'))
      )
        throw new ApiError(400, 'INVALID_REQUEST', 'GET endpoints do not accept request bodies.');
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const MAX_BODY_BYTES = 1024;
const BODY_TIMEOUT_MS = 5000;

/** Count actual UTF-8 bytes as they arrive, even without Content-Length. */
export async function readJson(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length !== null) {
    if (!/^\d+$/.test(length))
      throw new ApiError(400, 'INVALID_REQUEST', 'Content-Length must be a nonnegative integer.');
    if (Number(length) > MAX_BODY_BYTES)
      throw new ApiError(
        413,
        'PAYLOAD_TOO_LARGE',
        `JSON bodies must not exceed ${MAX_BODY_BYTES} bytes.`,
      );
  }
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get('content-type') ?? '',
    ) ||
    !['identity', null].includes(request.headers.get('content-encoding'))
  ) {
    throw new ApiError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Use uncompressed application/json with UTF-8 encoding.',
    );
  }
  if (!request.body) throw new ApiError(400, 'INVALID_JSON', 'A JSON request body is required.');
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new ApiError(408, 'REQUEST_TIMEOUT', 'The request body took too long to arrive.')),
      BODY_TIMEOUT_MS,
    );
  });
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES)
        throw new ApiError(
          413,
          'PAYLOAD_TOO_LARGE',
          `JSON bodies must not exceed ${MAX_BODY_BYTES} bytes.`,
        );
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'The body must contain valid UTF-8 JSON.');
    }
  } finally {
    clearTimeout(timer);
    // Do not cancel a Node-backed request stream and destroy its response socket.
    reader.releaseLock();
  }
}
