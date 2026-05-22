"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "@/store/useStore";
import { Bell, X } from "lucide-react";
import "./globals.css";

// Declare query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initialize, organization } = useStore();
  const [globalToast, setGlobalToast] = useState<{ title: string; message: string } | null>(null);

  // Initialize store credentials
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Set up global alert catcher using EventSource/WebSockets or custom event listeners
  useEffect(() => {
    const handleAlert = (event: CustomEvent<{ title: string; message: string }>) => {
      setGlobalToast(event.detail);
      // Auto dismiss after 10s
      setTimeout(() => setGlobalToast(null), 10000);
    };

    window.addEventListener("app-alert" as any, handleAlert as any);
    return () => {
      window.removeEventListener("app-alert" as any, handleAlert as any);
    };
  }, []);

  return (
    <html lang="en">
      <head>
        <title>WexaAI Analytics Platform</title>
        <meta name="description" content="Production-grade real-time multi-tenant analytics dashboard" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-gray-100 min-h-screen">
        <QueryClientProvider client={queryClient}>
          {children}
          
          {/* Global Real-Time Alert Toast Notification */}
          {globalToast && (
            <div className="fixed bottom-6 right-6 z-50 max-w-sm glass-panel p-4 rounded-xl border-red-500/30 bg-red-950/20 text-white flex items-start gap-3 shadow-2xl animate-bounce">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                <Bell size={20} className="animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm leading-tight text-red-200">{globalToast.title}</h4>
                <p className="text-xs text-gray-300 mt-1">{globalToast.message}</p>
              </div>
              <button onClick={() => setGlobalToast(null)} className="text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
          )}
        </QueryClientProvider>
      </body>
    </html>
  );
}
