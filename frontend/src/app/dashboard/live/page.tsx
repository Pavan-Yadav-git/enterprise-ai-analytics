"use client";

import { useEffect, useState } from "react";
import { Terminal, Activity, ArrowRight, CornerDownRight, Play, Pause, ChevronRight, ChevronDown } from "lucide-react";

interface RealTimeEvent {
  id: string;
  event_name: string;
  source_type: string;
  payload: Record<string, any>;
  timestamp: string;
}

export default function LiveStreamPage() {
  const [events, setEvents] = useState<RealTimeEvent[]>([]);
  const [isTailing, setIsTailing] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Bind listener to custom websocket messages dispatched in dashboard layout
  useEffect(() => {
    const handleNewEvent = (event: CustomEvent<any>) => {
      if (!isTailing) return;
      
      setEvents((prev) => {
        // Keep up to 100 recent events
        const updated = [event.detail, ...prev];
        return updated.slice(0, 100);
      });
    };

    window.addEventListener("new-realtime-event" as any, handleNewEvent as any);
    return () => {
      window.removeEventListener("new-realtime-event" as any, handleNewEvent as any);
    };
  }, [isTailing]);

  const toggleExpand = (id: string) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  const getSourceBadgeColor = (src: string) => {
    if (src === "api") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    if (src === "csv") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (src === "webhook") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Terminal size={28} className="text-primary animate-pulse" />
            <span>Live Stream Terminal</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">Real-time WebSocket event feed streaming directly from ingestion receivers</p>
        </div>

        <button
          onClick={() => setIsTailing(!isTailing)}
          className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all ${
            isTailing
              ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-lg shadow-emerald-500/10"
          }`}
        >
          {isTailing ? (
            <>
              <Pause size={14} />
              <span>Pause Ingestion Feed</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>Resume Real-Time Tail</span>
            </>
          )}
        </button>
      </div>

      {/* Main Console view */}
      <div className="glass-panel rounded-2xl overflow-hidden border-white/5 flex flex-col min-h-[500px]">
        {/* Terminal Header */}
        <div className="bg-gray-950/60 px-6 py-4 border-b border-white/5 flex items-center justify-between text-xs text-muted font-mono select-none">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
            </div>
            <span className="ml-2 font-semibold">websocket_console://wx-analytics:8000</span>
          </div>
          <span className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${isTailing ? "bg-green-400 animate-ping" : "bg-gray-500"}`} />
            {isTailing ? "CONNECTED - TAILING LIVE FEED" : "PAUSED"}
          </span>
        </div>

        {/* Logs terminal body */}
        <div className="flex-1 p-6 font-mono text-xs overflow-y-auto space-y-2.5 max-h-[600px] bg-gray-950/20">
          {events.length > 0 ? (
            events.map((ev) => {
              const isExpanded = expandedEventId === ev.id;
              return (
                <div key={ev.id} className="border-b border-white/5 pb-2.5 last:border-b-0 animate-slide-in">
                  {/* Event summary line */}
                  <div
                    onClick={() => toggleExpand(ev.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/5 p-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      <span className="text-[10px] text-gray-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      <span className="font-bold text-primary">{ev.event_name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Source tag */}
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getSourceBadgeColor(ev.source_type)}`}>
                        {ev.source_type.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-500 hidden md:inline">ID: {ev.id.slice(0, 8)}...</span>
                    </div>
                  </div>

                  {/* Expanded JSON details */}
                  {isExpanded && (
                    <div className="mt-3 ml-6 p-4 rounded-xl bg-gray-950/80 border border-white/5 flex items-start gap-2 shadow-inner text-gray-300">
                      <CornerDownRight size={14} className="text-primary mt-1 shrink-0" />
                      <div className="flex-1 overflow-x-auto">
                        <pre className="text-[11px] leading-relaxed select-text">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-muted gap-3 select-none">
              <Activity size={24} className="animate-spin text-primary" />
              <span>Listening for incoming WebSocket logs streams...</span>
              <span className="text-[10px] text-gray-500">Use the Simulator on the Overview Page to seed telemetry hits immediately</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
