import type { RawTurn } from "@threadgraph/shared";

// Parse a raw transcript string (Claude.ai or ChatGPT export format) into RawTurn[].
// Claude.ai uses "**Prompt** HH:MM AM/PM" and "**Response** HH:MM AM/PM" headers.
// ChatGPT uses "You" / "ChatGPT" headers or similar.
// We handle both by detecting role-like prefixes at the start of lines.

const CLAUDE_TURN_RE = /^\*\*(Prompt|Response)\*\*\s+(.+)?$/;
const CHATGPT_TURN_RE = /^(You|User|Human|ChatGPT|Assistant|GPT-4?[o\d]*):?\s*(.*)$/i;

interface TurnAccumulator {
  role: "Prompt" | "Response";
  time: string;
  lines: string[];
}

export function parseTranscript(
  raw: string,
  platform: "claude" | "chatgpt"
): RawTurn[] {
  const lines = raw.split("\n");
  const turns: RawTurn[] = [];
  let current: TurnAccumulator | null = null;

  const flush = () => {
    if (current) {
      turns.push({
        turn: turns.length,
        role: current.role,
        time: current.time,
        content: current.lines.join("\n").trim(),
      });
      current = null;
    }
  };

  for (const line of lines) {
    // Try platform-specific header detection
    if (platform === "claude") {
      const m = CLAUDE_TURN_RE.exec(line.trim());
      if (m) {
        flush();
        current = {
          role: m[1] as "Prompt" | "Response",
          time: m[2]?.trim() ?? "",
          lines: [],
        };
        continue;
      }
    } else {
      // ChatGPT / generic
      const m = CHATGPT_TURN_RE.exec(line.trim());
      if (m) {
        const rawRole = m[1].toLowerCase();
        const isHuman =
          rawRole === "you" || rawRole === "user" || rawRole === "human";
        flush();
        current = {
          role: isHuman ? "Prompt" : "Response",
          time: "",
          lines: m[2] ? [m[2]] : [],
        };
        continue;
      }
    }

    if (current) {
      current.lines.push(line);
    }
  }

  flush();

  // Fallback: if nothing parsed, treat entire transcript as a single human turn
  if (turns.length === 0) {
    turns.push({ turn: 0, role: "Prompt", time: "", content: raw.trim() });
  }

  return turns;
}

export function turnsToTranscriptString(turns: RawTurn[]): string {
  return turns
    .map((t) => `[Turn ${t.turn}] ${t.role} ${t.time ? `(${t.time})` : ""}:\n${t.content}`)
    .join("\n\n---\n\n");
}
