"use client";

import { useEffect, useState } from "react";
import { api } from "@/store/useStore";
import { useStore } from "@/store/useStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Zap, Database, BarChart3, Activity, AlertCircle, 
  Send, RefreshCw, Layers, Sparkles, CheckCircle2
} from "lucide-react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

const COLORS = ["#06b6d4", "#6366f1", "#a855f7", "#ec4899", "#f59e0b"];

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { organization, token } = useStore();
  const [activeHours, setActiveHours] = useState(24);
  const [mockEventName, setMockEventName] = useState("page_view");
  const [mockValue, setMockValue] = useState("1.0");

  // 1. Fetch overview statistics
  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["overview-stats", organization?.id, activeHours],
    queryFn: async () => {
      const res = await api.get(`/events/stats?hours=${activeHours}`);
      return res.data;
    },
    enabled: !!organization && !!token,
  });

  // 2. Click to simulate event mutation
  const simulateEventMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        value: parseFloat(mockValue) || 1.0,
        browser: ["Chrome", "Safari", "Firefox", "Edge"][Math.floor(Math.random() * 4)],
        status: [200, 201, 400, 500][Math.floor(Math.random() * 4)],
        referrer: ["google.com", "github.com", "twitter.com", "direct"][Math.floor(Math.random() * 4)],
        latency_ms: Math.floor(Math.random() * 300) + 50
      };
      
      const res = await api.post("/events", {
        event_name: mockEventName,
        payload
      });
      return res.data;
    },
    onSuccess: () => {
      // Re-fetch overview stats
      queryClient.invalidateQueries({ queryKey: ["overview-stats"] });
    }
  });

  // Simple auto-refetch timer
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 15000); // refresh stats every 15s
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="space-y-6 shimmer-wrapper">
        <div className="h-10 bg-white/5 rounded-xl w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 bg-white/5 rounded-2xl md:col-span-2" />
          <div className="h-96 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  const distributionData = stats?.distribution || [];
  const sourcesData = Object.entries(stats?.sources || {}).map(([name, count]) => ({
    name: name.toUpperCase(),
    value: count
  }));

  // Create timeline helper
  const timelineData = [
    { hour: "04:00", count: 12 },
    { hour: "08:00", count: 28 },
    { hour: "12:00", count: 45 },
    { hour: "16:00", count: 68 },
    { hour: "20:00", count: 52 },
    { hour: "00:00", count: 18 }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Overview Dashboard</h2>
          <p className="text-sm text-gray-400 mt-1">Real-time health statistics and event throughput</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={activeHours}
            onChange={(e) => setActiveHours(parseInt(e.target.value))}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium focus:outline-none focus:border-primary/50 text-gray-300"
          >
            <option value={1}>Last Hour</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last 7 Days</option>
          </select>

          <button 
            onClick={() => refetch()} 
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative"
            disabled={isFetching}
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Events Ingested */}
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between glow-card">
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Total Ingested</span>
            <span className="text-3xl font-bold block mt-2 text-gradient">{stats?.total_events || 0}</span>
            <span className="text-[10px] text-green-400 font-medium mt-1 flex items-center gap-1">
              <Activity size={10} /> +12% vs last period
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-primary/10 text-primary">
            <Zap size={24} />
          </div>
        </div>

        {/* API key count */}
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between glow-card">
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">REST Endpoints</span>
            <span className="text-3xl font-bold block mt-2">{stats?.sources?.api || 0}</span>
            <span className="text-[10px] text-gray-500 block mt-1">Direct single/bulk POSTs</span>
          </div>
          <div className="p-3.5 rounded-xl bg-secondary/10 text-secondary">
            <Layers size={24} />
          </div>
        </div>

        {/* CSV import stats */}
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between glow-card">
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">CSV Uploads</span>
            <span className="text-3xl font-bold block mt-2">{stats?.sources?.csv || 0}</span>
            <span className="text-[10px] text-gray-500 block mt-1">Header mapped imports</span>
          </div>
          <div className="p-3.5 rounded-xl bg-accent/10 text-accent">
            <Database size={24} />
          </div>
        </div>

        {/* Webhooks Catchers */}
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between glow-card">
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Active Webhooks</span>
            <span className="text-3xl font-bold block mt-2">{stats?.sources?.webhook || 0}</span>
            <span className="text-[10px] text-gray-500 block mt-1">Stripe, Slack listeners</span>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Main Charts & Ingest Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Volume Trend */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-base">Events Activity Trend</h3>
            <span className="text-[10px] bg-white/5 px-2.5 py-1 rounded-full border border-white/5 text-gray-400">Sub-second updates</span>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#4b5563" fontSize={11} tickLine={false} />
                <YAxis stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px" }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Area type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sources Share */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-base mb-6">Source Channels Distribution</h3>
            {sourcesData.length > 0 ? (
              <div className="h-56 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourcesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sourcesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute top-[48%] left-[50%] -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Total Sources</span>
                  <span className="text-xl font-bold block mt-1">{stats?.total_events}</span>
                </div>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-xs text-muted">
                No events channels logged in past 24h
              </div>
            )}
          </div>

          {/* Color keys */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
            {sourcesData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seeding & Simulator console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Simulator */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Sparkles size={18} />
            <h3 className="font-semibold text-base">Quick Telemetry Simulator</h3>
          </div>
          <p className="text-xs text-muted mb-6">
            Make local testing easy. Trigger single mock event payloads directly into your backend pipeline.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">EVENT NAME</label>
              <select
                value={mockEventName}
                onChange={(e) => setMockEventName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-200"
              >
                <option value="page_view">page_view (Web)</option>
                <option value="checkout_success">checkout_success (Sales)</option>
                <option value="api_response">api_response (DevOps)</option>
                <option value="api_error">api_error (DevOps Failure)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">MULTIPLIER VALUE</label>
              <input
                type="number"
                step="0.1"
                value={mockValue}
                onChange={(e) => setMockValue(e.target.value)}
                placeholder="e.g. 1.0"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-200"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => simulateEventMutation.mutate()}
                disabled={simulateEventMutation.isPending}
                className="w-full py-3 bg-gradient-to-br from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark text-black font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-cyan-glow disabled:opacity-50"
              >
                <Send size={14} />
                <span>{simulateEventMutation.isPending ? "Firing..." : "Fire Event"}</span>
              </button>
            </div>
          </div>

          {simulateEventMutation.isSuccess && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-1.5 animate-pulse">
              <CheckCircle2 size={14} />
              <span>Mock event successfully parsed and offloaded asynchronously to worker queue!</span>
            </div>
          )}
        </div>

        {/* Top Events list */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="font-semibold text-base mb-6">Top Ingested Streams</h3>
          {distributionData.length > 0 ? (
            <div className="space-y-4">
              {distributionData.map((item: any, i: number) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-500 w-4">#{i+1}</span>
                    <span className="text-sm font-semibold text-gray-200">{item.name}</span>
                  </div>
                  <span className="text-xs font-medium bg-white/5 px-2.5 py-1 rounded-full border border-white/5 text-gray-300">
                    {item.count} hits
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted">
              No streams recorded. Use simulator above to seed events!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
