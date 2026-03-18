export async function readJsonBody<T>(request: Request): Promise<T> {
  const raw = await request.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error("请求体为空");
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
}
