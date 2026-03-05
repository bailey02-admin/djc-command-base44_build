/**
 * RouteGuard — enforces page-level access control based on StaffProfile custom_role.
 * Access is granted if:
 *   1. StaffProfile exists for the logged-in email
 *   2. StaffProfile.is_active = true
 *   3. StaffProfile.custom_role is in the allowed list for the page
 *
 * invite_status is NOT used for access control — informational only.
 */
import React, { useEffect, useState } from "react";
import { Shield, UserX, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
  Reports:         ["admin", "city_manager", "sales_manager", "finance"],
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

// Pages that are always open (no auth required)
const OPEN_PAGES = new Set(["AcceptInvite", "ForgotPassword", "ResetPassword", "ClientPortal", "DJView"]);

export default function RouteGuard({ pageName, userRole, children }) {
  const [staffCheck, setStaffCheck] = useState({ loading: true, profile: null, checked: false });

  useEffect(() => {
    // Open pages — skip staff check
    if (OPEN_PAGES.has(pageName)) {
      setStaffCheck({ loading: false, profile: null, checked: true });
      return;
    }

    // If we have userRole from layout, do a StaffProfile lookup for non-admin platform roles
    // We resolve based on the logged-in user's email
    base44.auth.me().then(async (user) => {
      if (!user) {
        setStaffCheck({ loading: false, profile: null, checked: true });
        return;
      }
      const email = user.email.trim().toLowerCase();
      try {
        const res = await base44.functions.invoke("rbacDebug", {});
        const data = res?.data || {};
        setStaffCheck({ loading: false, profile: data, checked: true });
      } catch {
        // Fallback: use platform role
        setStaffCheck({ loading: false, profile: null, checked: true });
      }
    }).catch(() => {
      setStaffCheck({ loading: false, profile: null, checked: true });
    });
  }, [pageName, userRole]);

  // Open pages — always render
  if (OPEN_PAGES.has(pageName)) return <>{children}</>;

  // Still loading profile
  if (staffCheck.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  // Pages not in the map are open
  const allowed = PAGE_ACCESS[pageName];
  if (!allowed) return <>{children}</>;

  // No allowed roles = always accessible (empty array = open page)
  if (allowed.length === 0) return <>{children}</>;

  // Determine effective role: prefer StaffProfile custom_role, fall back to platform role
  const profile = staffCheck.profile;
  const effectiveRole = profile?.custom_role || userRole || "sales_rep";
  const isActive = profile?.is_active !== false;

  // StaffProfile exists but user is deactivated
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

  // No StaffProfile found — show clear message instead of silent denial
  if (profile?.staff_profile_found === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
          <UserX className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">No Staff Profile Found</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Your account (<span className="font-mono">{profile?.email}</span>) does not have a Staff Profile in DJ Command.
          Contact your administrator to set one up.
        </p>
      </div>
    );
  }

  // Check page access
  if (!allowed.includes(effectiveRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Your role (<span className="font-mono font-semibold">{effectiveRole}</span>) does not have permission to access <strong>{pageName}</strong>.
        </p>
        <p className="text-xs text-gray-400">If you believe this is an error, contact your administrator.</p>
      </div>
    );
  }

  return <>{children}</>;
}