"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/store/useStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  BarChart3, Plus, Trash2, ArrowRight, Grid, Sparkles, 
  Activity, ShoppingCart, Terminal, Loader2 
} from "lucide-react";

export default function DashboardsListPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [newDashDesc, setNewDashDesc] = useState("");
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);

  // 1. Fetch all dashboards
  const { data: dashboards = [], isLoading } = useQuery<any[]>({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const res = await api.get("/dashboards");
      return res.data;
    }
  });

  // 2. Blank dashboard creation mutation
  const createDashMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/dashboards", {
        name: newDashName,
        description: newDashDesc || null
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      setIsCreateModalOpen(false);
      setNewDashName("");
      setNewDashDesc("");
    }
  });

  // 3. Seed template dashboard mutation
  const seedTemplateMutation = useMutation({
    mutationFn: async (templateName: string) => {
      setTemplateLoading(templateName);
      const res = await api.post(`/dashboards/template?template_name=${encodeURIComponent(templateName)}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      setTemplateLoading(null);
    },
    onError: () => {
      setTemplateLoading(null);
    }
  });

  // 4. Delete dashboard mutation
  const deleteDashMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/dashboards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    }
  });

  const templates = [
    {
      name: "Web Analytics",
      description: "Tails traffic sources, page views counts, and user agents.",
      icon: Activity,
      color: "text-primary bg-primary/10 border-primary/20"
    },
    {
      name: "Sales Funnel",
      description: "Monitors checkout completions, purchases value, and conversions.",
      icon: ShoppingCart,
      color: "text-accent bg-accent/10 border-accent/20"
    },
    {
      name: "DevOps Monitoring",
      description: "Tracks response latency trends, HTTP status codes, and exceptions.",
      icon: Terminal,
      color: "text-secondary bg-secondary/10 border-secondary/20"
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 shimmer-wrapper">
        <div className="h-10 bg-white/5 rounded-xl w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Analytics Panels</h2>
          <p className="text-sm text-gray-400 mt-1">Configure customized charts dashboards to visualize dynamic feeds</p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-5 py-3 bg-gradient-to-br from-primary to-secondary text-black font-semibold rounded-xl flex items-center gap-2 hover:scale-[1.01] transition-all shadow-cyan-glow"
        >
          <Plus size={16} />
          <span>New Dashboard</span>
        </button>
      </div>

      {/* Templates Row */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-gray-300 uppercase tracking-wider">Start with dynamic templates</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((tpl) => {
            const Icon = tpl.icon;
            const isSeeding = templateLoading === tpl.name;
            return (
              <div key={tpl.name} className="glass-panel p-6 rounded-2xl flex flex-col justify-between items-start gap-4">
                <div>
                  <div className={`p-3 rounded-xl border w-fit mb-4 ${tpl.color}`}>
                    <Icon size={20} />
                  </div>
                  <h4 className="font-bold text-base text-gray-200">{tpl.name}</h4>
                  <p className="text-xs text-muted mt-2 leading-relaxed">{tpl.description}</p>
                </div>
                
                <button
                  onClick={() => seedTemplateMutation.mutate(tpl.name)}
                  disabled={!!templateLoading}
                  className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-dark transition-colors disabled:opacity-50"
                >
                  {isSeeding ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Creating Panel...</span>
                    </>
                  ) : (
                    <>
                      <span>Seed Template</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dashboard List */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Grid size={16} className="text-gray-500" />
          <h3 className="font-semibold text-sm text-gray-300 uppercase tracking-wider">Configure dashboards</h3>
        </div>

        {dashboards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.map((dash) => (
              <div key={dash.id} className="glass-panel p-6 rounded-2xl flex flex-col justify-between glow-card relative">
                <div>
                  <h4 className="font-bold text-base text-gray-200 truncate">{dash.name}</h4>
                  <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed min-h-[32px]">
                    {dash.description || "No description provided."}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px] bg-white/5 border border-white/5 text-gray-400 px-2 py-0.5 rounded-full">
                      {dash.widgets?.length || 0} widgets
                    </span>
                    {dash.is_public && (
                      <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
                        Public Share Link
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
                  <Link
                    href={`/dashboard/analytics/${dash.id}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
                  >
                    <span>View Dashboard</span>
                    <ArrowRight size={14} />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this dashboard?")) {
                        deleteDashMutation.mutate(dash.id);
                      }
                    }}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel p-12 text-center rounded-2xl text-muted text-sm border-dashed">
            No dashboards defined yet. Click "New Dashboard" or seed standard templates above to begin!
          </div>
        )}
      </div>

      {/* Blank Dashboard Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-panel p-8 rounded-2xl border-white/10 shadow-2xl">
            <h3 className="font-bold text-lg mb-2">Create Custom Dashboard</h3>
            <p className="text-xs text-muted mb-6">Create a blank canvas to drag and configure custom query metrics.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createDashMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">PANEL TITLE</label>
                <input
                  type="text"
                  value={newDashName}
                  onChange={(e) => setNewDashName(e.target.value)}
                  placeholder="e.g. Server Performance Monitor"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">DESCRIPTION</label>
                <textarea
                  value={newDashDesc}
                  onChange={(e) => setNewDashDesc(e.target.value)}
                  placeholder="Summarize the metrics tracked inside this dashboard view..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDashMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-black hover:bg-primary-dark rounded-lg transition-all shadow-cyan-glow disabled:opacity-50"
                >
                  {createDashMutation.isPending ? "Spanning..." : "Sync Panel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
