import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Shield } from "lucide-react";

const CHECK_DEFINITIONS = [
  { id: "getLeads_dj_blocked", label: "DJs blocked from Leads list", fn: "getLeads", role_guard: "dj → 403" },
  { id: "getLeads_city_scoped", label: "City managers see only their city", fn: "getLeads", role_guard: "city_manager city-scoped" },
  { id: "getEvents_client_blocked", label: "Clients blocked from Events list", fn: "getEvents", role_guard: "client → 403" },
  { id: "mutateEvent_finalization_gate", label: "Finalization gate enforced server-side", fn: "mutateEvent", role_guard: "status→finalized blocked if checklist incomplete" },
  { id: "mutateUser_admin_only", label: "User mutations admin-only", fn: "mutateUser", role_guard: "admin → 403 for others" },
  { id: "inviteUser_admin_only", label: "Invite flow admin-only", fn: "inviteUser", role_guard: "admin only" },
  { id: "getPayments_finance_gate", label: "Payments hidden from sales_rep", fn: "getPayments", role_guard: "sales_rep → 403" },
];

function CheckRow({ check, result }) {
  const status = result?.status;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0">
        {status === "pass" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {status === "fail" && <XCircle className="w-4 h-4 text-red-500" />}
        {(!status || status === "pending") && <AlertCircle className="w-4 h-4 text-gray-300" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{check.label}</p>
        <p className="text-xs text-gray-400 font-mono">{check.fn}: {check.role_guard}</p>
      </div>
      <Badge variant="outline" className={`text-xs ${status === "pass" ? "border-emerald-300 text-emerald-600" : status === "fail" ? "border-red-300 text-red-600" : "border-gray-200 text-gray-400"}`}>
        {status || "not run"}
      </Badge>
    </div>
  );
}

export default function RbacSelfTest({ currentUser }) {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const newResults = {};

    // These checks are declarative/static — we verify the audit report from securityAudit
    try {
      const res = await base44.functions.invoke("securityAudit", {});
      const report = res.data;
      if (report?.function_claims) {
        for (const check of CHECK_DEFINITIONS) {
          const claim = report.function_claims.find(c => c.fn === check.fn);
          const matched = claim?.checks?.some(c => c.toLowerCase().includes(check.role_guard.split(" ")[0].toLowerCase()));
          newResults[check.id] = { status: matched ? "pass" : "fail" };
        }
        // Finalization gate special check
        if (report.finalization_gate_audit?.status === "PASS") {
          newResults["mutateEvent_finalization_gate"] = { status: "pass" };
        }
      }
    } catch {
      for (const check of CHECK_DEFINITIONS) {
        newResults[check.id] = { status: "fail" };
      }
    }

    setResults(newResults);
    setRunning(false);
  };

  const passed = Object.values(results).filter(r => r.status === "pass").length;
  const total = CHECK_DEFINITIONS.length;

  return (
    <Card className="border border-violet-200 bg-violet-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-600" />
            <CardTitle className="text-sm font-semibold text-violet-800">RBAC Self-Test</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={runChecks} disabled={running} className="h-7 text-xs gap-1">
            <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
            {running ? "Running…" : "Run Checks"}
          </Button>
        </div>
        {Object.keys(results).length > 0 && (
          <p className="text-xs text-violet-600 mt-1">{passed}/{total} checks passed</p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="bg-white rounded-lg border border-violet-100 p-1 mb-3">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500">Current session:</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className="bg-violet-100 text-violet-700 text-xs border-0">{currentUser?.role || "unknown"}</Badge>
              {(currentUser?.cities || []).map(c => (
                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
              ))}
              {currentUser?.email && <span className="text-xs text-gray-400">{currentUser.email}</span>}
            </div>
          </div>
          <div className="px-3">
            {CHECK_DEFINITIONS.map(check => (
              <CheckRow key={check.id} check={check} result={results[check.id]} />
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400">Checks verify that security audit claims match expected RBAC rules. Run after any role/function change.</p>
      </CardContent>
    </Card>
  );
}