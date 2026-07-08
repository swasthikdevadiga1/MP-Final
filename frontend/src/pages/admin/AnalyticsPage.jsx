import { useState, useEffect } from "react";
import { BarChart2, MessageSquare, Users, TrendingUp, Download, Search, Filter } from "lucide-react";
import { getAnalyticsAPI, getChatLogsAPI, exportCsvAPI } from "../../services/api";
import toast from "react-hot-toast";

const AGENT_COLORS = {
  faq:          "bg-green-400/20 text-green-400",
  document:     "bg-blue-400/20 text-blue-400",
  pdf_download: "bg-orange-400/20 text-orange-400",
  image:        "bg-purple-400/20 text-purple-400",
  supervisor:   "bg-gray-400/20 text-gray-400",
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [logs,     setLogs]     = useState({ history: [], total: 0, pages: 1 });
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [agent,    setAgent]    = useState("");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { fetchOverview(); }, []);
  useEffect(() => { fetchLogs();    }, [page, agent]);

  const fetchOverview = async () => {
    try { const r = await getAnalyticsAPI(); setOverview(r.data); }
    catch { toast.error("Failed to load analytics."); }
    finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    try { const r = await getChatLogsAPI(page, search, agent); setLogs(r.data); }
    catch { toast.error("Failed to load chat logs."); }
  };

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchLogs(); };

  const handleExport = async () => {
    try {
      const r    = await exportCsvAPI();
      const url  = URL.createObjectURL(new Blob([r.data]));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `chat_history_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported!");
    } catch { toast.error("Export failed."); }
  };

  const maxDaily = Math.max(...(overview?.daily_counts?.map(d=>d.count)||[1]));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Analytics Dashboard</h2>
          <p className="text-gray-500 text-sm mt-0.5">Query trends, agent usage, top questions</p>
        </div>
        <button onClick={handleExport}
          className="btn-ghost flex items-center gap-2 text-sm">
          <Download className="w-4 h-4"/>Export CSV
        </button>
      </div>

      {/* Stat cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:"Total Queries",   value: overview.total_queries,  icon: MessageSquare, color:"text-brand-400" },
            { label:"Queries Today",   value: overview.queries_today,  icon: TrendingUp,    color:"text-green-400" },
            { label:"This Week",       value: overview.queries_week,   icon: BarChart2,     color:"text-purple-400" },
            { label:"Total Students",  value: overview.total_students, icon: Users,         color:"text-orange-400" },
          ].map(s=>(
            <div key={s.label} className="card">
              <div className="flex items-center gap-3 mb-2">
                <s.icon className={`w-5 h-5 ${s.color}`}/>
                <span className="text-gray-500 text-xs">{s.label}</span>
              </div>
              <p className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent breakdown */}
        {overview?.agent_breakdown && (
          <div className="card">
            <h3 className="font-semibold text-white mb-4">Agent Usage</h3>
            <div className="space-y-3">
              {Object.entries(overview.agent_breakdown).map(([agent, count])=>{
                const total = overview.total_queries || 1;
                const pct   = Math.round((count/total)*100);
                return (
                  <div key={agent}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`badge ${AGENT_COLORS[agent]||AGENT_COLORS.supervisor} capitalize`}>
                        {agent.replace("_"," ")}
                      </span>
                      <span className="text-gray-400">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-surface-input rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all"
                        style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top questions */}
        {overview?.top_questions && (
          <div className="card">
            <h3 className="font-semibold text-white mb-4">Top Questions</h3>
            <div className="space-y-2">
              {overview.top_questions.slice(0,8).map((q,i)=>(
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs text-gray-600 w-5 shrink-0 mt-0.5">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">{q.question}</p>
                  </div>
                  <span className="badge bg-surface-input text-gray-500 text-xs shrink-0">{q.count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Daily activity chart */}
      {overview?.daily_counts?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-4">Daily Activity (Last 30 Days)</h3>
          <div className="flex items-end gap-1 h-32">
            {overview.daily_counts.map((d,i)=>(
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full">
                  <div className="absolute bottom-0 w-full bg-brand-600 rounded-t transition-all group-hover:bg-brand-500"
                    style={{height:`${Math.max(4,(d.count/maxDaily)*100)}%`, minHeight:"4px"}}
                    title={`${d.date}: ${d.count} queries`}/>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-2">
            <span>{overview.daily_counts[0]?.date?.slice(5)}</span>
            <span>{overview.daily_counts[Math.floor(overview.daily_counts.length/2)]?.date?.slice(5)}</span>
            <span>{overview.daily_counts[overview.daily_counts.length-1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Chat history table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-white">Chat History</h3>
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"/>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search messages…"
                  className="input-field pl-9 py-1.5 text-xs w-44"/>
              </div>
              <button type="submit" className="btn-primary py-1.5 px-3 text-xs">Search</button>
            </form>
            <select value={agent} onChange={e=>{setAgent(e.target.value);setPage(1);}}
              className="input-field py-1.5 text-xs w-36">
              <option value="">All agents</option>
              {["faq","document","pdf_download","image"].map(a=>(
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {logs.history?.map(row=>(
            <div key={row.id}
              className="p-3 rounded-xl bg-surface-input border border-surface-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{row.student_name}</span>
                  <span className="text-[10px] text-gray-600">{row.student_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-[10px] ${AGENT_COLORS[row.agent_used]||AGENT_COLORS.supervisor}`}>
                    {row.agent_used}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-300">Q: {row.user_message}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">A: {row.bot_response}</p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {logs.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              className="btn-ghost py-1 px-3 text-xs disabled:opacity-40">← Prev</button>
            <span className="text-xs text-gray-500">Page {page} of {logs.pages}</span>
            <button onClick={()=>setPage(p=>Math.min(logs.pages,p+1))} disabled={page===logs.pages}
              className="btn-ghost py-1 px-3 text-xs disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
