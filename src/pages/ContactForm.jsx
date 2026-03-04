import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ContactAPI } from "@/components/api/secureApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const ROLES = ["bride", "groom", "couple", "parent", "planner", "corporate_contact", "other"];
const CONTACT_METHODS = ["phone", "email", "text", "any"];

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  secondary_phone: "",
  organization_name: "",
  role: "couple",
  preferred_contact_method: "any",
  city: "",
  address: "",
  notes: "",
  tags: [],
};

function Section({ title, children }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, span2 }) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function ContactForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (editId) {
      ContactAPI.get(editId).then(contact => {
        if (contact) {
          setForm({
            ...EMPTY_FORM,
            ...contact,
          });
        }
      });
    }
  }, [editId]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await ContactAPI.update(editId, form);
      } else {
        await ContactAPI.create(form);
      }
      navigate(-1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <Link to={createPageUrl("Contacts")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Contacts
      </Link>

      <h1 className="text-xl font-bold text-gray-900">{editId ? "Edit Contact" : "New Contact"}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <Section title="Basic Information">
          <Field label="First Name *">
            <Input
              value={form.first_name}
              onChange={e => set("first_name", e.target.value)}
              required
            />
          </Field>
          <Field label="Last Name *">
            <Input
              value={form.last_name}
              onChange={e => set("last_name", e.target.value)}
              required
            />
          </Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={v => set("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Organization / Company">
            <Input
              value={form.organization_name}
              onChange={e => set("organization_name", e.target.value)}
              placeholder="Company or venue name"
            />
          </Field>
        </Section>

        {/* Contact Info */}
        <Section title="Contact Information">
          <Field label="Email *">
            <Input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              required
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={e => set("phone", e.target.value)}
            />
          </Field>
          <Field label="Secondary Phone">
            <Input
              value={form.secondary_phone}
              onChange={e => set("secondary_phone", e.target.value)}
            />
          </Field>
          <Field label="Preferred Contact Method">
            <Select value={form.preferred_contact_method} onValueChange={v => set("preferred_contact_method", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map(m => (
                  <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* Location */}
        <Section title="Location">
          <Field label="City" span2>
            <Input
              value={form.city}
              onChange={e => set("city", e.target.value)}
            />
          </Field>
          <Field label="Address" span2>
            <Input
              value={form.address}
              onChange={e => set("address", e.target.value)}
            />
          </Field>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <Field label="Notes" span2>
            <Textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={3}
            />
          </Field>
        </Section>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Link to={createPageUrl("Contacts")}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {editId ? "Update" : "Create"} Contact
          </Button>
        </div>
      </form>
    </div>
  );
}