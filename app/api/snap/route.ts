import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { getProjects } from "@/lib/data";

const MODEL = "claude-haiku-4-5";
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  await requireUser();
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const { image, mediaType } = (await req.json()) as {
    image?: string;
    mediaType?: string;
  };
  if (!image || !mediaType || !OK_TYPES.includes(mediaType)) {
    return Response.json({ error: "bad_image" }, { status: 400 });
  }

  const projects = await getProjects();
  const names = projects.map((p) => p.name);

  const client = new Anthropic();
  let raw = "";
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: `You transcribe text from a photo and classify it.
Known projects: ${names.length ? names.join(", ") : "(none)"}.
Return ONLY minified JSON, no prose, no code fence:
{"text": string, "kind": "todo" | "idea" | "reference", "project": string | null}
- "text" is ALL readable text in the image, transcribed faithfully. Fix only obvious
  OCR slips; keep line breaks. If you truly cannot read any text, set "text" to "".
- "kind": "todo" for a clear actionable task; "reference" for a durable fact to keep
  (numbers, dates, addresses, account/spec details, anything you'd look up later);
  "idea" for anything else.
- "project" is one of the known project names if it clearly belongs there, else null.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: image,
              },
            },
            { type: "text", text: "Read and classify this note." },
          ],
        },
      ],
    });
    raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (e) {
    console.error("snap: anthropic call failed", e);
    return Response.json({ error: "read_failed" }, { status: 502 });
  }

  let parsed: { text?: string; kind?: string; project?: string | null } = {};
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    // couldn't parse JSON — if the model just returned prose, use it as-is
    if (raw && !raw.startsWith("{")) {
      return Response.json({ text: raw, kind: "idea", projectId: null, projectName: null });
    }
    return Response.json({ error: "read_failed" }, { status: 502 });
  }

  const text = (parsed.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "empty" }, { status: 422 });
  }

  const kind = ["todo", "reference", "idea"].includes(parsed.kind ?? "")
    ? (parsed.kind as "todo" | "reference" | "idea")
    : "idea";
  const match = parsed.project
    ? projects.find((p) => p.name.toLowerCase() === parsed.project!.toLowerCase())
    : undefined;

  return Response.json({
    text,
    kind,
    projectId: match?.id ?? null,
    projectName: match?.name ?? null,
  });
}
