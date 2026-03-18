import { NextResponse } from "next/server";
import { toLocalApiErrorResponse } from "@/lib/localApiError";
import { readJsonBody } from "@/lib/readJsonBody";
import { collectProjectFiles, readTextContent, resolveLocalRoot } from "@/lib/localSource";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { path, query } = await readJsonBody<{ path?: string; query?: string }>(request);
    const q = String(query || "").trim().toLowerCase();
    if (!q) {
      return NextResponse.json({ error: "Invalid request", items: [] }, { status: 400 });
    }
    const root = await resolveLocalRoot(path);
    const { tree } = await collectProjectFiles(root, 6000);
    const items: Array<{ path: string }> = [];

    for (const entry of tree) {
      if (items.length >= 5) break;
      try {
        const content = await readTextContent(root, entry.path, 300_000);
        if (content.toLowerCase().includes(q)) {
          items.push({ path: entry.path });
        }
      } catch {
        // ignore unreadable/large files in search
      }
    }

    return NextResponse.json({ items });
  } catch (error: any) {
    const response = toLocalApiErrorResponse(error, "本地搜索失败");
    const payload = await response.json();
    return NextResponse.json({ items: [], ...payload }, { status: response.status });
  }
}
