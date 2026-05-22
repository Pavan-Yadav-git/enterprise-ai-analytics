"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Shield, Zap, Bell, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col justify-between">
      {/* Premium Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-secondary text-black shadow-cyan-glow">
            <BarChart3 size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight">WexaAI Analytics</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="px-4 py-2 text-sm font-medium bg-white text-black hover:bg-gray-200 rounded-xl transition-all shadow-lg hover:shadow-cyan-glow">
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16 text-center z-10 flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-primary mb-8 hover:bg-white/10 transition-colors cursor-pointer">
          <Zap size={14} />
          <span>Ingest millions of metrics instantly</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight">
          Real-Time Analytics, <br />
          <span className="text-gradient">Engineered for Organizations</span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mt-6 leading-relaxed">
          Ingest data from custom sources, compile sub-second dynamic metric trends, and configure threshold alert triggers across Slack, email, and WebSockets.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-10 justify-center">
          <Link href="/register" className="px-8 py-4 bg-gradient-to-br from-primary to-secondary text-black font-semibold rounded-xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-cyan-glow">
            Start Seeding Free
            <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold rounded-xl transition-all">
            Dashboard Console
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mt-24">
          <div className="glass-panel p-8 rounded-2xl text-left glow-card">
            <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-6">
              <Zap size={24} className="animate-pulse" />
            </div>
            <h3 className="font-semibold text-lg">Asynchronous Ingestion</h3>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Push single or bulk records asynchronously using celery job queues. Zero blocking in ingestion pipelines.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl text-left glow-card">
            <div className="p-3 rounded-xl bg-secondary/10 text-secondary w-fit mb-6">
              <Shield size={24} />
            </div>
            <h3 className="font-semibold text-lg">Multi-Tenancy Isolation</h3>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Strict database isolation at query limits. Control permissions securely via Owner, Admin, and Analyst roles.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl text-left glow-card">
            <div className="p-3 rounded-xl bg-accent/10 text-accent w-fit mb-6">
              <Bell size={24} />
            </div>
            <h3 className="font-semibold text-lg">Threshold Rules Engine</h3>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Define triggers (e.g. Error rates &gt; 5%) evaluated continuously, notifying team channels in real-time.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 z-10 gap-4">
        <span>© 2026 WexaAI Analytics Platform. All rights reserved.</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
}
