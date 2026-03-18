import { NextResponse } from "next/server";
import { toLocalApiErrorResponse } from "@/lib/localApiError";
import { readJsonBody } from "@/lib/readJsonBody";
import { collectProjectFiles, detectLanguageFromFileList, resolveLocalRoot } from "@/lib/localSource";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { path } = await readJsonBody<{ path?: string }>(request);
    const root = await resolveLocalRoot(path);
    const { tree } = await collectProjectFiles(root, 2000);
    const language = detectLanguageFromFileList(tree.map((f) => f.path));
    return NextResponse.json({
      valid: true,
      data: {
        full_name: root.split("/").filter(Boolean).pop() || root,
        language,
        rootPath: root,
      },
    });
  } catch (error: any) {
    const response = toLocalApiErrorResponse(error, "本地目录校验失败");
    const payload = await response.json();
    return NextResponse.json({ valid: false, ...payload }, { status: response.status });
  }
}
