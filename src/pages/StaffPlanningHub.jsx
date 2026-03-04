/**
 * Staff Planning Hub — /StaffPlanningHub?event_id=xxx
 * Permissions, lock status, stats, and admin actions
 */
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { EventAPI } from "../components/api/secureApi";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import {
  Music2, Clock, Lock, Unlock, Settings, Trash2, ArrowLeft,
  ExternalLink, Users, FileText, ListMusic, CalendarDays, Loader2, AlertTriangle, RefreshCw
} from "lucide-react";
import { format } from "date-fns";

const DEFAULT_PERMS = {
  song_request_system_visible: true,
  song_request_system_editable: true,
  timeline_permissions_view: true,
  timeline_permissions_edit: true,
  fees_and_payments_visible: false,
  addon_fees_visible: false,
  guest_requests_enabled: false,
};

const PERM_LABELS = [
  { key: "song_request_system_visible",  label: "Song Request System Visible" },
  { key: "song_request_system_editable", label: "Song Request System Editable" },
  { key: "timeline_permissions_view",    label: "Client Can View Timeline" },
  { key: "timeline_permissions_edit",    label: "Client Can Edit Timeline" },
  { key: "fees_and_payments_visible",    label: "Fees & Payments Visible" },
  { key: "addon_fees_visible",           label: "Add-On Fees Visible" },
  { key: "guest_requests_enabled",       label: "Guest Requests Enabled" },
];

