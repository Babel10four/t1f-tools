export async function POST(req: Request) {
  try {
    const body = await req.json();

    // placeholder
    return Response.json({ result: "ok" });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
