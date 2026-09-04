import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { getProjects } from "@/lib/data";

const MODEL = "claude-haiku-4-5";
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const CAP = 20;

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
      max_tokens: 2000,
      system: `You transcribe a photo of notes and split it into separate items.
Known projects: ${names.length ? names.join(", ") : "(none)"}.
Return ONLY minified JSON, no prose, no code fence:
{"items": [{"text": string, "kind": "todo" | "idea", "project": string | null}]}
- One entry per distinct line / bullet / task. A single continuous note is one entry.
- "text": that item transcribed faithfully; fix only obvious OCR slips.
- "kind": "todo" for a clear actionable task; otherwise "idea".
- "project": a known project name if it clearly belongs there, else null.
- If you cannot read any text, return {"items": []}.`,
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
            { type: "text", text: "Read and split this into items." },
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

  let parsed: { items?: { text?: string; kind?: string; project?: string | null }[] } = {};
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return Response.json({ error: "read_failed" }, { status: 502 });
  }

  const all = (parsed.items ?? [])
    .map((it) => ({
      text: (it.text ?? "").trim(),
      kind: it.kind === "todo" ? ("todo" as const) : ("idea" as const),
      project: it.project ?? null,
    }))
    .filter((it) => it.text);

  if (all.length === 0) {
    return Response.json({ error: "empty" }, { status: 422 });
  }

  const kept = all.slice(0, CAP);
  const items = kept.map((it) => {
    const match = it.project
      ? projects.find((p) => p.name.toLowerCase() === it.project!.toLowerCase())
      : undefined;
    return {
      text: it.text,
      kind: it.kind,
      projectId: match?.id ?? null,
    };
  });

  return Response.json({ items, dropped: all.length - kept.length });
}
