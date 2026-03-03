import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadAPI, EventAPI, ContactAPI } from "../components/api/secureApi";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Mail, Phone, MapPin, CalendarDays, User, ExternalLink, UserCheck, CheckCircle2, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const statusColors = {
  booked: "bg-blue-50 text-blue-700",
  planning_in_progress: "bg-violet-50 text-violet-700",
  finalized: "bg-purple-50 text-purple-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  event_completed: "bg-green-50 text-green-700",
  closed_won: "bg-gray-100 text-gray-600",
};

const leadStatusColors = {
  new: "bg-blue-50 text-blue-700",
  contacted: "bg-amber-50 text-amber-700",
  qualified: "bg-violet-50 text-violet-700",
  booked: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
};

export default function ContactDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  const navigate = useNavigate();
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const handleViewAsClient = async () => {
    setImpersonating(true);
    try {
      const res = await base44.functions.invoke("createImpersonationSession", { contact_id: id });
      if (res.data?.ok) {
        window.location.href = res.data.redirect_url;
      }
    } catch (err) {
      console.error("Impersonation failed", err);
    } finally {
      setImpersonating(false);
    }
  };

  const handleCreateClientUser = async () => {
    setProvisioning(true);
    setProvisionResult(null);
    try {
      const res = await base44.functions.invoke("createClientUser", { contact_id: id });
      setProvisionResult({ success: true, ...res.data });
    } catch (err) {
      const errData = err?.response?.data;
      setProvisionResult({ success: false, message: errData?.error || "An unexpected error occurred." });
    } finally {
      setProvisioning(false);
    }
  };

  const { data: contact, isLoading: loadingContact } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => ContactAPI.get(id),
    enabled: !!id,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-contact", id],
    queryFn: () => LeadAPI.list({ contact_id: id }, "-created_date", 20),
    enabled: !!id,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-for-contact", id],
    queryFn: () => EventAPI.list({ contact_id: id }, "-event_date", 20),
    enabled: !!id,
  });

  if (loadingContact) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>;
  if (!contact) return <div className="p-8 text-gray-500 text-sm">Contact not found.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" className="text-sm text-gray-500 hover:text-gray-900 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
            <User className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{contact.first_name} {contact.last_name}</h1>
            <Badge variant="secondary" className="text-xs mt-1 capitalize">{contact.role?.replace(/_/g, " ")}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-sm h-8 gap-1.5"
            onClick={handleCreateClientUser}
            disabled={provisioning}
          >
            {provisioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Create Portal Login
          </Button>
          <Link to={createPageUrl("Contacts")}>
            <Button variant="outline" className="text-sm h-8">Edit Contact</Button>
          </Link>
        </div>
      </div>

      {/* Provision result */}
      {provisionResult && (
        <div className={`rounded-xl p-4 text-sm flex items-start gap-3 ${provisionResult.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {provisionResult.success
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <UserCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <div>
            <p className="font-semibold">{provisionResult.success ? "Portal login created!" : "Error"}</p>
            <p className="text-xs mt-0.5">{provisionResult.message || provisionResult.error}</p>
            {provisionResult.success && (
              <p className="text-xs mt-1 opacity-70">{provisionResult.temp_note}</p>
            )}
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${contact.email}`} className="hover:text-violet-600 hover:underline">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${contact.phone}`} className="hover:text-violet-600">{contact.phone}</a>
              </div>
            )}
            {contact.secondary_phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                {contact.secondary_phone} <span className="text-xs text-gray-400">(secondary)</span>
              </div>
            )}
            {contact.city && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />{contact.city}
              </div>
            )}
            {contact.address && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />{contact.address}
              </div>
            )}
          </CardContent>
        </Card>

        {contact.notes && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Linked Events */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Events ({events.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No events linked to this contact.</p>
          ) : (
            <div className="space-y-2">
              {events.map(e => (
                <Link key={e.id} to={createPageUrl("EventDetail") + `?id=${e.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.event_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {e.event_date ? format(new Date(e.event_date), "MMM d, yyyy") : "—"}
                        </span>
                        {e.venue_name && <span className="text-xs text-gray-400">· {e.venue_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${statusColors[e.status] || "bg-gray-100 text-gray-600"}`}>
                        {e.status?.replace(/_/g, " ")}
                      </Badge>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Leads */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Leads ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No leads linked to this contact.</p>
          ) : (
            <div className="space-y-2">
              {leads.map(l => (
                <Link key={l.id} to={createPageUrl("LeadDetail") + `?id=${l.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{l.client_first_name} {l.client_last_name}</p>
                      <span className="text-xs text-gray-500 capitalize">{l.event_type?.replace(/_/g, " ")} · {l.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${leadStatusColors[l.status] || "bg-gray-100 text-gray-600"}`}>
                        {l.status?.replace(/_/g, " ")}
                      </Badge>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}