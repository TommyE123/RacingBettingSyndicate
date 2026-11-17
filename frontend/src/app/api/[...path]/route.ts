// Same-origin proxy to the FastAPI backend, so the session cookie is first-party and the
// browser never needs the backend's address. BACKEND_URL is read at run time.
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type', 'cookie'];
const FORWARDED_RESPONSE_HEADERS = ['cache-control', 'content-type', 'x-content-type-options'];

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
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
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
