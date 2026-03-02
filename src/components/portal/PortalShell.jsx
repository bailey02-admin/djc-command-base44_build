import React from "react";
import { Disc3, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PortalShell({ children, user }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-rose-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Disc3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">DJ Command Portal</span>
        </div>
        {user && (
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        )}
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}