export default function StaffPlanningHub() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("event_id");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(DEFAULT_PERMS);
  const [savingPerms, setSavingPerms] = useState(false);
  const [lockSaving, setLockSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [adminBusy, setAdminBusy] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data, isLoading, error: bundleError } = useQuery({
    queryKey: ["planning-bundle", eventId],
    queryFn: async () => {
      const r = await base44.functions.invoke("getPlanningBundle", { event_id: eventId });
      // r.data is the bundle object directly
      const d = r.data ?? {};
      return d;
    },
    enabled: !!eventId,
  });

  useEffect(() => {
    if (data?.permissions) setPerms({ ...DEFAULT_PERMS, ...data.permissions });
  }, [data]);

  if (!eventId) return (
    <div className="p-8 text-center text-gray-400">No event_id provided.</div>
  );

  const event = data?.event ?? null;
  const stats = data?.stats ?? null;
  const isLocked = event?.planning_lock_at && new Date() >= new Date(event.planning_lock_at);
  const canAdmin = user && ["admin","city_manager","office_finalizer"].includes(user.role);

  const handleSavePerms = async () => {
    setSavingPerms(true);
    await base44.functions.invoke("upsertPlanningPermissions", { event_id: eventId, permissions: perms });
    qc.invalidateQueries(["planning-bundle", eventId]);
    setSavingPerms(false);
  };

  const handleToggleLock = async () => {
    setLockSaving(true);
    const newLockAt = isLocked ? null : new Date(Date.now() - 1000).toISOString();
    await EventAPI.update(eventId, { planning_lock_at: newLockAt });
    qc.invalidateQueries(["planning-bundle", eventId]);
    setLockSaving(false);
  };

  const handleViewAsClient = async () => {
    if (!event?.contact_id) return;
    setImpersonating(true);
    try {
      const res = await base44.functions.invoke("createImpersonationSession", { event_id: eventId });
      if (res.data?.ok && res.data?.redirect_url) {
        window.open(res.data.redirect_url, "_blank", "noopener,noreferrer");
      }
    } finally { setImpersonating(false); }
  };

  const handleAdminAction = async (action) => {
    setAdminBusy(true);
    await base44.functions.invoke("staffPlanningAdmin", { event_id: eventId, action });
    qc.invalidateQueries(["planning-bundle", eventId]);
    setAdminBusy(false);
    setConfirmAction(null);
  };

  const navLink = (page, label, icon, color = "text-violet-700 bg-violet-50 border-violet-200") => (
    <Link
      to={createPageUrl(page) + `?event_id=${eventId}`}
      className={`flex items-center gap-3 p-4 rounded-xl border ${color} hover:shadow-md transition-all`}
    >
      {React.createElement(icon, { className: "w-5 h-5" })}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-gray-500">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* ── DEBUG BANNER (remove after confirmed working) ── */}
      <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 text-xs font-mono text-yellow-800 space-y-0.5">
        <div><strong>DEBUG</strong> · eventId: <span className="text-yellow-900">{eventId || "⚠ MISSING"}</span></div>
        <div>user.role: {user?.role ?? "loading…"}</div>
        <div>bundle loaded: {isLoading ? "⏳ loading" : data ? "✅ yes" : "❌ no data"}</div>
        {bundleError && <div className="text-red-600">error: {bundleError.message}</div>}
        {data?.error && <div className="text-red-600">server error: {data.error}</div>}
        <div>special_songs: {stats?.special_song_count ?? "—"} · song_requests: {stats?.song_request_count ?? "—"} · perms_record: {data?.permissions_record_exists ? "yes" : "default"}</div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : (
        <>
          {/* Event header */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{event?.event_name || "Event"}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {event?.event_date && format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}
                  {event?.city && ` · ${event.city}`}
                  {event?.venue_name && ` · ${event.venue_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={isLocked ? "text-red-600 border-red-200 bg-red-50" : "text-emerald-600 border-emerald-200 bg-emerald-50"}>
                  {isLocked ? <><Lock className="w-3 h-3 mr-1" />Locked</> : <><Unlock className="w-3 h-3 mr-1" />Unlocked</>}
                </Badge>
                {canAdmin && (
                  <Button size="sm" variant="outline" onClick={handleToggleLock} disabled={lockSaving} className="h-7 text-xs">
                    {lockSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : isLocked ? "Unlock Planning" : "Lock Planning"}
                  </Button>
                )}
                {canAdmin && event?.contact_id && (
                  <Button size="sm" variant="outline" onClick={handleViewAsClient} disabled={impersonating} className="h-7 text-xs gap-1">
                    {impersonating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                    View as Client
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Special Songs", val: stats.special_song_count, icon: Music2 },
                { label: "Song Requests", val: stats.song_request_count, icon: ListMusic },
                { label: "Planning", val: event?.planning_complete ? "✓ Done" : "Pending", icon: FileText },
                { label: "Timeline", val: event?.timeline_complete ? "✓ Done" : "Pending", icon: CalendarDays },
              ].map(({ label, val, icon: Icon }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Icon className="w-3.5 h-3.5" />{label}</div>
                  <div className="text-lg font-bold text-gray-900">{val ?? 0}</div>
                </div>
              ))}
            </div>
          )}

          {/* Nav links */}
          <div className="grid sm:grid-cols-2 gap-3">
            {navLink("StaffMusicManager", "Music Manager", ListMusic, "text-pink-700 bg-pink-50 border-pink-200")}
            {navLink("StaffSpecialSongsList", "Special Songs Edit List", Music2, "text-purple-700 bg-purple-50 border-purple-200")}
            {navLink("StaffTimelineManager", "Timeline Manager", CalendarDays, "text-indigo-700 bg-indigo-50 border-indigo-200")}
            {navLink("StaffTimelineView", "Timeline View (Formatted)", FileText, "text-blue-700 bg-blue-50 border-blue-200")}
            {navLink("StaffPrint", "Print / Export", FileText, "text-gray-700 bg-gray-50 border-gray-200")}
          </div>

          {/* Client Permissions */}
          {canAdmin && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Client Portal Permissions
              </h2>
              <div className="space-y-3">
                {PERM_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">{label}</Label>
                    <Switch
                      checked={!!perms[key]}
                      onCheckedChange={v => setPerms(p => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button onClick={handleSavePerms} disabled={savingPerms} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
                  {savingPerms ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Save Permissions
                </Button>
              </div>
            </div>
          )}

          {/* Admin danger zone */}
          {canAdmin && (
            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Administration
              </h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { action: "delete_song_requests", label: "Delete All Requests" },
                  { action: "delete_special_songs",  label: "Delete Special Songs" },
                  { action: "delete_timeline",       label: "Delete Timeline" },
                  { action: "reset_all",             label: "Reset ALL Planning", destructive: true },
                ].map(({ action, label, destructive }) => (
                  <Button
                    key={action}
                    size="sm"
                    variant="outline"
                    className={`h-8 text-xs gap-1 ${destructive ? "border-red-300 text-red-600 hover:bg-red-50" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    onClick={() => setConfirmAction({ action, label })}
                  >
                    <Trash2 className="w-3 h-3" /> {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm: {confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => handleAdminAction(confirmAction.action)}
              disabled={adminBusy}
            >
              {adminBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}