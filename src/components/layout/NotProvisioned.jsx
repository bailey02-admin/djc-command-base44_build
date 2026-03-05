import React from "react";
import { UserX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function NotProvisioned({ email }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center p-8 bg-gray-50">
      <div className="w-20 h-20 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
        <UserX className="w-10 h-10 text-amber-400" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold text-gray-900">Account Not Provisioned</h2>
        <p className="text-sm text-gray-500">
          You're signed in as <span className="font-mono font-semibold text-gray-700">{email}</span>, but this
          account doesn't have a DJ Command staff profile yet.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Contact your administrator to set up your profile and assign your role.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-gray-500"
        onClick={() => base44.auth.logout()}
      >
        <LogOut className="w-4 h-4" /> Sign out
      </Button>
    </div>
  );
}