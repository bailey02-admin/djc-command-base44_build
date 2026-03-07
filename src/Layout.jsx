import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, CalendarDays, ClipboardList,
  FileText, MessageSquare, DollarSign, Building2, ChevronLeft,
  ChevronRight, LogOut, Menu, Disc3, UserCircle, Settings,
  Layers, Music2, FileSignature, Archive, Users,
  TrendingUp, Sliders, Package, Sparkles, LayoutList, Wrench, ChevronDown,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import GlobalSearch from "./components/layout/GlobalSearch";
import RouteGuard from "./components/layout/RouteGuard";

const ALL_NAV_ITEMS = [
  { name: "Dashboard",       icon: LayoutDashboard, page: "Dashboard" },
  { name: "Calendar",        icon: CalendarDays,    page: "Calendar" },
  { name: "Leads",           icon: UserCircle,      page: "Leads" },
  { name: "Events",          icon: CalendarDays,    page: "Events" },
  { name: "Finalizer Queue", icon: Layers,          page: "FinalizerQueue" },
  { name: "Contacts",        icon: UserCircle,      page: "Contacts" },
  { name: "Tasks",           icon: ClipboardList,   page: "Tasks" },
  { name: "Contracts",       icon: FileSignature,   page: "Contracts" },
  { name: "DJ Roster",       icon: Music2,          page: "DJRoster" },
  { name: "Venues",          icon: Building2,       page: "Venues" },
  { name: "Payments",        icon: DollarSign,      page: "Payments" },
  { name: "Finance",         icon: TrendingUp,      page: "FinanceIncoming", roles: ["admin", "finance", "city_manager"] },
  { name: "Templates",       icon: MessageSquare,   page: "MessageTemplates" },
  { name: "Reports",         icon: FileText,        page: "Reports",        roles: ["admin", "city_manager", "sales_manager", "production_manager", "office_finalizer", "finance"] },
  { name: "Archive",         icon: Archive,         page: "ArchivedRecords" },
  { name: "Users",           icon: Users,           page: "Users" },
  // Settings is rendered as a group — see SETTINGS_SUBNAV below
];

const REPORTS_SUBNAV = [
  { name: "Survey Reports",  icon: ClipboardList,  page: "SurveyReports",  roles: ["admin", "city_manager", "sales_manager", "production_manager", "office_finalizer", "finance"] },
  { name: "Custom Reports",  icon: FileText,        page: "Reports",        roles: ["admin", "city_manager", "sales_manager", "production_manager", "office_finalizer", "finance"] },
];

// Pages that belong to the Reports group
const REPORTS_PAGES = new Set([
  "Reports", "ReportBuilder",
  "SurveyReports", "SurveyResponsesReport", "SurveyTrendsByDJ", "SurveyLowScoreQueue",
]);

const SETTINGS_SUBNAV = [
  { name: "General & SLA",        icon: Sliders,      page: "Settings",            roles: ["admin"] },
  { name: "Timeline Templates",   icon: LayoutList,   page: "TimelineTemplates",   roles: ["admin", "city_manager", "sales_manager", "office_finalizer"] },
  { name: "Packages",             icon: Package,      page: "PackagesSettings",    roles: ["admin", "finance", "city_manager", "sales_manager"] },
  { name: "Add-Ons",              icon: Sparkles,     page: "AddOnsSettings",      roles: ["admin", "finance", "city_manager", "sales_manager"] },
  { name: "Surveys",              icon: ClipboardList, page: "SurveyTemplates",   roles: ["admin", "city_manager", "office_finalizer", "sales_manager"] },
  { name: "Admin Tools",          icon: Wrench,       page: "SettingsAdminTools",  roles: ["admin"] },
];

// Pages that belong to the Settings group
const SETTINGS_PAGES = new Set([
  "Settings", "TimelineTemplates", "TimelineTemplateBuilder",
  "PackagesSettings", "AddOnsSettings", "SettingsAdminTools",
  "SurveyTemplates", "SurveyTemplateBuilder",
]);

// Staff planning pages — not in sidebar nav, accessible via EventDetail
const STAFF_PLANNING_PAGES = new Set([
  "StaffPlanningHub","StaffMusicManager","StaffSpecialSongsList",
  "StaffTimelineManager","StaffTimelineView","StaffPrint"
]);

const NO_SIDEBAR_PAGES = new Set(["ReportBuilder"]);

