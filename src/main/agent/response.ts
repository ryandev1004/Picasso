import Anthropic from "@anthropic-ai/sdk";
import type { AgentResponse } from "@shared/ipc";
import { MODEL, EFFORT, MAX_TOKENS, SYSTEM_PROMPT } from "./prompts";
import { readApiKey } from "../settings";

export async function generateDiagram(prompt: string): Promise<AgentResponse> {
  // Read the key on every call, so a key saved or changed in Settings is used right away.
  const apiKey = await readApiKey();
  if (!apiKey)
    return { ok: false, error: "Add your Claude API key in Settings first." };

  const client = new Anthropic({ apiKey });
  const started = Date.now();

  let message: Anthropic.Message;
  try {
    message = await client.messages
      .stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        output_config: { effort: EFFORT },
        messages: [{ role: "user", content: prompt }],
      })
      .finalMessage();
  } catch (error) {
    console.error("[picasso] Claude request failed:", error);
    return { ok: false, error: describeError(error) };
  }

  // Speed and token counts, for picking the model and effort later.
  console.log(
    `[picasso] diagram took ${Date.now() - started}ms`,
    message.usage,
  );

  // Check why Claude stopped before trusting what it wrote.
  if (message.stop_reason === "max_tokens") {
    return {
      ok: false,
      error:
        "The diagram got too big and was cut off. Try asking for something simpler.",
    };
  }
  if (message.stop_reason === "refusal") {
    return {
      ok: false,
      error: "Claude declined to draw that. Try describing it differently.",
    };
  }

  // The reply can also contain thinking blocks; only text blocks hold the SVG.
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  const start = text.indexOf("<svg");
  const end = text.lastIndexOf("</svg>");
  if (start === -1 || end < start) {
    return {
      ok: false,
      error: "Claude didn't send back a diagram. Try again.",
    };
  }

  return { ok: true, svg: text.slice(start, end + "</svg>".length) };
}

/** Turns an SDK error into a message for the user. Most specific checks come first. */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError)
    return "Your API key was rejected. Check it in Settings.";
  if (error instanceof Anthropic.RateLimitError)
    return "Too many requests right now. Wait a moment and try again.";
  if (error instanceof Anthropic.APIConnectionError)
    return "Can't reach Claude. Check your internet connection.";
  if (error instanceof Anthropic.APIError)
    return `Claude returned an error (${error.status}). Try again.`;
  return "Something went wrong while drawing. Try again.";
}
