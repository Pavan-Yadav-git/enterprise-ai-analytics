"use client";

import { useState } from "react";
import { api } from "@/store/useStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  AlertTriangle, Plus, BellRing, Trash2, ShieldAlert, CheckCircle2, 
  Slack, Mail, Laptop, ToggleLeft, ToggleRight, Loader2, Sparkles
} from "lucide-react";

export default function AlertsRulesPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states
  const [ruleName, setRuleName] = useState("");
  const [ruleMetric, setRuleMetric] = useState("api_error");
  const [ruleAggregation, setRuleAggregation] = useState("count");
  const [ruleOperator, setRuleOperator] = useState("gt");
  const [ruleThreshold, setRuleThreshold] = useState("5.0");
  const [ruleWindow, setRuleWindow] = useState("5");
  const [channels, setChannels] = useState<string[]>(["in_app"]);
  const [slackUrl, setSlackUrl] = useState("");

  // 1. Fetch Alert Rules
  const { data: rules = [], isLoading } = useQuery<any[]>({
    queryKey: ["alert-rules"],
    queryFn: async () => {
      const res = await api.get("/alerts");
      return res.data;
    }
  });

  // 2. Fetch Trigger History Log
  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["alert-history"],
    queryFn: async () => {
      const res = await api.get("/alerts/history");
      return res.data;
    }
  });

  // 3. Create Rule Mutation
  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/alerts", {
        name: ruleName,
        metric: ruleMetric,
        aggregation: ruleAggregation,
        operator: ruleOperator,
        threshold: parseFloat(ruleThreshold) || 1.0,
        evaluation_window_minutes: parseInt(ruleWindow) || 5,
        notification_channels: channels,
        webhook_url: slackUrl || null
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setIsCreateModalOpen(false);
      setRuleName("");
      setSlackUrl("");
      setChannels(["in_app"]);
    }
  });

  // 4. Mute Toggle Mutation
  const toggleMuteMutation = useMutation({
    mutationFn: async ({ id, isMuted }: { id: string; isMuted: boolean }) => {
      const res = await api.post(`/alerts/${id}/mute?mute=${isMuted}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    }
  });

  // 5. Delete Mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    }
  });

  const getStatusColor = (status: string) => {
    if (status === "Triggered") return "bg-red-500/10 text-red-400 border-red-500/20";
    if (status === "Muted") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  };

  const getOperatorLabel = (op: string) => {
    if (op === "gt") return ">";
    if (op === "lt") return "<";
    if (op === "eq") return "=";
    if (op === "gte") return "≥";
    if (op === "lte") return "≤";
    return op;
  };

  const toggleChannel = (ch: string) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 shimmer-wrapper">
        <div className="h-10 bg-white/5 rounded-xl w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-white/5 rounded-2xl" />
          <div className="h-96 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <AlertTriangle size={28} className="text-yellow-500" />
            <span>Alerts Rules Console</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">Configure telemetry threshold constraints and automated notification paths</p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-5 py-3 bg-gradient-to-br from-primary to-secondary text-black font-semibold rounded-xl flex items-center gap-2 hover:scale-[1.01] transition-all shadow-cyan-glow"
        >
          <Plus size={16} />
          <span>Add Rule</span>
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules List Panel */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <BellRing size={16} className="text-gray-500" />
            <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider">Active Rules ({rules.length})</h3>
          </div>

          {rules.length > 0 ? (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-bold text-sm text-gray-200">{rule.name}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${getStatusColor(rule.status)}`}>
                        {rule.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-muted leading-relaxed">
                      Aggregates: <code className="text-primary font-bold">{rule.aggregation}</code> of event <code className="text-primary font-bold">{rule.metric}</code>
                      <span className="mx-2">•</span>
                      Window: <code className="text-gray-300">{rule.evaluation_window_minutes}m</code>
                      <span className="mx-2">•</span>
                      Threshold: <code className="text-gray-300">{getOperatorLabel(rule.operator)} {rule.threshold}</code>
                    </div>

                    {/* Channel Indicators */}
                    <div className="flex items-center gap-3 pt-1">
                      {rule.notification_channels.includes("in_app") && <Laptop size={12} className="text-gray-500" />}
                      {rule.notification_channels.includes("email") && <Mail size={12} className="text-gray-500" />}
                      {rule.notification_channels.includes("webhook") && <Slack size={12} className="text-primary" />}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Toggle mute */}
                    <button
                      onClick={() => toggleMuteMutation.mutate({ id: rule.id, isMuted: rule.status !== "Muted" })}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {rule.status === "Muted" ? <ToggleLeft size={24} className="text-gray-600" /> : <ToggleRight size={24} className="text-primary" />}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm("Delete alert rule?")) {
                          deleteRuleMutation.mutate(rule.id);
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
            <div className="h-64 flex items-center justify-center text-xs text-muted">
              No alert thresholds configured yet
            </div>
          )}
        </div>

        {/* Alerts Log Panel */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
            <ShieldAlert size={16} className="text-gray-500" />
            <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider font-mono">Trigger Archive</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 max-h-[450px]">
            {history.length > 0 ? (
              history.map((row) => (
                <div key={row.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-300">{row.alert_rule?.name || "Rule"}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                      row.status === "Triggered" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-green-500/10 border-green-500/20 text-green-400"
                    }`}>
                      {row.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted mt-2">
                    Value triggered: <code className="text-gray-300">{row.triggered_value}</code>
                  </p>
                  <span className="text-[9px] text-gray-600 block mt-2">{new Date(row.triggered_at).toLocaleString()}</span>
                </div>
              ))
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-muted font-mono">
                Trigger history empty
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass-panel p-8 rounded-2xl border-white/10 shadow-2xl">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span>Define Alert Threshold</span>
            </h3>
            <p className="text-xs text-muted mb-6">Seeds standard rules to query time windows and post Slack payloads.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRuleMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">RULE NAME</label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Critical Failure Rate"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">EVENT METRIC NAME</label>
                  <input
                    type="text"
                    value={ruleMetric}
                    onChange={(e) => setRuleMetric(e.target.value)}
                    placeholder="e.g. api_error"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">AGGREGATION</label>
                  <select
                    value={ruleAggregation}
                    onChange={(e) => setRuleAggregation(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-300"
                  >
                    <option value="count">Count (Hits count)</option>
                    <option value="sum">Sum (Payload value sum)</option>
                    <option value="avg">Avg (Payload value avg)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">OPERATOR</label>
                  <select
                    value={ruleOperator}
                    onChange={(e) => setRuleOperator(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-300"
                  >
                    <option value="gt">Greater Than (&gt;)</option>
                    <option value="lt">Less Than (&lt;)</option>
                    <option value="eq">Equal (=)</option>
                    <option value="gte">Greater or Equal (≥)</option>
                    <option value="lte">Less or Equal (≤)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">THRESHOLD</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ruleThreshold}
                    onChange={(e) => setRuleThreshold(e.target.value)}
                    placeholder="e.g. 10"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">EVALUATION WINDOW (MINUTES)</label>
                  <input
                    type="number"
                    value={ruleWindow}
                    onChange={(e) => setRuleWindow(e.target.value)}
                    placeholder="e.g. 5"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div className="col-span-2 space-y-3">
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase">NOTIFICATION PATHS</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => toggleChannel("in_app")}
                      className={`flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                        channels.includes("in_app")
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Laptop size={14} />
                      In-App Toast
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleChannel("email")}
                      className={`flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                        channels.includes("email")
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Mail size={14} />
                      Email Alert
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleChannel("webhook")}
                      className={`flex-1 py-3 border rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                        channels.includes("webhook")
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Slack size={14} />
                      Slack Webhook
                    </button>
                  </div>
                </div>

                {channels.includes("webhook") && (
                  <div className="col-span-2 animate-slide-in">
                    <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">SLACK WEBHOOK URL</label>
                    <input
                      type="url"
                      value={slackUrl}
                      onChange={(e) => setSlackUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end mt-8">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-black hover:bg-primary-dark rounded-lg transition-all shadow-cyan-glow disabled:opacity-50"
                >
                  {createRuleMutation.isPending ? "Configuring..." : "Sync Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
