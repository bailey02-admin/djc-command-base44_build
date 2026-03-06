import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, SkipForward, Database } from "lucide-react";

const CITY_OPTIONS = ["", "TUL", "DFW", "HOU", "SAT", "KC", "STL", "INDY", "NASH", "DEN", "ATL"];

export default function BackfillSnapshotsPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [city, setCity] = useState("");

  const run = async () => {
    setRunning(true);
    setResult(null);
    setError(null);

    const now = new Date();
    const date_to = now.toISOString().slice(0, 10);
    const date_from = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().slice(0, 10);

    try {
      const payload = { date_from, date_to };
      if (city) payload.city = city;

      const res = await base44.functions.invoke("adminBackfillEventSnapshots", payload);
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-violet-500" />
          <CardTitle className="text-sm font-semibold">Backfill Financial Snapshots</CardTitle>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          Scans events from the last 12 months that are missing financial data (total fee, package, or add-ons)
          and re-applies the snapshot from their linked quote.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Cities</option>
            {CITY_OPTIONS.filter(Boolean).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <Button
            onClick={run}
            disabled={running}
            className="bg-violet-600 hover:bg-violet-700 gap-2"
          >
            {running
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
              : <><RefreshCw className="w-4 h-4" /> Run Backfill (Last 12 Months)</>
            }
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{result.scanned}</p>
                <p className="text-xs text-gray-500 mt-0.5">Candidates scanned</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.updated}</p>
                <p className="text-xs text-green-600 mt-0.5">Snapshots applied</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-500">{result.skipped}</p>
                <p className="text-xs text-gray-400 mt-0.5">Skipped (no quote)</p>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {result.errors.length} error{result.errors.length > 1 ? "s" : ""}
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-xs text-amber-800 font-mono">
                      {e.event_name || e.event_id}: {e.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.updated === 0 && result.errors?.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>All events already have financial snapshots. Nothing to backfill.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}