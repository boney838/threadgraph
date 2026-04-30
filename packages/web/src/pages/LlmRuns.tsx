import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GraphListItem, type PassUsage } from "../api/client.ts";
import { useAuth } from "../stores/auth.ts";

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function PassRow({ pass }: { pass: PassUsage }) {
  const label: Record<string, string> = { pass1: "Pass 1", pass2: "Pass 2", pass3: "Pass 3" };
  return (
    <tr className="border-t border-gray-800">
      <td className="py-2 pr-4 text-xs font-medium text-gray-400">{label[pass.pass] ?? pass.pass}</td>
      <td className="py-2 pr-4 text-right text-xs tabular-nums text-gray-300">{fmt(pass.inputTokens)}</td>
      <td className="py-2 pr-4 text-right text-xs tabular-nums text-gray-300">{fmt(pass.outputTokens)}</td>
      <td className="py-2 text-right text-xs tabular-nums text-gray-300">{fmtCost(pass.costUsd)}</td>
    </tr>
  );
}

function GraphRunCard({ graph }: { graph: GraphListItem }) {
  const usage = graph.usage_json;

  return (
    <div className="rounded-xl bg-gray-900 px-5 py-4 ring-1 ring-white/5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to={`/canvas/${graph.id}`} className="block truncate font-medium text-white hover:text-brand-500">
            {graph.title}
          </Link>
          <p className="mt-0.5 text-xs text-gray-500">
            {graph.source_platform} · {new Date(graph.created_at).toLocaleDateString()}
          </p>
        </div>
        {usage && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-white">{fmtCost(usage.totalCostUsd)}</p>
            <p className="text-xs text-gray-500">{fmt(usage.totalInputTokens + usage.totalOutputTokens)} tokens</p>
          </div>
        )}
      </div>

      {usage ? (
        <table className="w-full">
          <thead>
            <tr>
              <th className="pb-1 text-left text-xs text-gray-600">Pass</th>
              <th className="pb-1 text-right text-xs text-gray-600">Input tokens</th>
              <th className="pb-1 text-right text-xs text-gray-600">Output tokens</th>
              <th className="pb-1 text-right text-xs text-gray-600">Cost</th>
            </tr>
          </thead>
          <tbody>
            {usage.passes.map((p) => (
              <PassRow key={p.pass} pass={p} />
            ))}
            <tr className="border-t border-gray-700">
              <td className="pt-2 pr-4 text-xs font-semibold text-gray-300">Total</td>
              <td className="pt-2 pr-4 text-right text-xs font-semibold tabular-nums text-gray-300">
                {fmt(usage.totalInputTokens)}
              </td>
              <td className="pt-2 pr-4 text-right text-xs font-semibold tabular-nums text-gray-300">
                {fmt(usage.totalOutputTokens)}
              </td>
              <td className="pt-2 text-right text-xs font-semibold tabular-nums text-white">
                {fmtCost(usage.totalCostUsd)}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-gray-600">No usage data — processed before tracking was enabled.</p>
      )}
    </div>
  );
}

export default function LlmRuns() {
  const { user, logout } = useAuth();
  const [graphs, setGraphs] = useState<GraphListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listGraphs().then(setGraphs).finally(() => setLoading(false));
  }, []);

  const withUsage = graphs.filter((g) => g.usage_json);
  const totalCost = withUsage.reduce((sum, g) => sum + (g.usage_json?.totalCostUsd ?? 0), 0);
  const totalTokens = withUsage.reduce(
    (sum, g) => sum + (g.usage_json?.totalInputTokens ?? 0) + (g.usage_json?.totalOutputTokens ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">ThreadGraph</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:inline">{user?.email}</span>
            <Link to="/" className="text-sm text-gray-400 hover:text-white">Graphs</Link>
            <Link to="/llm-runs" className="text-sm text-white">LLM Runs</Link>
            <Link to="/settings" className="text-sm text-gray-400 hover:text-white">Settings</Link>
            <button onClick={() => logout()} className="text-sm text-red-400 hover:text-red-300">
              Sign out
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {!loading && withUsage.length > 0 && (
          <div className="mb-6 flex items-center gap-6 rounded-xl bg-gray-900 px-5 py-4 ring-1 ring-white/5">
            <div>
              <p className="text-xs text-gray-500">Total cost</p>
              <p className="text-lg font-semibold text-white">{fmtCost(totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total tokens</p>
              <p className="text-lg font-semibold text-white">{fmt(totalTokens)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Runs tracked</p>
              <p className="text-lg font-semibold text-white">{withUsage.length}</p>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-200">LLM Runs</h2>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && graphs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-700 p-12 text-center">
            <p className="text-gray-400">No transcripts yet.</p>
            <p className="mt-1 text-sm text-gray-600">Import a thread from the <Link to="/" className="text-brand-500 hover:underline">Graphs</Link> page to get started.</p>
          </div>
        )}

        <div className="space-y-4">
          {graphs.map((g) => (
            <GraphRunCard key={g.id} graph={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
