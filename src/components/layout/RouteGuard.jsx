/**
 * RouteGuard — enforces page-level access control based on StaffProfile custom_role.
 * Access is granted if:
 *   1. StaffProfile exists for the logged-in email (normalized lowercase)
 *   2. StaffProfile.is_active = true
 *   3. StaffProfile.custom_role is in the allowed list for the page
 *
 * admin role bypasses city scoping.
 * invite_status is NOT used for access control — auto-accepted on first login via rbacDebug.
 * Platform user.role is IGNORED for permissions.
 */
import React, { useEffect, useState } from "react";
import { Shield, UserX, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import NotProvisioned from "./NotProvisioned";

const PAGE_ACCESS = {
  Dashboard:       ["admin", "city_manager", "sales_manager", "sales_rep", "dj", "office_finalizer", "finance"],
  Leads:           ["admin", "city_manager", "sales_manager", "sales_rep", "office_finalizer", "finance"],
  LeadDetail:      ["admin", "city_manager", "sales_manager", "sales_rep", "office_finalizer", "finance"],
  LeadForm:        ["admin", "city_manager", "sales_manager", "sales_rep"],
  Events:          ["admin", "city_manager", "sales_manager", "sales_rep", "dj", "office_finalizer", "finance"],
  EventDetail:     ["admin", "city_manager", "sales_manager", "sales_rep", "dj", "office_finalizer", "finance"],
  EventForm:       ["admin", "city_manager", "sales_manager"],
  FinalizerQueue:  ["admin", "city_manager", "sales_manager", "office_finalizer"],
  Contacts:        ["admin", "city_manager", "sales_manager", "sales_rep", "office_finalizer"],
  ContactDetail:   ["admin", "city_manager", "sales_manager", "sales_rep", "office_finalizer"],
  Tasks:           ["admin", "city_manager", "sales_manager", "sales_rep", "dj", "office_finalizer"],
  Contracts:       ["admin", "city_manager", "sales_manager", "finance"],
  DJRoster:        ["admin", "city_manager", "sales_manager"],
  DJDetail:        ["admin", "city_manager", "sales_manager"],
  Venues:          ["admin", "city_manager", "sales_manager", "office_finalizer"],
  Payments:        ["admin", "city_manager", "sales_manager", "finance"],
  MessageTemplates:["admin", "city_manager", "sales_manager"],
  Reports:         ["admin", "city_manager", "sales_manager", "production_manager", "office_finalizer", "finance"],
  ReportBuilder:   ["admin", "city_manager", "sales_manager", "production_manager", "office_finalizer", "finance"],
  ArchivedRecords: ["admin", "city_manager"],
  Users:           ["admin", "city_manager"],
  UserForm:        ["admin"],
  AcceptInvite:    [],
  ForgotPassword:  [],
  ResetPassword:   [],
  Settings:        ["admin"],
  ClientPortal:    ["client", "admin"],
  DJView:          ["dj", "admin"],
  MusicPlanner:    ["admin", "city_manager", "sales_manager", "office_finalizer"],
  TimelineBuilder: ["admin", "city_manager", "sales_manager", "office_finalizer"],
};

// Pages that bypass auth entirely
const OPEN_PAGES = new Set(["AcceptInvite", "ForgotPassword", "ResetPassword", "ClientPortal", "DJView"]);

export default function RouteGuard({ pageName, children }) {
  const [state, setState] = useState({ loading: true, profile: null, authEmail: null });

  useEffect(() => {
    if (OPEN_PAGES.has(pageName)) {
      setState({ loading: false, profile: null, authEmail: null });
      return;
    }

    base44.auth.me().then(async (user) => {
      if (!user) {
        setState({ loading: false, profile: null, authEmail: null });
        return;
      }
      try {
        // rbacDebug: resolves StaffProfile by normalized email, auto-accepts invite_status
        const res = await base44.functions.invoke("rbacDebug", {});
        setState({ loading: false, profile: res?.data || null, authEmail: user.email });
      } catch {
        setState({ loading: false, profile: null, authEmail: user.email });
      }
    }).catch(() => {
      setState({ loading: false, profile: null, authEmail: null });
    });
  }, [pageName]);

  // Open pages — always render
  if (OPEN_PAGES.has(pageName)) return <>{children}</>;

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  const allowed = PAGE_ACCESS[pageName];
  // Page not in map = open
  if (!allowed) return <>{children}</>;
  // Empty array = open page
  if (allowed.length === 0) return <>{children}</>;

  const profile = state.profile;
  const customRole = profile?.custom_role;
  const isActive = profile?.is_active !== false;

  // Authenticated but no StaffProfile → full-screen not provisioned
  if (state.authEmail && !profile?.staff_profile_found) {
    return <NotProvisioned email={state.authEmail} />;
  }

  // StaffProfile found but deactivated
  if (profile?.staff_profile_found && !isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
          <UserX className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Account Deactivated</h2>
        <p className="text-sm text-gray-500 max-w-sm">Your account has been deactivated. Contact your administrator to regain access.</p>
      </div>
    );
  }

  // admin bypasses all city scoping and has full access
  if (customRole === "admin") return <>{children}</>;

  // Check page access by custom_role
  if (!allowed.includes(customRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Your role (<span className="font-mono font-semibold">{customRole}</span>) does not have permission to access <strong>{pageName}</strong>.
        </p>
        <p className="text-xs text-gray-400">Contact your administrator if you believe this is an error.</p>
      </div>
    );
  }

  return <>{children}</>;
}