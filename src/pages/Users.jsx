import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { UserAPI } from "../components/api/secureApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserPlus, MoreHorizontal, Search, Mail, RotateCcw, UserX, UserCheck, Edit } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = ["admin","sales_manager","sales_rep","city_manager","office_finalizer","finance","dj","client"];
const CITY_OPTIONS = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];

const INVITE_BADGE = {
  not_invited: "bg-gray-100 text-gray-500",
  invited: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
};

export default function Users() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  const filters = {
    search: search || undefined,
    role: roleFilter || undefined,
    city: cityFilter || undefined,
    is_active: activeFilter === "" ? undefined : activeFilter,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["users", filters],
    queryFn: () => UserAPI.list(filters),
    staleTime: 30_000,
  });

  const users = data?.users || [];

  const handleAction = async (action, userId) => {
    setLoadingId(userId);
    try {
      if (action === "deactivate") await UserAPI.deactivate(userId);
      else if (action === "reactivate") await UserAPI.reactivate(userId);
      else if (action === "invite") await UserAPI.invite(userId);
      else if (action === "reset") await UserAPI.requestPasswordReset(users.find(u => u.id === userId)?.email);
      qc.invalidateQueries(["users"]);
      toast.success(
        action === "invite" ? "Invite sent!" :
        action === "reset" ? "Password reset email sent!" :
        action === "deactivate" ? "User deactivated" : "User reactivated"
      );
    } catch (e) {
      toast.error(e.message || "Action failed");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? "—"} total users</p>
        </div>
        <Link to={createPageUrl("UserForm")}>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <UserPlus className="w-4 h-4" /> New User
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Roles</SelectItem>
            {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="All Cities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Cities</SelectItem>
            {CITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Cities</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Invite</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
              : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.full_name || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs capitalize">{u.role?.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                    {(u.cities || []).join(", ") || u.default_city || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.is_active !== false
                      ? <Badge className="bg-emerald-50 text-emerald-700 text-xs border-0">Active</Badge>
                      : <Badge className="bg-red-50 text-red-600 text-xs border-0">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVITE_BADGE[u.invite_status || 'not_invited']}`}>
                      {(u.invite_status || 'not_invited').replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loadingId === u.id}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl("UserForm") + `?id=${u.id}`} className="flex items-center gap-2">
                            <Edit className="w-4 h-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        {u.invite_status !== 'accepted' && (
                          <DropdownMenuItem onClick={() => handleAction("invite", u.id)} className="gap-2">
                            <Mail className="w-4 h-4" />
                            {u.invite_status === 'invited' ? 'Re-invite' : 'Send Invite'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleAction("reset", u.id)} className="gap-2">
                          <RotateCcw className="w-4 h-4" /> Reset Password
                        </DropdownMenuItem>
                        {u.is_active !== false
                          ? <DropdownMenuItem onClick={() => handleAction("deactivate", u.id)} className="gap-2 text-red-600">
                              <UserX className="w-4 h-4" /> Deactivate
                            </DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => handleAction("reactivate", u.id)} className="gap-2 text-emerald-600">
                              <UserCheck className="w-4 h-4" /> Reactivate
                            </DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}