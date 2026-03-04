/**
 * RouteGuard — enforces page-level access control based on user role.
 * Renders children if allowed, otherwise shows a 403 page.
 * Rules mirror getNavItems() in components/crm/permissions.js
 */
import React from "react";
import { Shield } from "lucide-react";

// Page → minimum allowed roles (if a role is NOT listed, it is blocked)
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
  Quotes:          ["admin", "city_manager", "sales_manager", "finance"],
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
  // Client-portal-only pages (handled separately — no sidebar nav)
  ClientPortal:    ["client", "admin"],
  DJView:          ["dj", "admin"],
  MusicPlanner:    ["admin", "city_manager", "sales_manager", "office_finalizer"],
  TimelineBuilder: ["admin", "city_manager", "sales_manager", "office_finalizer"],
};

export default function RouteGuard({ pageName, userRole, children }) {
  // While user role is still loading (null), render nothing (avoid flash)
  if (userRole === null) return null;

  // Pages not in the map are open by default (e.g. 404)
  const allowed = PAGE_ACCESS[pageName];
  if (!allowed) return <>{children}</>;

  const role = userRole || "sales_rep";
  if (!allowed.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Your role (<span className="font-mono font-semibold">{role}</span>) does not have permission to access <strong>{pageName}</strong>.
        </p>
        <p className="text-xs text-gray-400">If you believe this is an error, contact your administrator.</p>
      </div>
    );
  }

  return <>{children}</>;
}