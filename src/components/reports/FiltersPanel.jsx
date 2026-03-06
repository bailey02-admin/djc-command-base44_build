import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CITIES = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];
const EVENT_STATUSES = ["booked_pending","booked","planning_in_progress","finalized","completed","cancelled","postponed"];
const LEAD_STATUSES = ["web_lead","email_only","bridal_show_lead","corporate_lead","hot_lead","appointment_set","missed_appointment","x_dated","never_booked","lost_sale","booked_pending"];
const PAYMENT_STATUSES = ["pending","paid","overdue","waived","refunded"];
const PAYMENT_TYPES = ["deposit","installment","final_balance","refund","additional"];
const EVENT_TYPES = ["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"];

function SelectFilter({ label, value, onChange, options, placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-500">{label}</Label>
      <Select value={value || ""} onValueChange={v => onChange(v === "_all" ? "" : v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={placeholder || "Any"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Any</SelectItem>
          {options.map(o => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function FiltersPanel({ entityKey, filters, onChange }) {
  const set = (key, val) => onChange({ ...filters, [key]: val || undefined });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {/* City — all entities */}
      <SelectFilter
        label="City"
        value={filters.city}
        onChange={v => set("city", v)}
        options={CITIES}
      />

      {/* Date range */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Date From</Label>
        <Input
          type="date"
          className="h-8 text-sm"
          value={filters.date_from || ""}
          onChange={e => set("date_from", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Date To</Label>
        <Input
          type="date"
          className="h-8 text-sm"
          value={filters.date_to || ""}
          onChange={e => set("date_to", e.target.value)}
        />
      </div>

      {/* Entity-specific */}
      {entityKey === "events" && (
        <>
          <SelectFilter label="Status" value={filters.status} onChange={v => set("status", v)} options={EVENT_STATUSES} />
          <SelectFilter label="Event Type" value={filters.event_type} onChange={v => set("event_type", v)} options={EVENT_TYPES} />
        </>
      )}
      {entityKey === "leads" && (
        <>
          <SelectFilter label="Lead Status" value={filters.lead_status} onChange={v => set("lead_status", v)} options={LEAD_STATUSES} />
          <SelectFilter label="Event Type" value={filters.event_type} onChange={v => set("event_type", v)} options={EVENT_TYPES} />
        </>
      )}
      {entityKey === "payments" && (
        <>
          <SelectFilter label="Status" value={filters.status} onChange={v => set("status", v)} options={PAYMENT_STATUSES} />
          <SelectFilter label="Payment Type" value={filters.payment_type} onChange={v => set("payment_type", v)} options={PAYMENT_TYPES} />
        </>
      )}
    </div>
  );
}