import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type GraphListItem } from "../api/client.ts";
import { useAuth } from "../stores/auth.ts";
import ImportModal from "../components/ImportModal.tsx";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [graphs, setGraphs] = useState<GraphListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    try {
      const data = await api.listGraphs();
      setGraphs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deleteGraph = async (id: string) => {
    if (!confirm("Delete this graph?")) return;
    await api.deleteGraph(id);
    setGraphs((g) => g.filter((x) => x.id !== id));
  };

  const onImportSuccess = (graphId: string) => {
    setShowImport(false);
    navigate(`/canvas/${graphId}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">ThreadGraph</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:inline">{user?.email}</span>
            <Link to="/llm-runs" className="text-sm text-gray-400 hover:text-white">LLM Runs</Link>
            <Link to="/settings" className="text-sm text-gray-400 hover:text-white">Settings</Link>
            <button onClick={() => logout()} className="text-sm text-red-400 hover:text-red-300">
              Sign out
            </button>
          </div>
        </div>

        {/* Import button */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-200">Your Graphs</h2>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            + Import thread
          </button>
        </div>

        {/* Graph list */}
        {loading && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && graphs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-700 p-12 text-center">
            <p className="mb-2 text-gray-400">No graphs yet</p>
            <p className="mb-4 text-sm text-gray-600">Paste a Claude.ai or ChatGPT conversation to get started.</p>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Import your first thread
            </button>
          </div>
        )}

        <div className="space-y-3">
          {graphs.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-xl bg-gray-900 px-5 py-4 ring-1 ring-white/5 hover:ring-white/10">
              <div className="min-w-0 flex-1">
                <Link to={`/canvas/${g.id}`} className="block truncate font-medium text-white hover:text-brand-500">
                  {g.title}
                </Link>
                <p className="mt-0.5 text-xs text-gray-500">
                  {g.source_platform} · {new Date(g.created_at).toLocaleDateString()}
                  {g.source_url && (
                    <> · <a href={g.source_url} target="_blank" rel="noreferrer" className="hover:underline">{g.source_url}</a></>
                  )}
                </p>
              </div>
              <div className="ml-4 flex items-center gap-3">
                <Link to={`/canvas/${g.id}`} className="text-xs text-brand-500 hover:underline">
                  Open
                </Link>
                <button onClick={() => deleteGraph(g.id)} className="text-xs text-red-400 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={onImportSuccess}
        />
      )}
    </div>
  );
}