const AUTH_PAGES = new Set(["AcceptInvite","ForgotPassword","ResetPassword"]);

// Role-scoped nav — only show items the role can reach
const NAV_BY_ROLE = {
  admin:            ALL_NAV_ITEMS.map(i => i.page),
  city_manager:     ["Dashboard","Calendar","Leads","Events","FinalizerQueue","Contacts","Tasks","Contracts","DJRoster","Venues","Payments","MessageTemplates","Reports","ArchivedRecords","Users"],
  sales_manager:    ["Dashboard","Calendar","Leads","Events","Contacts","Tasks","Contracts","Venues","Reports"],
  sales_rep:        ["Dashboard","Calendar","Leads","Events","Contacts","Tasks"],
  office_finalizer: ["Dashboard","Calendar","Events","FinalizerQueue","Contacts","Tasks","Venues"],
  finance:          ["Dashboard","Payments","Reports"],
  dj:               ["Dashboard","Calendar","Events"],
  client:           [],
};

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (currentPageName === "ClientPortal" || currentPageName === "DJView" ||
      STAFF_PLANNING_PAGES.has(currentPageName) || AUTH_PAGES.has(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-50/50 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        flex flex-col bg-white border-r border-gray-200/80
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-64"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-gray-100 ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Disc3 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-gray-900 text-sm tracking-tight">DJ Command</h1>
              <p className="text-[10px] text-gray-400 font-medium">Event CRM Platform</p>
            </div>
          )}
        </div>

        {/* Nav — filtered by role (via RouteGuard which fetches StaffProfile) */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {ALL_NAV_ITEMS.filter(item => {
            const role = user?.custom_role;
            if (item.page === "Reports" || item.page === "ReportBuilder") {
              if (role === "dj" || role === "client") return false;
            }
            if (item.roles && role && !item.roles.includes(role)) return false;
            return true;
          }).map(item => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${isActive ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}
                  ${collapsed ? "justify-center px-0" : ""}
                `}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-violet-600" : ""}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}

          {/* Settings group — shown if user has access to at least one settings item */}
          {(() => {
            const role = user?.custom_role;
            const visibleSubNav = SETTINGS_SUBNAV.filter(item =>
              !item.roles || !role || item.roles.includes(role)
            );
            if (visibleSubNav.length === 0) return null;

            const isInSettings = SETTINGS_PAGES.has(currentPageName);

            return (
              <div>
                {/* Settings parent row */}
                <Link
                  to={createPageUrl("Settings")}
                  onClick={() => setMobileOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150
                    ${isInSettings ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}
                    ${collapsed ? "justify-center px-0" : ""}
                  `}
                >
                  <Settings className={`w-[18px] h-[18px] flex-shrink-0 ${isInSettings ? "text-violet-600" : ""}`} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">Settings</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isInSettings ? "rotate-0" : "-rotate-90"}`} />
                    </>
                  )}
                </Link>

                {/* Submenu — only expand when in settings area */}
                {isInSettings && !collapsed && (
                  <div className="ml-3 mt-0.5 pl-3 border-l border-gray-200 space-y-0.5">
                    {visibleSubNav.map(item => {
                      const isActive = currentPageName === item.page;
                      return (
                        <Link
                          key={item.page}
                          to={createPageUrl(item.page)}
                          onClick={() => setMobileOpen(false)}
                          className={`
                            flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                            transition-all duration-150
                            ${isActive ? "bg-violet-50 text-violet-700" : "text-gray-400 hover:bg-gray-50 hover:text-gray-800"}
                          `}
                        >
                          <item.icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-violet-600" : ""}`} />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </nav>

        {/* Collapse button */}
        <div className="hidden lg:flex px-3 py-3 border-t border-gray-100">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
          </button>
        </div>

        {/* User */}
        {user && (
          <div className={`px-3 py-3 border-t border-gray-100 ${collapsed ? "items-center" : ""}`}>
            <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user.full_name?.[0]?.toUpperCase() || "U"}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{user.full_name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{user.role || "admin"}</p>
                </div>
              )}
              {!collapsed && (
                <button onClick={() => base44.auth.logout()} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200/80 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button className="lg:hidden text-gray-500" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <GlobalSearch />
        </header>

        {/* Page content — wrapped in RouteGuard for role enforcement */}
        <div className="flex-1 overflow-y-auto">
          <RouteGuard pageName={currentPageName}>
            {children}
          </RouteGuard>
        </div>
      </main>
    </div>
  );
}