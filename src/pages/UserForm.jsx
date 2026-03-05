import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { UserAPI, ContactAPI } from "@/components/api/secureApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = ["admin","sales_manager","sales_rep","city_manager","office_finalizer","finance","dj","client"];
const CITY_OPTIONS = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];
const EMPTY = { full_name: "", email: "", phone: "", custom_role: "sales_rep", cities: [], default_city: "", contact_id: "", is_active: true, notes: "" };

export default function UserForm() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState([]);

  const { data: existingUser, isLoading } = useQuery({
    queryKey: ["user", editId],
    queryFn: () => UserAPI.get(editId),
    enabled: !!editId,
  });

  useEffect(() => {
    if (existingUser) {
      // Support both legacy 'role' field and new 'custom_role' field
      setForm({
        ...EMPTY,
        ...existingUser,
        custom_role: existingUser.custom_role || existingUser.role || "sales_rep",
        cities: existingUser.cities || [],
      });
    }
  }, [existingUser]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleCity = (city) => {
    setForm(f => ({
      ...f,
      cities: f.cities.includes(city) ? f.cities.filter(c => c !== city) : [...f.cities, city],
    }));
  };

  const searchContacts = async (q) => {
    if (q.length < 2) { setContactResults([]); return; }
    const results = await ContactAPI.list({ search: q }, "-created_date", 10);
    setContactResults(results);
  };

  const save = async (andInvite = false) => {
    if (!form.custom_role) { toast.error("Role is required"); return; }
    if (form.custom_role !== "client" && !form.email) { toast.error("Email is required for staff roles"); return; }
    if (form.custom_role === "client" && !form.contact_id) { toast.error("Contact ID is required for client role"); return; }

    setSaving(true);
    try {
      if (editId) {
        await UserAPI.update(editId, form);
        toast.success("User saved!");
      } else if (andInvite) {
        // Create StaffProfile + send real platform invite in one call
        await UserAPI.createAndInvite(form);
        toast.success("User saved and invite sent!");
      } else {
        // Save StaffProfile only — no auth account yet
        await UserAPI.create(form);
        toast.success("User saved! Send an invite when ready.");
      }

      qc.invalidateQueries(["users"]);
      navigate(createPageUrl("Users"));
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6">
      <Link to={createPageUrl("Users")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">{editId ? "Edit User" : "New User"}</h1>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 000-0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email {form.role !== "client" && <span className="text-red-500">*</span>}</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role <span className="text-red-500">*</span></Label>
            <Select value={form.custom_role} onValueChange={v => set("custom_role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active !== false} onCheckedChange={v => set("is_active", v)} />
            <Label>Active</Label>
          </div>
        </CardContent>
      </Card>

      {/* Cities — shown for non-client roles */}
      {form.custom_role !== "client" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">City Assignments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CITY_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => toggleCity(c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.cities.includes(c)
                      ? "bg-violet-100 text-violet-700 border-violet-300"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Default City</Label>
              <Select value={form.default_city || ""} onValueChange={v => set("default_city", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {CITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact link — only for client role */}
      {form.custom_role === "client" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Linked Contact <span className="text-red-500">*</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {form.contact_id && (
              <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 px-3 py-2 rounded-lg">
                <span className="font-mono text-xs">{form.contact_id}</span>
                <button onClick={() => set("contact_id", "")} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <Input
              placeholder="Search contacts by name or email…"
              value={contactSearch}
              onChange={e => { setContactSearch(e.target.value); searchContacts(e.target.value); }}
            />
            {contactResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {contactResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { set("contact_id", c.id); set("email", c.email || form.email); setContactSearch(""); setContactResults([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                  >
                    <p className="font-medium">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Internal notes…" className="h-24" />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={() => save(false)} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
        </Button>
        {!editId && form.custom_role !== "client" && form.email && (
          <Button variant="outline" onClick={() => save(true)} disabled={saving}>
            Save + Send Invite
          </Button>
        )}
        <Link to={createPageUrl("Users")}>
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}