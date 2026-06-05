import { NextResponse } from "next/server";
import {
  buildOpsContext,
  localAnswer,
  type CopilotMessage,
} from "@/lib/copilot";

export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

/**
 * The standing system instruction. The OBSERVE-AND-ADVISE boundary (§4 of
 * docs/OWNERS_PROJECT_REQUIREMENTS.md) is stated first and unconditionally.
 */
const SAFETY_SYSTEM = [
  "You are the ATLAS OS ops copilot, an assistant for operators of an ATLAS",
  'self-sufficient habitat building. You are OBSERVE-AND-ADVISE ONLY: you',
  "summarize state, explain incidents, and draft communications. You MUST",
  "NEVER instruct anyone to override, bypass, disable, or substitute for",
  "life-safety, fire, egress, electrical-isolation, biogas, BMS, or PLC",
  "controls. Deterministic safety-rated controls hold those functions and your",
  "advice is never a prerequisite for any life-safety action (per §4, the",
  "non-negotiable safety boundary). If asked to take or direct a control",
  "action, decline and advise escalation to the responsible operator and the",
  "deterministic control system.",
  "",
  "Ground every answer in the ATLAS-01 ops snapshot below. Be concise and",
  "operational. If the snapshot lacks the data to answer, say so plainly.",
].join("\n");

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

/** Narrow unknown input into a clean CopilotMessage[] or return null. */
function parseMessages(value: unknown): CopilotMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: CopilotMessage[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const { role, content } = raw as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.trim().length === 0) return null;
    out.push({ role, content });
  }
  // The last turn must come from the user for the copilot to answer.
  if (out[out.length - 1].role !== "user") return null;
  return out;
}

// POST /api/copilot — answer an operator question, grounded in live ops state.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = parseMessages((body as Record<string, unknown>)?.messages);
  if (!messages) {
    return NextResponse.json(
      {
        error:
          "`messages` must be a non-empty array of {role, content}, ending with a user turn.",
      },
      { status: 400 },
    );
  }

  const ctx = await buildOpsContext();
  const lastUser = messages[messages.length - 1].content;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const model = process.env.ATLAS_COPILOT_MODEL ?? DEFAULT_MODEL;
      const upstream = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          // The large static system + grounding block is marked cacheable so
          // repeated turns hit the prompt cache.
          system: [
            {
              type: "text",
              text: `${SAFETY_SYSTEM}\n\n${ctx.grounding}`,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!upstream.ok) throw new Error(`Anthropic ${upstream.status}`);

      const data = (await upstream.json()) as AnthropicResponse;
      const reply =
        data.content
          ?.filter((b) => b.type === "text" && typeof b.text === "string")
          .map((b) => b.text)
          .join("")
          .trim() ?? "";

      if (!reply) throw new Error("Empty completion");

      return NextResponse.json({
        reply,
        grounded: true,
        source: "anthropic" as const,
      });
    } catch {
      // Fall through to the deterministic local answer so the app stays
      // local-first and resilient to upstream failures.
    }
  }

  return NextResponse.json({
    reply: localAnswer(lastUser, ctx),
    grounded: true,
    source: "local" as const,
  });
}
