import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";

export default function RbacDebugPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("rbacDebug", {});
      setData(res.data);
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">RBAC Debug</CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">Inspect your resolved identity and StaffProfile data.</p>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!data && !error && (
          <p className="text-xs text-gray-400">Click Refresh to load your RBAC identity.</p>
        )}
        {data && (
          <div className="space-y-3 text-sm">
            <Row label="Auth Email" value={data.email} />
            <Row label="Full Name" value={data.full_name || "—"} />
            <Row label="Platform Role" value={data.platform_role || "—"} mono />

            <div className="border-t pt-3 mt-3 space-y-3">
              <div className="flex items-center gap-2">
                {data.staff_profile_found
                  ? <ShieldCheck className="w-4 h-4 text-green-600" />
                  : <ShieldOff className="w-4 h-4 text-amber-500" />}
                <span className="text-xs font-semibold text-gray-500">
                  StaffProfile: {data.staff_profile_found ? "FOUND" : "NOT FOUND (using platform role)"}
                </span>
              </div>

              {data.staff_profile_found && (
                <>
                  <Row label="custom_role" value={data.custom_role || "—"} mono />
                  <Row label="is_active" value={
                    <Badge className={data.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {data.is_active ? "active" : "deactivated"}
                    </Badge>
                  } />
                  <Row label="cities" value={
                    data.cities?.length
                      ? data.cities.map(c => <Badge key={c} variant="outline" className="mr-1 text-xs">{c}</Badge>)
                      : <span className="text-gray-400">none</span>
                  } />
                  <Row label="invite_status" value={data.invite_status || "—"} mono />
                  <Row label="Profile ID" value={data.staff_profile_id || "—"} mono />
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-xs text-gray-500 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs font-medium ${mono ? "font-mono text-violet-700" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}