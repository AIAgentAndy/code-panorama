import { NextResponse } from "next/server";

const LOCAL_PATH_NOT_FOUND_MESSAGE = "指定路径不存在或不是目录";

export function getLocalApiErrorPayload(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : String(error || fallbackMessage);
  if (message === LOCAL_PATH_NOT_FOUND_MESSAGE) {
    return {
      status: 400,
      body: {
        error: message,
        code: "LOCAL_PATH_NOT_FOUND",
      },
    };
  }

  return {
    status: 400,
    body: {
      error: message || fallbackMessage,
    },
  };
}

export function toLocalApiErrorResponse(error: unknown, fallbackMessage: string) {
  const payload = getLocalApiErrorPayload(error, fallbackMessage);
  return NextResponse.json(payload.body, { status: payload.status });
}
