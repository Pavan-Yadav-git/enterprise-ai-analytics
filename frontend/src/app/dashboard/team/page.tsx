"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/store/useStore";
import { useStore } from "@/store/useStore";
import { 
  Users, UserPlus, Shield, Mail, Calendar, 
  Copy, Check, Trash2, ArrowRight, Sparkles, 
  HelpCircle, CheckCircle2, UserCheck, AlertCircle 
} from "lucide-react";

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { organization, token, user } = useStore();

  // Local state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);
  const [lastInviteEmail, setLastInviteEmail] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);

  // Accept simulation state
  const [simToken, setSimToken] = useState("");
  const [simProgress, setSimProgress] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [simMessage, setSimMessage] = useState("");

  // 1. Fetch organization members
  const { data: members = [], isLoading: isMembersLoading } = useQuery({
    queryKey: ["org-members", organization?.id],
    queryFn: async () => {
      const res = await api.get("/auth/members");
      return res.data;
    },
    enabled: !!organization && !!token,
  });

  // 2. Create Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        email: inviteEmail,
        role: inviteRole
      };
      const res = await api.post("/auth/invite", payload);
      return res.data;
    },
    onSuccess: (data) => {
      setLastInviteToken(data.token);
      setLastInviteEmail(data.email);
      setInviteEmail("");
      setInviteRole("Viewer");
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to issue teammate invitation. Verify your user role permissions.");
    }
  });

  // 3. Accept Invite Mutation (for local simulator)
  const acceptInviteMutation = useMutation({
    mutationFn: async (tokenStr: string) => {
      const res = await api.post("/auth/invite/accept", { token: tokenStr });
      return res.data;
    },
    onMutate: () => {
      setSimProgress("loading");
      setSimMessage("");
    },
    onSuccess: (data) => {
      setSimProgress("success");
      setSimMessage("Teammate successfully joined the workspace context!");
      setSimToken("");
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
    },
    onError: (err: any) => {
      setSimProgress("error");
      setSimMessage(err.response?.data?.detail || "Invalid or expired invitation token.");
    }
  });

  const copyTokenToClipboard = (tokenText: string) => {
    navigator.clipboard.writeText(tokenText);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === "Owner") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (role === "Admin") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    if (role === "Analyst") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  const getRoleRankName = (role: string) => {
    if (role === "Owner") return "Workspace Creator";
    if (role === "Admin") return "Administrative Access";
    if (role === "Analyst") return "Read & Write Aggregations";
    return "Read-Only Viewer";
  };

  return (
    <div className="space-y-8 animate-fade-in text-gray-100">
      {/* Header section */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Team Management</h2>
        <p className="text-sm text-gray-400 mt-1">
          Manage user permissions, adjust hierarchical roles, and onboard teams.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Members List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base">Active Teammates</h3>
                <span className="text-[10px] text-gray-500 block">
                  List of users who currently have database credentials for this tenant.
                </span>
              </div>
            </div>

            {isMembersLoading ? (
              <div className="space-y-3 py-6">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ) : members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[10px] text-gray-500 uppercase border-b border-white/5 tracking-wider font-semibold">
                    <tr>
                      <th className="pb-3.5 pl-2">User</th>
                      <th className="pb-3.5">Hierarchical Role</th>
                      <th className="pb-3.5">Joined Date</th>
                      <th className="pb-3.5 pr-2 text-right">Scope Permissions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {members.map((m: any) => (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 pl-2">
                          <div className="flex items-center gap-3">
                            {/* Avatar bubble */}
                            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-primary">
                              {m.user.email[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="font-medium text-white block">{m.user.email}</span>
                              {user?.id === m.user.id && (
                                <span className="text-[9px] text-gray-500 block">You (Active Context)</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold tracking-wider ${getRoleBadgeColor(m.role)}`}>
                              {m.role.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-gray-500" />
                            {new Date(m.joined_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3.5 pr-2 text-right text-[10px] text-gray-500">
                          {getRoleRankName(m.role)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-white/5 rounded-xl bg-gray-950/20">
                <Users className="mx-auto h-10 w-10 text-gray-600 mb-3" />
                <span className="text-xs font-semibold text-gray-400 block">No Teammates Found</span>
              </div>
            )}
          </div>

          {/* Local Teammate Onboarding Simulator */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Sparkles size={18} />
              <h3 className="font-semibold text-base">Onboarding Simulation Sandbox</h3>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              Simulate accepting an invitation using generated tokens. In a standard production environment, invitations are dispatched as active links via SMTP.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">INVITATION TOKEN</label>
                <input
                  type="text"
                  value={simToken}
                  onChange={(e) => setSimToken(e.target.value)}
                  placeholder="Paste or input uuid invitation token here..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 text-white transition-all font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => acceptInviteMutation.mutate(simToken)}
                  disabled={!simToken || acceptInviteMutation.isPending}
                  className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-xs"
                >
                  <UserCheck size={14} />
                  <span>Accept Invite</span>
                </button>
              </div>
            </div>

            {simProgress === "loading" && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs flex items-center gap-2 animate-pulse">
                <div className="h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                <span>Validating token credentials and matching email contexts...</span>
              </div>
            )}

            {simProgress === "success" && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} />
                <span>{simMessage}</span>
              </div>
            )}

            {simProgress === "error" && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{simMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Invite Teammate Form */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                <UserPlus size={18} />
              </div>
              <h3 className="font-semibold text-base">Invite Teammate</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLastInviteToken(null);
                inviteMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">EMAIL ADDRESS</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4.5 top-3.5 text-gray-500" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 text-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">ORGANIZATION ROLE</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-300"
                >
                  <option value="Viewer">Viewer (Read-only)</option>
                  <option value="Analyst">Analyst (Read & Write)</option>
                  <option value="Admin">Admin (Write & Keys)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviteMutation.isPending}
                className="w-full py-3 bg-gradient-to-br from-primary to-secondary text-black font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-cyan-glow disabled:opacity-50 text-xs"
              >
                {inviteMutation.isPending ? "Issuing Invite..." : "Send Invitation"}
              </button>
            </form>

            {/* Display newly created token for easy copy-paste */}
            {lastInviteToken && (
              <div className="mt-6 space-y-4 border-t border-white/5 pt-6 animate-slide-in">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Invite generated successfully!</span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 font-semibold block uppercase">RECIPIENT EMAIL</span>
                  <div className="bg-white/5 border border-white/5 px-3 py-2 rounded-lg text-xs font-mono text-gray-300">
                    {lastInviteEmail}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">SANDBOX TOKEN</span>
                    <button
                      onClick={() => copyTokenToClipboard(lastInviteToken)}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      {copiedToken ? (
                        <>
                          <Check size={10} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          <span>Copy Token</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-gray-950/80 border border-white/5 px-3 py-2.5 rounded-lg text-[10px] font-mono text-primary font-semibold select-all break-all tracking-tight">
                    {lastInviteToken}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
