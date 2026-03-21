"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ googleOAuth }: { googleOAuth: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/settings",
    });

    if (error) {
      setError(error.message || "Invalid credentials");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/settings",
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {googleOAuth && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">or</span>
            </div>
          </div>
          <button
            onClick={handleGoogle}
            className="w-full border py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Sign in with Google
          </button>
        </>
      )}
    </div>
  );
}
