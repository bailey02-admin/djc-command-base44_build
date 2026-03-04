import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Disc3, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function AcceptInvite() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!token) { setError("Missing invite token. Please use the link from your email."); return; }

    setLoading(true);
    try {
      const res = await base44.functions.invoke("acceptInvite", { token, password });
      if (res.data?.ok) {
        setDone(true);
      } else {
        setError(res.data?.error || "Something went wrong.");
      }
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to accept invite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Disc3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">DJ Command</h1>
            <p className="text-xs text-gray-400">Event CRM Platform</p>
          </div>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Password set!</h2>
            <p className="text-sm text-gray-500">Your account is ready. You can now log in.</p>
            <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => base44.auth.redirectToLogin()}>
              Go to Login
            </Button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Set your password</h2>
              <p className="text-sm text-gray-500 mt-1">Welcome to DJ Command! Create a password to activate your account.</p>
            </div>

            {!token && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Invalid invite link. Please use the link from your invitation email.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" required />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={loading || !token}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Set Password & Activate
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}