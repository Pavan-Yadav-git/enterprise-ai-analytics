"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/store/useStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, Plus, Settings2, Trash2, Maximize2, Minimize2, 
  RefreshCw, Calendar, Sparkles, Check, X, Eye, Loader2
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";

const CHART_COLORS = ["#06b6d4", "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981"];

// --- METRICS RENDERING SUB-COMPONENT ---
function WidgetChartPanel({ widget, timeRange, autoRefreshSeconds }: { widget: any; timeRange: string; autoRefreshSeconds: number }) {
  const queryConfig = widget.query_config || {};
  
  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ["widget-query", widget.id, timeRange],
    queryFn: async () => {
      const res = await api.get("/events/query", {
        params: {
          widget_id: widget.id,
          event_name: queryConfig.event_name,
          aggregation: queryConfig.aggregation,
          field_key: queryConfig.field_key || undefined,
          groupby: queryConfig.groupby || undefined,
          time_range: timeRange
        }
      });
      return res.data;
    },
    refetchInterval: autoRefreshSeconds > 0 ? autoRefreshSeconds * 1000 : false
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted shimmer-wrapper bg-white/5 rounded-2xl border border-white/5" />
    );
  }

  const chartData = result?.data || [];

  if (chartData.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-xs text-muted bg-white/5 rounded-2xl border border-white/5 p-4 text-center">
        <span>No data points recorded</span>
        <span className="text-[10px] text-gray-500 mt-1 block">Tweak the event name or query filters</span>
      </div>
    );
  }

  // 1. KPI Numeric Panel
  if (widget.type === "kpi") {
    // Sum up values
    const total = chartData.reduce((acc: number, cur: any) => acc + cur.value, 0);
    return (
      <div className="h-full flex flex-col justify-center p-6 bg-white/5 rounded-2xl border border-white/5">
        <span className="text-2xl md:text-4xl font-extrabold tracking-tight text-gradient">
          {widget.query_config.aggregation === "avg" 
            ? (total / chartData.length).toFixed(1)
            : total.toLocaleString()}
        </span>
        <span className="text-[10px] text-muted uppercase mt-2 font-bold tracking-wider">{widget.query_config.aggregation} of {widget.query_config.event_name}</span>
      </div>
    );
  }

  // 2. Data Table Panel
  if (widget.type === "table") {
    return (
      <div className="h-full overflow-y-auto bg-white/5 rounded-2xl border border-white/5 p-4">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-gray-400 font-bold uppercase tracking-wider pb-2">
              <th className="py-2">Label Context</th>
              <th className="py-2 text-right">Aggregate</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row: any, i: number) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                <td className="py-2.5 font-medium text-gray-200">{row.label || "unknown"}</td>
                <td className="py-2.5 text-right font-semibold text-primary">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 3. Recharts Line/Area Panel
  if (widget.type === "line") {
    return (
      <div className="h-full w-full bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
        <div className="h-full w-full min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="label" stroke="#4b5563" fontSize={9} tickLine={false} />
              <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px" }}
              />
              <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={1.5} fillOpacity={1} fill={`url(#grad-${widget.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 4. Recharts Bar Chart
  if (widget.type === "bar") {
    return (
      <div className="h-full w-full bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
        <div className="h-full w-full min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="label" stroke="#4b5563" fontSize={9} tickLine={false} />
              <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px" }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 5. Pie Chart
  if (widget.type === "pie") {
    return (
      <div className="h-full w-full bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col justify-center">
        <div className="h-full w-full min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                nameKey="label"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.9)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}

// --- MAIN DETAILED VIEW ---
export default function DashboardDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();

  const [timeRange, setTimeRange] = useState("24h");
  const [autoRefresh, setAutoRefresh] = useState(0); // 0 means Muted/Disabled
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);

  // Widget Form States
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetType, setWidgetType] = useState("line");
  const [queryEventName, setQueryEventName] = useState("page_view");
  const [queryAggregation, setQueryAggregation] = useState("count");
  const [queryFieldKey, setQueryFieldKey] = useState("");
  const [queryGroupby, setQueryGroupby] = useState("");

  // 1. Fetch Dashboard preloading widgets
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ["dashboard", id],
    queryFn: async () => {
      const res = await api.get(`/dashboards/${id}`);
      return res.data;
    }
  });

  // 2. Add Widget mutation
  const addWidgetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/dashboards/${id}/widgets`, {
        title: widgetTitle,
        type: widgetType,
        query_config: {
          event_name: queryEventName,
          aggregation: queryAggregation,
          field_key: queryFieldKey || null,
          groupby: queryGroupby || null
        },
        layout_config: {
          w: widgetType === "kpi" || widgetType === "pie" ? 4 : 6,
          h: 4
        }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", id] });
      setIsAddWidgetOpen(false);
      setWidgetTitle("");
      setQueryFieldKey("");
      setQueryGroupby("");
    }
  });

  // 3. Delete Widget mutation
  const deleteWidgetMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      await api.delete(`/dashboards/${id}/widgets/${widgetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", id] });
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 shimmer-wrapper">
        <div className="h-10 bg-white/5 rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white/5 rounded-2xl" />
          <div className="h-64 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="text-center py-12 text-muted">
        <h4>Panel not found</h4>
        <p className="text-xs mt-1">This dashboard may have been deleted.</p>
        <button onClick={() => router.push("/dashboard/analytics")} className="mt-4 text-xs font-semibold text-primary">
          Back to dashboards index
        </button>
      </div>
    );
  }

  const widgets = dashboard.widgets || [];

  return (
    <div className={`space-y-8 animate-fade-in ${isFullscreen ? "fixed inset-0 z-50 bg-background p-8 overflow-y-auto" : ""}`}>
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!isFullscreen && (
            <button
              onClick={() => router.push("/dashboard/analytics")}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">{dashboard.name}</h2>
            <p className="text-xs text-gray-400 mt-1">{dashboard.description || "Dashboard view"}</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Time range switcher */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 text-xs">
            {["15m", "1h", "24h", "7d", "30d"].map((rng) => (
              <button
                key={rng}
                onClick={() => setTimeRange(rng)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  timeRange === rng ? "bg-primary text-black font-semibold shadow-md" : "text-gray-400 hover:text-white"
                }`}
              >
                {rng}
              </button>
            ))}
          </div>

          {/* Auto Refresh dropdown */}
          <select
            value={autoRefresh}
            onChange={(e) => setAutoRefresh(parseInt(e.target.value))}
            className="px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-gray-300 focus:outline-none"
          >
            <option value={0}>Auto Refresh Off</option>
            <option value={30}>30s refresh</option>
            <option value={60}>1m refresh</option>
            <option value={300}>5m refresh</option>
          </select>

          {/* Full screen presentation switcher */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Add widget button */}
          <button
            onClick={() => setIsAddWidgetOpen(true)}
            className="px-4 py-2 bg-white text-black font-bold text-xs hover:bg-gray-200 rounded-xl flex items-center gap-1.5 transition-all shadow-lg"
          >
            <Plus size={14} />
            <span>Add Widget</span>
          </button>
        </div>
      </div>

      {/* Main Widgets Grid */}
      {widgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {widgets.map((wd: any) => (
            <div
              key={wd.id}
              className={`glass-panel p-6 rounded-2xl glow-card relative group flex flex-col justify-between overflow-hidden min-h-[300px] ${
                wd.type === "kpi" || wd.type === "pie" ? "md:col-span-4" : "md:col-span-6"
              }`}
            >
              {/* Header inside card */}
              <div className="flex items-center justify-between mb-4 z-10">
                <h4 className="font-bold text-sm text-gray-200">{wd.title}</h4>
                <button
                  onClick={() => {
                    if (confirm("Remove this widget from layout?")) {
                      deleteWidgetMutation.mutate(wd.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Render dynamic metric chart aggregates */}
              <div className="flex-1 min-h-[200px]">
                <WidgetChartPanel widget={wd} timeRange={timeRange} autoRefreshSeconds={autoRefresh} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-16 text-center rounded-2xl text-muted text-sm border-dashed">
          No charts widgets mapped inside layout. Click "Add Widget" above to seed metrics aggregation charts!
        </div>
      )}

      {/* Add Widget Overlay Form Modal */}
      {isAddWidgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass-panel p-8 rounded-2xl border-white/10 shadow-2xl">
            <h3 className="font-bold text-lg mb-2">Create Custom Analytics Chart</h3>
            <p className="text-xs text-muted mb-6">Map aggregations over Pydantic-validated events properties.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addWidgetMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">CHART TITLE</label>
                  <input
                    type="text"
                    value={widgetTitle}
                    onChange={(e) => setWidgetTitle(e.target.value)}
                    placeholder="e.g. Daily Checkouts"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">CHART TYPE</label>
                  <select
                    value={widgetType}
                    onChange={(e) => setWidgetType(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-300"
                  >
                    <option value="line">Line (Timeline)</option>
                    <option value="bar">Bar (Breakdown)</option>
                    <option value="pie">Pie (Proportions)</option>
                    <option value="kpi">KPI Card (Metric total)</option>
                    <option value="table">Table (Logs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">EVENT NAME</label>
                  <input
                    type="text"
                    value={queryEventName}
                    onChange={(e) => setQueryEventName(e.target.value)}
                    placeholder="e.g. checkout_success"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">AGGREGATION</label>
                  <select
                    value={queryAggregation}
                    onChange={(e) => setQueryAggregation(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-300"
                  >
                    <option value="count">Count (Hits count)</option>
                    <option value="sum">Sum (Numeric value)</option>
                    <option value="avg">Avg (Numeric value)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">FIELD VALUE KEY (SUM/AVG ONLY)</label>
                  <input
                    type="text"
                    value={queryFieldKey}
                    onChange={(e) => setQueryFieldKey(e.target.value)}
                    placeholder="e.g. payload.revenue"
                    disabled={queryAggregation === "count"}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all disabled:opacity-30"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">GROUP-BY PROPERTY KEY (BAR/PIE ONLY)</label>
                  <input
                    type="text"
                    value={queryGroupby}
                    onChange={(e) => setQueryGroupby(e.target.value)}
                    placeholder="e.g. payload.browser"
                    disabled={widgetType === "kpi" || widgetType === "line"}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all disabled:opacity-30"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-8">
                <button
                  type="button"
                  onClick={() => setIsAddWidgetOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addWidgetMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-black hover:bg-primary-dark rounded-lg transition-all shadow-cyan-glow disabled:opacity-50"
                >
                  {addWidgetMutation.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin inline mr-1" />
                      <span>Syncing Chart...</span>
                    </>
                  ) : (
                    "Seed Chart Panel"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
