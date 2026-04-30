import { useState, useEffect, useRef } from "react";
import { api } from "../api/client.ts";

interface Props {
  onClose: () => void;
  onSuccess: (graphId: string) => void;
}

type Stage = "form" | "processing" | "done" | "error";

interface ParsedFile {
  transcript: string;
  title?: string;
  sourceUrl?: string;
}

function parseChatGPTJson(raw: string): ParsedFile {
  const json = JSON.parse(raw);

  // Format 1: ChatGPT Exporter extension — { metadata, messages: [{ role, say, time }] }
  if (json.messages && Array.isArray(json.messages)) {
    const lines: string[] = [];
    for (const msg of json.messages as { role: string; say: string }[]) {
      const role = msg.role === "Prompt" ? "You" : "ChatGPT";
      const text = (msg.say ?? "").trim();
      if (text) lines.push(`${role}:\n${text}`);
    }
    if (!lines.length) throw new Error("No messages found in export file");
    return {
      transcript: lines.join("\n\n"),
      title: json.metadata?.title || undefined,
      sourceUrl: json.metadata?.link || undefined,
    };
  }

  // Format 2: Official ChatGPT data export — single conv or array with mapping object
  const conv = Array.isArray(json) ? json[0] : json;
  if (conv?.mapping) {
    const nodes = Object.values(conv.mapping) as {
      message?: {
        author: { role: string };
        content: { parts: unknown[] };
        create_time?: number;
      };
    }[];

    const messages = nodes
      .filter(
        (n) =>
          n.message?.content?.parts?.length &&
          n.message.author.role !== "system"
      )
      .sort(
        (a, b) => (a.message!.create_time ?? 0) - (b.message!.create_time ?? 0)
      );

    const lines: string[] = [];
    for (const node of messages) {
      const role = node.message!.author.role === "user" ? "You" : "ChatGPT";
      const text = node.message!.content.parts
        .filter((p) => typeof p === "string")
        .join("\n")
        .trim();
      if (text) lines.push(`${role}:\n${text}`);
    }
    if (!lines.length) throw new Error("No messages found in export file");
    return {
      transcript: lines.join("\n\n"),
      title: conv.title || undefined,
    };
  }

  throw new Error("Unrecognized ChatGPT export format");
}

async function readFileAsTranscript(file: File): Promise<ParsedFile> {
  const text = await file.text();
  if (file.name.endsWith(".json")) return parseChatGPTJson(text);
  return { transcript: text };
}

export default function ImportModal({ onClose, onSuccess }: Props) {
  const [stage, setStage] = useState<Stage>("form");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [graphId, setGraphId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    setStage("processing");
    try {
      let parsed: ParsedFile;
      try {
        parsed = await readFileAsTranscript(file);
      } catch (parseErr) {
        setError(parseErr instanceof Error ? parseErr.message : "Could not read file");
        setStage("error");
        return;
      }

      const { jobId } = await api.createJob({
        transcript: parsed.transcript,
        source_platform: "chatgpt",
        source_url: sourceUrl || parsed.sourceUrl || undefined,
        title: title || parsed.title || file.name.replace(/\.[^.]+$/, "") || undefined,
      });

      pollRef.current = setInterval(async () => {
        const result = await api.pollJob(jobId).catch(() => null);
        if (!result) return;
        if (result.status === "complete" && result.graphId) {
          clearInterval(pollRef.current!);
          setGraphId(result.graphId);
          setStage("done");
        } else if (result.status === "failed") {
          clearInterval(pollRef.current!);
          setError(result.error ?? "Pipeline failed");
          setStage("error");
        }
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start job");
      setStage("error");
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 p-6 shadow-2xl ring-1 ring-white/10">

        {stage === "form" && (
          <form onSubmit={startJob} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Import ChatGPT thread</h2>
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Export file <span className="text-gray-600">(.txt or .json)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-gray-800 px-4 py-3 ring-1 ring-white/10 hover:ring-brand-500 transition-all">
                <span className="text-lg">📂</span>
                <span className="flex-1 truncate text-sm text-gray-300">
                  {file ? file.name : "Choose file…"}
                </span>
                <input
                  type="file"
                  accept=".txt,.json,.md"
                  required
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f?.name.endsWith(".json")) {
                      try {
                        const parsed = await readFileAsTranscript(f);
                        if (parsed.title) setTitle(parsed.title);
                        if (parsed.sourceUrl) setSourceUrl(parsed.sourceUrl);
                      } catch {
                        // leave fields as-is if parse fails early
                      }
                    }
                  }}
                />
              </label>
              <p className="mt-1 text-xs text-gray-600">
                Export a conversation from ChatGPT → Share → Export, or use the ChatGPT data export (.json)
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Title <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My thread"
                className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Source URL <span className="text-gray-600">(optional)</span></label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://chatgpt.com/c/..."
                className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
              >
                Parse thread
              </button>
            </div>
          </form>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="text-white font-medium">Parsing your thread…</p>
            <p className="mt-1 text-sm text-gray-400">~15 seconds · you can close this window</p>
          </div>
        )}

        {stage === "done" && graphId && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 text-4xl">✅</div>
            <p className="text-white font-medium">Graph ready!</p>
            <button
              onClick={() => onSuccess(graphId)}
              className="mt-4 rounded-lg bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Open graph →
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <p className="text-white font-medium">Parsing failed</p>
            <p className="mt-1 text-sm text-red-400">{error}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStage("form")} className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                Try again
              </button>
              <button onClick={onClose} className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
