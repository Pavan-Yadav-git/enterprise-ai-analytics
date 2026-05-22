"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/store/useStore";
import { useStore } from "@/store/useStore";
import { 
  Key, Plus, Trash2, Copy, Check, FileSpreadsheet, 
  UploadCloud, AlertCircle, Info, RefreshCw, Lock, 
  ShieldAlert, Eye, Calendar, Sparkles, CheckCircle2 
} from "lucide-react";

export default function IngestionPage() {
  const queryClient = useQueryClient();
  const { organization, token } = useStore();
  
  // Local state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [generatedKey, setGeneratedKey] = useState<any>(null);
  const [createKeyError, setCreateKeyError] = useState<string | null>(null);
  
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedRawKey, setCopiedRawKey] = useState(false);
  
  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch API Keys
  const { data: keys = [], isLoading: isKeysLoading, refetch: refetchKeys } = useQuery({
    queryKey: ["org-api-keys", organization?.id],
    queryFn: async () => {
      const res = await api.get("/keys");
      return res.data;
    },
    enabled: !!organization && !!token,
  });

  // 2. Generate Key Mutation
  const createKeyMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: keyName,
        expires_in_days: expiresInDays ? parseInt(expiresInDays) : null
      };
      const res = await api.post("/keys", payload);
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data);
      setKeyName("");
      setCreateKeyError(null);
      queryClient.invalidateQueries({ queryKey: ["org-api-keys"] });
    },
    onError: (err: any) => {
      setCreateKeyError(
        err.response?.data?.detail || "Failed to generate key. Please verify your workspace permissions."
      );
    }
  });

  // 3. Revoke Key Mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await api.delete(`/keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-api-keys"] });
    }
  });

  // 4. CSV Upload Mutation
  const uploadCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/events/upload-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onMutate: () => {
      setUploadProgress("uploading");
      setUploadMessage("Parsing columns and transferring payload...");
    },
    onSuccess: (data) => {
      setUploadProgress("success");
      setUploadMessage(data.message || "CSV batch successfully uploaded and queued!");
      setCsvFile(null);
      // Invalidate stats queries to update the main dashboard
      queryClient.invalidateQueries({ queryKey: ["overview-stats"] });
    },
    onError: (err: any) => {
      setUploadProgress("error");
      setUploadMessage(err.response?.data?.detail || "CSV upload failed. Make sure formatting is correct.");
    }
  });

  // Helper copy function
  const copyToClipboard = (text: string, id: string, isRaw = false) => {
    navigator.clipboard.writeText(text);
    if (isRaw) {
      setCopiedRawKey(true);
      setTimeout(() => setCopiedRawKey(false), 2000);
    } else {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    }
  };

  // CSV Drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith(".csv")) {
      setCsvFile(files[0]);
      setUploadProgress("idle");
      setUploadMessage("");
    } else {
      setUploadProgress("error");
      setUploadMessage("Invalid file format. Please upload standard CSV.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setCsvFile(files[0]);
      setUploadProgress("idle");
      setUploadMessage("");
    }
  };

  const triggerUpload = () => {
    if (csvFile) {
      uploadCsvMutation.mutate(csvFile);
    }
  };

  const clearCsv = () => {
    setCsvFile(null);
    setUploadProgress("idle");
    setUploadMessage("");
  };

  return (
    <div className="space-y-8 animate-fade-in text-gray-100">
      {/* Header section */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Ingestion & API Keys</h2>
        <p className="text-sm text-gray-400 mt-1">
          Manage secure endpoints, programmatic keys, and bulk datasets upload pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: API Key List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Organization API Keys</h3>
                  <span className="text-[10px] text-gray-500 block">
                    Authenticates server-side REST ingest requests to your organization.
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  if (!organization) {
                    alert("Please select or create an organization workspace from the top workspace switcher first.");
                    return;
                  }
                  setGeneratedKey(null);
                  setCreateKeyError(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-br from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-cyan-glow"
              >
                <Plus size={14} />
                <span>Generate API Key</span>
              </button>
            </div>

            {isKeysLoading ? (
              <div className="space-y-3 py-6">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ) : keys.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[10px] text-gray-500 uppercase border-b border-white/5 tracking-wider font-semibold">
                    <tr>
                      <th className="pb-3.5 pl-2">Name</th>
                      <th className="pb-3.5">Key Prefix</th>
                      <th className="pb-3.5">Expires</th>
                      <th className="pb-3.5 text-center">Status</th>
                      <th className="pb-3.5 pr-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {keys.map((k: any) => (
                      <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 pl-2 font-medium text-white">{k.name}</td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <code className="bg-white/5 px-2.5 py-0.5 rounded border border-white/5 text-[11px] font-mono tracking-tight text-gray-400">
                              {k.key_prefix}...
                            </code>
                          </div>
                        </td>
                        <td className="py-3.5 text-gray-400">
                          {k.expires_at ? (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-gray-500" />
                              {new Date(k.expires_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-500">Never</span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <div className="flex justify-center">
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider ${
                              k.is_active 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>
                              {k.is_active ? "ACTIVE" : "REVOKED"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-2 text-right">
                          {k.is_active && (
                            <button
                              onClick={() => {
                                if (confirm("Are you sure you want to revoke this API key? This cannot be undone and will break ingestion pipelines using this key.")) {
                                  revokeKeyMutation.mutate(k.id);
                                }
                              }}
                              disabled={revokeKeyMutation.isPending}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Revoke API Key"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-white/5 rounded-xl bg-gray-950/20">
                <Lock className="mx-auto h-10 w-10 text-gray-600 mb-3" />
                <span className="text-xs font-semibold text-gray-400 block">No Active API Keys</span>
                <p className="text-[10px] text-gray-500 max-w-xs mx-auto mt-1">
                  You have not generated any programmatic access keys for this organization. Generate one to start pushing logs.
                </p>
              </div>
            )}
          </div>

          {/* Quick API Documentation */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Info size={16} className="text-primary" />
              <span>Programmatic ingestion guide</span>
            </h3>
            
            <div className="space-y-4 text-xs">
              <p className="text-gray-400 leading-relaxed">
                Send single events or bulk aggregates securely. Set the header 
                <code className="text-primary bg-white/5 border border-white/5 px-1.5 py-0.5 mx-1 rounded">Authorization: Bearer &lt;YOUR_API_KEY&gt;</code> 
                and send standard JSON logs payload.
              </p>

              <div className="rounded-xl border border-white/5 overflow-hidden">
                {/* Tab selector mock */}
                <div className="bg-gray-950/40 px-4 py-2 border-b border-white/5 text-[10px] font-mono flex gap-3 text-gray-400">
                  <span className="text-primary font-bold border-b border-primary pb-1">cURL (POST)</span>
                  <span>Python</span>
                  <span>Node.js</span>
                </div>
                <div className="bg-gray-950/20 p-4 font-mono text-[10px] leading-relaxed text-gray-300 overflow-x-auto whitespace-nowrap">
                  <div>curl -X POST http://localhost:8000/api/v1/events \</div>
                  <div>  -H &quot;Content-Type: application/json&quot; \</div>
                  <div>  -H &quot;Authorization: Bearer pk_live_your_key_here&quot; \</div>
                  <div>  -d &#39;&#123;</div>
                  <div>    &quot;event_name&quot;: &quot;checkout_success&quot;,</div>
                  <div>    &quot;payload&quot;: &#123; &quot;value&quot;: 99.50, &quot;items&quot;: 3 &#125;</div>
                  <div>  &#125;&#39;</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: CSV Upload Area */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <FileSpreadsheet size={18} />
                </div>
                <h3 className="font-semibold text-base">Bulk Dataset Uploader</h3>
              </div>
              <p className="text-xs text-muted mb-6">
                Parse large CSV datasets and sync them to your timeseries databases asynchronously.
              </p>

              {/* Drag zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? "border-primary bg-primary/5 text-primary"
                    : csvFile
                      ? "border-purple-500/40 bg-purple-500/5 text-purple-300"
                      : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
                
                {csvFile ? (
                  <>
                    <FileSpreadsheet className="h-10 w-10 text-purple-400 animate-bounce" />
                    <div>
                      <span className="text-xs font-semibold block text-white truncate max-w-[200px]">
                        {csvFile.name}
                      </span>
                      <span className="text-[10px] text-gray-500 block mt-1">
                        {(csvFile.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-10 w-10 text-gray-500" />
                    <div>
                      <span className="text-xs font-semibold block text-gray-300">
                        Drag & Drop CSV
                      </span>
                      <span className="text-[10px] text-gray-500 block mt-1">
                        or click to browse local files
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* CSV Columns requirement block */}
              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/5 text-[10px] text-gray-400 space-y-1">
                <span className="font-semibold text-gray-300 block mb-1">CSV Header Blueprint:</span>
                <div>- Must contain an <code className="text-primary font-mono font-bold">event_name</code> column.</div>
                <div>- Other headers map as key-value pairs into custom payloads automatically.</div>
              </div>
            </div>

            {/* In-uploader state messages */}
            <div className="mt-6 space-y-4">
              {uploadProgress === "uploading" && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] flex items-center gap-2 animate-pulse">
                  <RefreshCw size={14} className="animate-spin shrink-0" />
                  <span>{uploadMessage}</span>
                </div>
              )}

              {uploadProgress === "success" && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{uploadMessage}</span>
                </div>
              )}

              {uploadProgress === "error" && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="break-all">{uploadMessage}</span>
                </div>
              )}

              {csvFile && uploadProgress !== "uploading" && (
                <div className="flex gap-2 w-full mt-4">
                  <button
                    onClick={clearCsv}
                    className="flex-1 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white font-bold text-xs transition-colors"
                  >
                    Clear File
                  </button>
                  <button
                    onClick={triggerUpload}
                    className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-lg shadow-purple-500/20"
                  >
                    Ingest Dataset
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Key Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-8 rounded-2xl border-white/10 shadow-2xl space-y-6">
            <div>
              <h3 className="font-bold text-lg text-white">Generate Organization API Key</h3>
              <p className="text-xs text-muted mt-1">
                Provide access details below. Raw secrets are revealed exactly once and hashed immediately.
              </p>
            </div>

            {!generatedKey ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCreateKeyError(null);
                  createKeyMutation.mutate();
                }}
                className="space-y-4"
              >
                {createKeyError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{createKeyError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">Key Name</label>
                  <input
                    type="text"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. Production Backend Ingestion"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50 text-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-2 uppercase">Lifespan In Days</label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-gray-300"
                  >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="365">365 Days</option>
                    <option value="">Never Expires (Permanent)</option>
                  </select>
                </div>

                <div className="flex gap-3 justify-end mt-8">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createKeyMutation.isPending}
                    className="px-4 py-2.5 text-xs font-semibold bg-primary text-black hover:bg-primary-dark rounded-xl transition-all shadow-cyan-glow disabled:opacity-50"
                  >
                    {createKeyMutation.isPending ? "Generating..." : "Generate Key"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Key Reveal alert */}
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex gap-2">
                  <ShieldAlert size={20} className="shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-bold block">Copy your API Key now!</span>
                    <p className="mt-1 leading-relaxed text-[11px] text-orange-400/80">
                      For your security, we hash keys immediately and do not store plain secrets. 
                      You will not be able to view this key again.
                    </p>
                  </div>
                </div>

                {/* Key Display Panel */}
                <div className="p-4 rounded-xl bg-gray-950/80 border border-white/5 font-mono text-xs flex items-center justify-between gap-3 select-all">
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-500 text-[10px] block font-sans font-semibold mb-1 uppercase tracking-wider">SECRET API KEY</span>
                    <code className="text-primary font-bold break-all tracking-tight leading-relaxed">{generatedKey.raw_key}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(generatedKey.raw_key, generatedKey.id, true)}
                    className={`p-2.5 rounded-lg border transition-all ${
                      copiedRawKey 
                        ? "bg-green-500/15 border-green-500/30 text-green-400" 
                        : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {copiedRawKey ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
