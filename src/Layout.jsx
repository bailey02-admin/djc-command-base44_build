import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList,
  FileText, MessageSquare, DollarSign, Building2, ChevronLeft,
  ChevronRight, LogOut, Menu, Disc3, UserCircle, Search, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NAV_ITEMS = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Leads", icon: Users, page: "Leads" },
  { name: "Events", icon: CalendarDays, page: "Events" },
  { name: "Contacts", icon: UserCircle, page: "Contacts" },
  { name: "Tasks", icon: ClipboardList, page: "Tasks" },
  { name: "Venues", icon: Building2, page: "Venues" },
  { name: "Payments", icon: DollarSign, page: "Payments" },
  { name: "Templates", icon: FileText, page: "MessageTemplates" },
  { name: "Reports", icon: FileText, page: "Reports" },
  { name: "Settings", icon: Settings, page: "Settings" },
];

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (currentPageName === "ClientPortal" || currentPageName === "DJView") {
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

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }
                  ${collapsed ? "justify-center px-0" : ""}
                `}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-violet-600" : ""}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
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
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search leads, events, contacts..."
                className="pl-9 h-9 bg-gray-50/80 border-gray-200 text-sm"
              />
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}