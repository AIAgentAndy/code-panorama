import { NextResponse } from "next/server";
import { llmApiKey, llmBaseUrl, llmModel } from "@/lib/openaiCompat";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      llmBaseUrl: llmBaseUrl || "",
      llmModel: llmModel || "",
      llmApiKey: llmApiKey || "",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
