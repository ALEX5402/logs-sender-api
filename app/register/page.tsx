"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function RegisterPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Account created!", {
                    description: "You may now log in."
                });
                router.push("/login"); // Redirect to login after register
            } else {
                toast.error("Registration failed", {
                    description: data.message || "Could not create account"
                });
            }
        } catch (error) {
            toast.error("Error", {
                description: "Something went wrong. Please try again."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Create Account
                    </h1>
                    <p className="text-zinc-400 mt-2">First user becomes Admin</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                    <div>
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                            placeholder="username"
                        />
                    </div>

                    <div>
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                    >
                        {loading ? "Creating Account..." : "Register"}
                    </button>

                    <div className="text-center mt-6">
                        <Link href="/login" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                            Already have an account? Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
