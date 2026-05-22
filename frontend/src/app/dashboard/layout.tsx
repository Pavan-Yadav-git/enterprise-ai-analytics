"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore, api } from "@/store/useStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  BarChart3, LayoutDashboard, Database, AlertTriangle, 
  Settings, Users, LogOut, ChevronDown, Bell, Plus, RefreshCw, Terminal
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    user, token, organization, organizations, 
    setOrganization, setOrganizations, logout 
  } = useStore();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isNewOrgModalOpen, setIsNewOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // 1. Establish real-time WebSocket tunnel
  useWebSocket((msg) => {
    if (msg.type === "alert_notification") {
      // Trigger global notification toast using CustomEvent
      const event = new CustomEvent("app-alert", {
        detail: { title: msg.title, message: msg.message }
      });
      window.dispatchEvent(event);
      // Fetch fresh alerts notifications
      fetchNotifications();
    } else if (msg.type === "new_event") {
      // Dispatch custom event for the Live console page
      const event = new CustomEvent("new-realtime-event", { detail: msg });
      window.dispatchEvent(event);
    }
  });

  const fetchNotifications = async () => {
    if (!token || !organization) return;
    try {
      const res = await api.get("/auth/members"); // simple read verify
      // For brevity, we mock a few notifications if none in DB or pull real notifications
      const notifRes = await api.get("/auth/members"); // replace or fetch real notifs
      // We can create notification fetch endpoints or just read mock logs
    } catch (e) {}
  };

  useEffect(() => {
    fetchNotifications();
  }, [organization, token]);

  // Click outside handler for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Redirect if unauthenticated
  useEffect(() => {
    // Wait a brief tick for store parsing
    const timer = setTimeout(() => {
      if (!useStore.getState().token) {
        router.push("/login");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [token, router]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName) return;
    try {
      // Call new backend endpoint to create a real organization tenant
      const res = await api.post("/auth/organizations", {
        name: newOrgName
      });
      const newOrg = res.data;
      
      // Refresh list from backend
      const orgsRes = await api.get("/auth/organizations");
      setOrganizations(orgsRes.data);
      
      // Select the newly created organization
      setOrganization(newOrg);
      setIsNewOrgModalOpen(false);
      setNewOrgName("");
    } catch (err: any) {
      console.error("Failed to create workspace:", err);
      alert(err.response?.data?.detail || "Failed to create organization. Please try again.");
    }
  };

  const menuItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Dashboards", href: "/dashboard/analytics", icon: BarChart3 },
    { name: "Live Events Stream", href: "/dashboard/live", icon: Terminal },
    { name: "Alert Rules", href: "/dashboard/alerts", icon: AlertTriangle },
    { name: "Ingestion & API Keys", href: "/dashboard/ingestion", icon: Database },
    { name: "Team Management", href: "/dashboard/team", icon: Users },
  ];

  if (!token || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-gray-100 overflow-hidden">
      {/* Sidebar navigation */}
      <aside className="w-64 bg-gray-950/40 border-r border-white/5 flex flex-col justify-between z-20 shrink-0">
        <div>
          {/* Logo container */}
          <div className="p-6 border-b border-white/5 flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-secondary text-black shadow-cyan-glow">
              <BarChart3 size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight">WexaAI Analytics</span>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 mt-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-gradient-to-br from-primary/10 to-secondary/10 border-l-2 border-primary text-white shadow-glass"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-primary" : "text-gray-500"} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-black shadow-cyan-glow">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-none">{user.email}</p>
              <span className="text-[10px] text-gray-500 mt-1 block">Active Workspace</span>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-white/5 bg-gray-950/20 px-8 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            {/* Organization Context Switcher */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-medium text-sm text-gray-200"
              >
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>{organization?.name || "No Workspace"}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {isOrgDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 glass-panel rounded-xl py-1.5 shadow-2xl z-30">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Switch Organization
                  </div>
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setOrganization(org);
                        setIsOrgDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-all hover:bg-white/5 ${
                        org.id === organization?.id ? "text-primary font-semibold" : "text-gray-300"
                      }`}
                    >
                      {org.name}
                    </button>
                  ))}
                  <div className="border-t border-white/5 my-1.5" />
                  <button
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      setIsNewOrgModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-2"
                  >
                    <Plus size={14} />
                    <span>Create Organization</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-4">
            <button onClick={fetchNotifications} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="h-8 w-px bg-white/5" />
            <div className="text-xs text-gray-400 font-medium">
              Org Key Context: <code className="text-gray-300 bg-white/5 px-2 py-1 rounded border border-white/5">{organization?.id.slice(0, 8)}...</code>
            </div>
          </div>
        </header>

        {/* Children contents wrapper */}
        <main className="flex-1 overflow-y-auto bg-background p-8 relative">
          {children}
        </main>
      </div>

      {/* New Org Onboarding Modal */}
      {isNewOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel p-8 rounded-2xl border-white/10 shadow-2xl">
            <h3 className="font-bold text-lg mb-2">New Organization</h3>
            <p className="text-xs text-muted mb-6">Spin up a new tenant workspace to monitor isolated analytics feeds.</p>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">ORGANIZATION NAME</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Sales Team"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setIsNewOrgModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-primary text-black hover:bg-primary-dark rounded-lg transition-all shadow-cyan-glow">
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
