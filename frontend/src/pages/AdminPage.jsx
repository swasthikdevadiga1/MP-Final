import { useState, useEffect, useRef } from "react";
import { Upload, FileText, CheckCircle, XCircle, Clock, Trash2, RefreshCw, FolderOpen } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { uploadDocumentAPI, getDocumentsAPI, deleteDocumentAPI } from "../services/api";
import toast from "react-hot-toast";

const STATUS_CONFIG = {
  processed: { color: "text-green-400 bg-green-400/10 border-green-400/20", icon: CheckCircle, label: "Processed" },
  processing: { color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock, label: "Processing" },
  pending: { color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: Clock, label: "Pending" },
  error: { color: "text-red-400 bg-red-400/10 border-red-400/20", icon: XCircle, label: "Error" },
};

export default function AdminPage() {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileRef = useRef(null);

  const fetchDocs = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const r = await getDocumentsAPI();
      setDocs(r.data.documents || []);
    } catch (_) {
      if (!silent) toast.error("Failed to load documents.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // Poll every 4s so "processing" status updates automatically
    const iv = setInterval(() => fetchDocs(true), 4000);
    return () => clearInterval(iv);
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.name.endsWith(".pdf")) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      await uploadDocumentAPI(file, setProgress);
      toast.success("Uploaded! Processing in background…");
      fetchDocs();
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (id, name) => {
    if (!confirm("Delete " + name + "?")) return;
    try {
      await deleteDocumentAPI(id);
      toast.success("Deleted.");
      fetchDocs();
    } catch (_) {
      toast.error("Delete failed.");
    }
  };

  const stats = {
    total: docs.length,
    processed: docs.filter((d) => d.status === "processed").length,
    chunks: docs.reduce((s, d) => s + (d.chunk_count || 0), 0),
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Upload PDFs to train the college chatbot</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Documents", value: stats.total, color: "text-brand-400" },
              { label: "Processed", value: stats.processed, color: "text-green-400" },
              { label: "Total Chunks", value: stats.chunks.toLocaleString(), color: "text-purple-400" },
            ].map((s) => (
              <div key={s.label} className="card text-center">
                <p className={"text-3xl font-display font-bold " + s.color}>{s.value}</p>
                <p className="text-gray-500 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            className={`card border-2 border-dashed cursor-pointer transition-all duration-200 text-center mb-8
              ${dragOver ? "border-brand-500 bg-brand-600/5" : "border-surface-border hover:border-brand-500/50 hover:bg-brand-600/5"}`}
          >
            <input
              ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => handleUpload(e.target.files[0])}
            />
            <div className="flex flex-col items-center gap-3 py-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all
                ${dragOver ? "bg-brand-600/30" : "bg-surface-input"}`}>
                {uploading
                  ? <RefreshCw className="w-7 h-7 text-brand-400 animate-spin" />
                  : <Upload className="w-7 h-7 text-gray-500" />
                }
              </div>
              {uploading ? (
                <div className="w-full max-w-xs">
                  <p className="text-sm text-gray-300 mb-2">Uploading… {progress}%</p>
                  <div className="h-2 bg-surface-input rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-300"
                      style={{ width: progress + "%" }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-white font-medium text-sm">Drop PDF here or click to browse</p>
                    <p className="text-gray-600 text-xs mt-1">Max 50 MB · PDF only</p>
                  </div>
                  <span className="btn-primary pointer-events-none">
                    <FolderOpen className="w-4 h-4" /> Choose File
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Documents table */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-white">Uploaded Documents</h2>
              <button onClick={() => fetchDocs()} disabled={refreshing}
                className="btn-ghost flex items-center gap-1.5 py-1.5 px-3">
                <RefreshCw className={"w-3.5 h-3.5 " + (refreshing ? "animate-spin" : "")} />
                Refresh
              </button>
            </div>

            {docs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No documents uploaded yet.</p>
                <p className="text-gray-700 text-xs mt-1">Upload a PDF to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => {
                  const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <div key={d.id}
                      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-surface-input border border-surface-border hover:border-surface-border/80 transition-colors group">
                      <FileText className="w-5 h-5 text-brand-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{d.original_name}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {d.chunk_count > 0 && `${d.chunk_count} chunks · `}
                          {new Date(d.uploaded_at).toLocaleDateString()}
                        </p>
                        {d.error_message && (
                          <p className="text-[10px] text-red-400 mt-0.5 truncate">{d.error_message}</p>
                        )}
                      </div>
                      <span className={"badge border " + cfg.color}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <button
                        onClick={() => handleDelete(d.id, d.original_name)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
