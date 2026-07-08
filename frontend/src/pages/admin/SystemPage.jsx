import { useState, useEffect } from "react";
import { Server, Database, HardDrive, Cpu, CheckCircle, XCircle, RefreshCw, FileText, Search, Layers } from "lucide-react";
import { getSystemHealthAPI, queryTestAPI, getDocPreviewAPI, getDocumentsAPI } from "../../services/api";
import toast from "react-hot-toast";

const AGENT_COLORS = { faq:"text-green-400", document:"text-blue-400", pdf_download:"text-orange-400", supervisor:"text-gray-400" };

export default function SystemPage() {
  const [health,    setHealth]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [testQuery, setTestQuery] = useState("");
  const [testResult,setTestResult]= useState(null);
  const [testing,   setTesting]   = useState(false);
  const [docs,      setDocs]      = useState([]);
  const [preview,   setPreview]   = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try { const r = await getSystemHealthAPI(); setHealth(r.data); }
    catch { toast.error("Failed to load health data."); }
    finally { setLoading(false); }
  };

  const fetchDocs = async () => {
    try { const r = await getDocumentsAPI(); setDocs(r.data.documents || []); }
    catch {}
  };

  useEffect(() => { fetchHealth(); fetchDocs(); }, []);

  const handleTest = async () => {
    if (!testQuery.trim()) { toast.error("Enter a query to test."); return; }
    setTesting(true); setTestResult(null);
    try { const r = await queryTestAPI(testQuery, 5); setTestResult(r.data); }
    catch { toast.error("Query test failed."); }
    finally { setTesting(false); }
  };

  const handlePreview = async (doc) => {
    setPreview(null); setPreviewLoading(true);
    try { const r = await getDocPreviewAPI(doc.id, 5); setPreview(r.data); }
    catch { toast.error("Failed to load preview."); }
    finally { setPreviewLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-white">System Health</h2>
          <p className="text-gray-500 text-sm mt-0.5">Server status, FAISS index, query testing</p>
        </div>
        <button onClick={fetchHealth} disabled={loading}
          className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={"w-4 h-4 " + (loading ? "animate-spin" : "")}/>Refresh
        </button>
      </div>

      {health && (
        <>
          {/* Health cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label:"Uptime",          value: health.server.uptime,          icon: Server,    color:"text-brand-400" },
              { label:"Database",        value: `${health.database.size_mb} MB`, icon: Database, color:"text-green-400" },
              { label:"Uploaded Files",  value: `${health.storage.uploads_mb} MB`, icon: HardDrive,color:"text-purple-400" },
              { label:"FAISS Vectors",   value: health.faiss.total_vectors,    icon: Cpu,       color:"text-orange-400" },
            ].map(s=>(
              <div key={s.label} className="card">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`w-4 h-4 ${s.color}`}/>
                  <span className="text-gray-500 text-xs">{s.label}</span>
                </div>
                <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Detail row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* OpenAI Status */}
            <div className="card">
              <h3 className="font-semibold text-white text-sm mb-3">OpenAI API</h3>
              <div className="flex items-center gap-3">
                {health.openai.status === "ok"
                  ? <CheckCircle className="w-6 h-6 text-green-400"/>
                  : <XCircle     className="w-6 h-6 text-red-400"/>}
                <div>
                  <p className={health.openai.status==="ok" ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                    {health.openai.status==="ok" ? "Connected" : "Error"}
                  </p>
                  {health.openai.latency_ms && (
                    <p className="text-gray-500 text-xs">{health.openai.latency_ms} ms latency</p>
                  )}
                  {health.openai.status!=="ok" && (
                    <p className="text-red-400/70 text-xs mt-0.5 truncate">{health.openai.status}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Document counts */}
            <div className="card">
              <h3 className="font-semibold text-white text-sm mb-3">Documents</h3>
              <div className="space-y-2">
                {[
                  { label:"Total",      value: health.database.total_docs,     color:"text-white" },
                  { label:"Processed",  value: health.database.processed_docs, color:"text-green-400" },
                  { label:"Errors",     value: health.database.error_docs,     color:"text-red-400" },
                  { label:"Generated PDFs", value: health.storage.generated_pdfs, color:"text-orange-400" },
                ].map(r=>(
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{r.label}</span>
                    <span className={`font-semibold ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Last processed */}
            <div className="card">
              <h3 className="font-semibold text-white text-sm mb-3">Last Processed</h3>
              {health.last_processed?.name ? (
                <div>
                  <p className="text-white text-sm font-medium truncate">{health.last_processed.name}</p>
                  <p className="text-gray-500 text-xs mt-1">{health.last_processed.chunks} chunks</p>
                  <p className="text-gray-600 text-xs">{new Date(health.last_processed.processed_at).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-gray-600 text-sm">No documents processed yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Query Test Panel */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-brand-400"/>Query Test Panel
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Test any query to see which agent handles it and which chunks are retrieved from FAISS.
        </p>
        <div className="flex gap-3 mb-4">
          <input value={testQuery} onChange={e=>setTestQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && handleTest()}
            placeholder="e.g. What is the fee structure for B.Tech?"
            className="input-field flex-1"/>
          <button onClick={handleTest} disabled={testing || !testQuery.trim()}
            className="btn-primary shrink-0">
            {testing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            Test
          </button>
        </div>

        {testResult && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-4 p-3 bg-surface-input rounded-xl border border-surface-border">
              <div>
                <span className="text-xs text-gray-500">Agent Route</span>
                <p className={`font-semibold text-sm ${AGENT_COLORS[testResult.agent_route]||"text-white"}`}>
                  {testResult.agent_route}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Chunks Found</span>
                <p className="font-semibold text-sm text-white">{testResult.chunks_found}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Retrieval Time</span>
                <p className="font-semibold text-sm text-white">{testResult.retrieval_ms} ms</p>
              </div>
            </div>
            <div className="space-y-2">
              {testResult.chunks.map(c=>(
                <div key={c.rank} className="p-3 bg-surface-input rounded-xl border border-surface-border">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge bg-brand-600/20 text-brand-300 text-xs">#{c.rank}</span>
                    <span className="text-xs text-gray-500">{c.source}</span>
                    <span className="text-xs text-gray-600">{c.char_count} chars</span>
                    <span className={`badge text-xs ${c.type==="image"?"bg-purple-400/10 text-purple-400":"bg-blue-400/10 text-blue-400"}`}>
                      {c.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{c.preview}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Panel */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-400"/>Document Preview
        </h3>
        <p className="text-gray-500 text-sm mb-4">Click any document to see its extracted text and indexed chunks.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Doc list */}
          <div className="space-y-2">
            {docs.filter(d=>d.status==="processed").map(d=>(
              <button key={d.id} onClick={()=>handlePreview(d)}
                className={`w-full text-left p-3 rounded-xl border transition-all
                  ${preview?.document?.id===d.id
                    ? "bg-brand-600/10 border-brand-500/40"
                    : "bg-surface-input border-surface-border hover:border-brand-500/30"}`}>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-400 shrink-0"/>
                  <p className="text-sm text-white font-medium truncate">{d.original_name}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  {d.chunk_count} chunks · {d.type || "pdf"}
                </p>
              </button>
            ))}
            {docs.filter(d=>d.status==="processed").length === 0 && (
              <p className="text-gray-600 text-sm">No processed documents yet.</p>
            )}
          </div>

          {/* Preview panel */}
          <div>
            {previewLoading && (
              <div className="flex items-center justify-center h-40">
                <RefreshCw className="w-6 h-6 text-brand-400 animate-spin"/>
              </div>
            )}
            {preview && !previewLoading && (
              <div className="space-y-3 animate-fade-in">
                <div className="p-3 bg-surface-input rounded-xl border border-surface-border">
                  <p className="text-xs text-gray-500 mb-1">Raw Text Preview (first 2000 chars)</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {preview.raw_preview || "No text preview available."}
                  </p>
                </div>
                {preview.chunks?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      Sample Chunks ({preview.chunks_shown} shown)
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {preview.chunks.map((c,i)=>(
                        <div key={i} className="p-2.5 bg-surface-hover rounded-lg border border-surface-border">
                          <p className="text-[10px] text-gray-500 mb-1">Chunk {c.chunk_index} · {c.char_count} chars</p>
                          <p className="text-xs text-gray-300">{c.preview}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!preview && !previewLoading && (
              <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
                Select a document to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
