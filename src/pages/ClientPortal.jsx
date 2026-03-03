/**
 * Client Portal — Phase 0–2
 * Views: home | events | detail | planning
 * Also supports ?impersonation_token= for admin "View As Client" mode.
 */
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Heart, ShieldAlert, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CalendarDays, DollarSign, ChevronRight } from "lucide-react";

import PortalShell from "../components/portal/PortalShell";
import EventCard from "../components/portal/EventCard";
import PortalEventDetail from "../components/portal/PortalEventDetail";
import PortalPlanningHub from "../components/portal/PortalPlanningHub";

// ─── Portal Home Dashboard ────────────────────────────────────────────────────
function PortalHome({ user, myEvents }) {
  const upcoming = (myEvents.upcoming || []).filter(e =>
    !["cancelled", "completed"].includes(e.status)
  );
  const nextEvent = upcoming[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hey{myEvents.contact?.first_name ? `, ${myEvents.contact.first_name}` : ""}! 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's coming up for your event.</p>
      </div>
      {nextEvent ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Next Upcoming Event</p>
          <EventCard event={nextEvent} showPayCta={true} />
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            No upcoming events. Contact your coordinator if you have questions.
          </CardContent>
        </Card>
      )}
      {(myEvents.events || []).length > 1 && (
        <Link to={createPageUrl("ClientPortal?view=events")}>
          <Button variant="outline" className="w-full gap-2 text-sm">
            View All My Events <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

// ─── My Events List ───────────────────────────────────────────────────────────
function PortalEventList({ myEvents }) {
  const { upcoming = [], past = [] } = myEvents;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">My Events</h2>
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Upcoming</p>
          {upcoming.map(e => <EventCard key={e.id || e.event_id} event={e} />)}
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Past Events</p>
          {past.map(e => <EventCard key={e.id || e.event_id} event={e} showPayCta={false} />)}
        </div>
      )}
      {upcoming.length === 0 && past.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-gray-400 text-sm">No events found.</CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Impersonation Banner ─────────────────────────────────────────────────────
function ImpersonationBanner({ contactId }) {
  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-medium sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>You are viewing as Client (Impersonation Mode) — Contact: {contactId}</span>
      </div>
      <a href={createPageUrl("Dashboard")}>
        <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
          <X className="w-3 h-3" /> Exit Client View
        </Button>
      </a>
    </div>
  );
}

// ─── Main ClientPortal Component ─────────────────────────────────────────────
export default function ClientPortal() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "home";
  const eventId = params.get("event_id");
  const impersonationToken = params.get("impersonation_token");

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonatedContactId, setImpersonatedContactId] = useState(null);
  const [impersonationError, setImpersonationError] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        setUser(u);
        if (!impersonationToken && u && u.role && u.role !== "client") {
          window.location.href = createPageUrl("Dashboard");
        }
      })
      .catch(() => setUser(null))
      .finally(() => {
        if (!impersonationToken) setAuthLoading(false);
      });
  }, []);

  // Handle impersonation token
  useEffect(() => {
    if (!impersonationToken) return;

    base44.functions.invoke("validateImpersonationToken", { token: impersonationToken })
      .then(res => {
        const data = res.data;
        if (data?.valid) {
          setImpersonating(true);
          setImpersonatedContactId(data.contact_id);
          // Strip token from URL without reload
          const url = new URL(window.location.href);
          url.searchParams.delete("impersonation_token");
          window.history.replaceState({}, "", url.toString());
        } else {
          setImpersonationError(data?.error || "Invalid token");
        }
      })
      .catch(() => setImpersonationError("Failed to validate token"))
      .finally(() => setAuthLoading(false));
  }, [impersonationToken]);

  // Loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // Impersonation error
  if (impersonationError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">Impersonation Failed</h1>
            <p className="text-sm text-gray-500 mt-2 mb-6">{impersonationError}</p>
            <a href={createPageUrl("Dashboard")}>
              <Button className="w-full">Return to Dashboard</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in (and not impersonating)
  if (!user && !impersonating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-rose-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <Heart className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              Please sign in to access your event planning portal.
            </p>
            <Button
              onClick={() => base44.auth.redirectToLogin(window.location.href)}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For impersonation mode: override the effective contact id so queries work
  const effectiveContactId = impersonating ? impersonatedContactId : null;
  const isReady = !authLoading && !impersonationError && (!!user || impersonating);

  // Fetch all client events — always called (hooks must not be conditional)
  const { data: myEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["portal-my-events", effectiveContactId],
    queryFn: async () => {
      const payload = impersonating ? { impersonate_contact_id: effectiveContactId } : {};
      const res = await base44.functions.invoke("portalGetMyEvents", payload);
      return res.data || { events: [], upcoming: [], past: [], contact: null };
    },
    enabled: isReady && ["home", "events"].includes(view),
  });

  // Fetch single event bundle — always called (hooks must not be conditional)
  const { data: eventBundle, isLoading: bundleLoading } = useQuery({
    queryKey: ["portal-event", eventId, effectiveContactId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getEventDetail", { id: eventId });
      return res.data || null;
    },
    enabled: isReady && !!eventId && ["detail", "planning"].includes(view),
  });

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // ── Impersonation error ────────────────────────────────────────────────────
  if (impersonationError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">Impersonation Failed</h1>
            <p className="text-sm text-gray-500 mt-2 mb-6">{impersonationError}</p>
            <a href={createPageUrl("Dashboard")}>
              <Button className="w-full">Return to Dashboard</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user && !impersonating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-rose-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <Heart className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              Please sign in to access your event planning portal.
            </p>
            <Button
              onClick={() => base44.auth.redirectToLogin(window.location.href)}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = (["home", "events"].includes(view) && eventsLoading) ||
    (["detail", "planning"].includes(view) && bundleLoading);

  if (isLoading) {
    return (
      <>
        {impersonating && <ImpersonationBanner contactId={impersonatedContactId} />}
        <PortalShell user={user}>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          </div>
        </PortalShell>
      </>
    );
  }

  function BackLink({ to, label }) {
    return (
      <Link to={createPageUrl(to)} className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1 mb-4">
        ← {label}
      </Link>
    );
  }

  return (
    <>
      {impersonating && <ImpersonationBanner contactId={impersonatedContactId} />}
      <PortalShell user={user}>
        {view === "home" && (
          <PortalHome user={user} myEvents={myEvents || { events: [], upcoming: [], past: [], contact: null }} />
        )}
        {view === "events" && (
          <>
            <BackLink to="ClientPortal" label="Back to Home" />
            <PortalEventList myEvents={myEvents || { events: [], upcoming: [], past: [] }} />
          </>
        )}
        {view === "detail" && eventBundle && (
          <>
            <BackLink to="ClientPortal" label="Back to Home" />
            <PortalEventDetail bundle={eventBundle} />
            <div className="mt-4">
              <Link to={createPageUrl(`ClientPortal?view=planning&event_id=${eventId}`)}>
                <Button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600">
                  Plan My Event →
                </Button>
              </Link>
            </div>
          </>
        )}
        {view === "planning" && eventBundle && (
          <>
            <BackLink to={`ClientPortal?view=detail&event_id=${eventId}`} label="Back to Event Details" />
            <PortalPlanningHub bundle={eventBundle} eventId={eventId} />
          </>
        )}
        {(view === "detail" || view === "planning") && !eventBundle && !bundleLoading && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-10 text-center text-gray-400 text-sm">
              Event not found or you don't have access to this event.
            </CardContent>
          </Card>
        )}
      </PortalShell>
    </>
  );
}