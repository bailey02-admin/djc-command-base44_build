import BackfillSnapshotsPanel from "@/components/settings/BackfillSnapshotsPanel";
import RbacDebugPanel from "@/components/settings/RbacDebugPanel";

export default function SettingsAdminTools() {
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Tools</h1>
        <p className="text-sm text-gray-500 mt-0.5">System maintenance, data backfills, and RBAC inspection</p>
      </div>
      <BackfillSnapshotsPanel />
      <RbacDebugPanel />
    </div>
  );
}