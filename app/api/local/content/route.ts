import { NextResponse } from "next/server";
import { toLocalApiErrorResponse } from "@/lib/localApiError";
import { readJsonBody } from "@/lib/readJsonBody";
import { readTextContent, resolveLocalRoot } from "@/lib/localSource";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { path, paths } = await readJsonBody<{ path?: string; paths?: string[] }>(request);
    if (!Array.isArray(paths)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const root = await resolveLocalRoot(path);
    const contents: Record<string, string> = {};
    const errors: Record<string, string> = {};

    await Promise.all(
      paths.map(async (filePath: string) => {
        try {
          contents[filePath] = await readTextContent(root, filePath);
        } catch (error: any) {
          contents[filePath] = "";
          errors[filePath] = error?.message || "读取文件失败";
        }
      }),
    );

    return NextResponse.json({ contents, errors });
  } catch (error: any) {
    return toLocalApiErrorResponse(error, "读取本地文件失败");
  }
}
