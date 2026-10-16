import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;
    const subPath = path.join("/");
    const targetUrl = new URL(`${BACKEND_URL}/api/v1/${subPath}`);
    targetUrl.search = request.nextUrl.search;

    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete("host");
    reqHeaders.delete("connection");

    const method = request.method;
    const body = ["GET", "HEAD"].includes(method)
      ? undefined
      : await request.arrayBuffer();

    const response = await fetch(targetUrl.toString(), {
      method,
      headers: reqHeaders,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const resHeaders = new Headers(response.headers);
    // Remove content-encoding to avoid double-compression issues
    resHeaders.delete("content-encoding");

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  } catch (error: any) {
    const isConnRefused =
      error?.cause?.code === "ECONNREFUSED" ||
      error?.code === "ECONNREFUSED" ||
      error?.message?.includes("ECONNREFUSED") ||
      error?.cause?.syscall === "connect";

    if (isConnRefused) {
      console.warn(`[API Proxy] Backend server is unreachable at ${BACKEND_URL} (offline).`);
      return NextResponse.json(
        {
          success: false,
          error: "server_unavailable",
          message: "The server is unavailable right now.",
        },
        { status: 503 }
      );
    }

    console.error("API proxy error:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: "proxy_error",
        message: `Failed to proxy request to backend: ${error?.message || error}`,
      },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
