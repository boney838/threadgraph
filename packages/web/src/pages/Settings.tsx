import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.ts";
import { useAuth } from "../stores/auth.ts";

export default function Settings() {
  const { user, logout } = useAuth();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    api.getApiKey().then((r) => setConfigured(r.configured)).catch(() => setConfigured(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      await api.setApiKey(apiKey);
      setConfigured(true);
      setApiKey("");
      setMsg({ type: "ok", text: "API key saved." });
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setMsg(null);
    await api.deleteApiKey();
    setConfigured(false);
    setMsg({ type: "ok", text: "API key removed." });
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-white">← Dashboard</Link>
            <h1 className="text-xl font-semibold text-white">Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button onClick={() => logout()} className="text-sm text-red-400 hover:text-red-300">
              Sign out
            </button>
          </div>
        </div>

        {/* API Key card */}
        <div className="rounded-2xl bg-gray-900 p-6 ring-1 ring-white/5">
          <h2 className="mb-1 text-base font-semibold text-white">Anthropic API Key</h2>
          <p className="mb-4 text-sm text-gray-400">
            Your key is stored encrypted. It is only used to run the parsing pipeline on your behalf.
          </p>

          {configured === null && <p className="text-sm text-gray-500">Loading…</p>}

          {configured === true && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-green-900/30 px-4 py-3">
              <span className="text-sm text-green-300">✓ API key configured</span>
              <button onClick={remove} className="ml-auto text-xs text-red-400 hover:underline">
                Remove
              </button>
            </div>
          )}

          {msg && (
            <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.type === "ok" ? "bg-green-900/30 text-green-300" : "bg-red-900/40 text-red-300"}`}>
              {msg.text}
            </p>
          )}

          <form onSubmit={save} className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={saving || !apiKey}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : configured ? "Update" : "Save"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
