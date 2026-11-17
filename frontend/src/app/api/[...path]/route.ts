// Same-origin proxy to the FastAPI backend, so the session cookie is first-party and the
// browser never needs the backend's address. BACKEND_URL is read at run time.
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Comfortably above the backend's 15 MB photo limit; anything larger is refused here,
// before it is held in memory, whether or not the client sent a Content-Length.
const MAX_BODY_BYTES = 16 * 1024 * 1024;

const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type', 'cookie'];
const FORWARDED_RESPONSE_HEADERS = ['cache-control', 'content-type', 'x-content-type-options'];

class BodyTooLargeError extends Error {}

async function readBody(request: NextRequest): Promise<Uint8Array | undefined> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }
  if (!request.body) {
    return undefined;
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function backendUrl(): string {
  return process.env.BACKEND_URL ?? 'http://localhost:8420';
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const target = new URL(`/api/${path.map((part) => encodeURIComponent(part)).join('/')}`, backendUrl());
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let body: Uint8Array | undefined;
  if (hasBody) {
    try {
      body = await readBody(request);
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        return Response.json({ detail: 'That upload is too large' }, { status: 413 });
      }
      throw error;
    }
  }
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return Response.json({ detail: 'The betting server is not reachable. Try again in a moment.' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }
  const emptyBody = upstream.status === 204 || upstream.status === 304;
  return new Response(emptyBody ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT };
