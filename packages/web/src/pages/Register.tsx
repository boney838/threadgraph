import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client.ts";
import { useAuth } from "../stores/auth.ts";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const check = useAuth((s) => s.check);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.register(email, password);
      await check();
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-3xl font-bold text-white">ThreadGraph</h1>
        <p className="mb-8 text-center text-sm text-gray-400">Transform AI chats into knowledge graphs</p>

        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-gray-900 p-8 shadow-xl ring-1 ring-white/5">
          <h2 className="text-lg font-semibold text-white">Create account</h2>

          {error && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-xs text-gray-500">
            Have an account?{" "}
            <Link to="/login" className="text-brand-500 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
