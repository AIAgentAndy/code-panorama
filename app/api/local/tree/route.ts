import { NextResponse } from "next/server";
import { toLocalApiErrorResponse } from "@/lib/localApiError";
import { readJsonBody } from "@/lib/readJsonBody";
import { collectProjectFiles, resolveLocalRoot } from "@/lib/localSource";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { path } = await readJsonBody<{ path?: string }>(request);
    const root = await resolveLocalRoot(path);
    const { tree, truncated } = await collectProjectFiles(root, 10000);
    return NextResponse.json({ tree, truncated });
  } catch (error: any) {
    return toLocalApiErrorResponse(error, "读取本地目录树失败");
  }
}
