import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Disc3, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("requestPasswordReset", { email });
      if (res.data?.ok) setSent(true);
      else setError(res.data?.error || "Something went wrong.");
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Disc3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">DJ Command</h1>
            <p className="text-xs text-gray-400">Event CRM Platform</p>
          </div>
        </div>

        {sent ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
            <p className="text-sm text-gray-500">If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.</p>
            <button onClick={() => base44.auth.redirectToLogin()} className="text-sm text-violet-600 hover:underline">
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Forgot password?</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send you a reset link.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send Reset Link
              </Button>
              <button type="button" onClick={() => base44.auth.redirectToLogin()} className="w-full text-sm text-gray-400 hover:text-gray-600">
                Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}