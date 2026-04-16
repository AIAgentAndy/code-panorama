import { NextResponse } from "next/server";
import { toLocalApiErrorResponse } from "@/lib/localApiError";
import { readJsonBody } from "@/lib/readJsonBody";
import { resolveLocalRoot, writeDocFile } from "@/lib/localSource";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { path, moduleName, file, content } = await readJsonBody<{ path?: string; moduleName?: string; file?: string; content?: string }>(request);
    
    if (!path || !file || !content) {
      return NextResponse.json({ error: "Invalid request, missing path, file or content" }, { status: 400 });
    }
    
    const root = await resolveLocalRoot(path);
    const finalPath = await writeDocFile(root, moduleName || "Other", file, content);

    return NextResponse.json({ success: true, writtenTo: finalPath });
  } catch (error: any) {
    return toLocalApiErrorResponse(error, "写入本地文件失败");
  }
}
