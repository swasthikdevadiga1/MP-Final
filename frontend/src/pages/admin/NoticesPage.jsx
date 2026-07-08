import { useState, useEffect } from "react";
import { Bell, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, CheckCircle, Clock } from "lucide-react";
import {
  getAdminNoticesAPI, createNoticeAPI, updateNoticeAPI,
  toggleNoticeAPI, deleteNoticeAPI
} from "../../services/api";
import toast from "react-hot-toast";

const EMPTY = { title: "", body: "", expires_at: "" };

export default function NoticesPage() {
  const [notices, setNotices]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal,   setModal]     = useState(null);   // null | "create" | {id,title,body,expires_at}
  const [form,    setForm]      = useState(EMPTY);
  const [saving,  setSaving]    = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const r = await getAdminNoticesAPI(); setNotices(r.data.notices || []); }
    catch { toast.error("Failed to load notices."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => { setForm(EMPTY); setModal("create"); };
  const openEdit   = (n)  => {
    setForm({ title: n.title, body: n.body, expires_at: n.expires_at?.slice(0,10) || "" });
    setModal(n);
  };
  const closeModal = () => { setModal(null); setForm(EMPTY); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and body are required."); return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        body:  form.body.trim(),
        expires_at: form.expires_at || null,
      };
      if (modal === "create") {
        await createNoticeAPI(payload);
        toast.success("Notice created!");
      } else {
        await updateNoticeAPI(modal.id, payload);
        toast.success("Notice updated!");
      }
      closeModal();
      fetch();
    } catch { toast.error("Failed to save notice."); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id, active) => {
    try {
      await toggleNoticeAPI(id);
      toast.success(active ? "Notice deactivated." : "Notice activated.");
      fetch();
    } catch { toast.error("Failed to toggle notice."); }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete notice "${title}"?`)) return;
    try { await deleteNoticeAPI(id); toast.success("Deleted."); fetch(); }
    catch { toast.error("Delete failed."); }
  };

  const active   = notices.filter(n => n.is_active).length;
  const inactive = notices.length - active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Notice Board</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {notices.length} notices · {active} active · {inactive} inactive
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4"/>New Notice
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-600/10 border border-brand-500/20">
        <Bell className="w-4 h-4 text-brand-400 shrink-0 mt-0.5"/>
        <p className="text-sm text-brand-300">
          Active notices appear as <strong>📢 announcements</strong> in students' chat welcome message automatically.
          Expired or deactivated notices are hidden from students.
        </p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : notices.length === 0 ? (
        <div className="card text-center py-16">
          <Bell className="w-10 h-10 text-gray-700 mx-auto mb-3"/>
          <p className="text-gray-500 text-sm">No notices yet. Create one to inform students.</p>
          <button onClick={openCreate} className="btn-primary mt-4 mx-auto">
            <Plus className="w-4 h-4"/>Create First Notice
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(n => {
            const expired = n.expires_at && new Date(n.expires_at) < new Date();
            return (
              <div key={n.id}
                className={`card border transition-all ${n.is_active && !expired
                  ? "border-green-500/20 bg-green-400/5"
                  : "border-surface-border opacity-70"}`}>
                <div className="flex items-start gap-4">
                  {/* Status icon */}
                  <div className={`mt-0.5 shrink-0 ${n.is_active && !expired ? "text-green-400" : "text-gray-600"}`}>
                    {n.is_active && !expired
                      ? <CheckCircle className="w-5 h-5"/>
                      : <Clock       className="w-5 h-5"/>}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-white">{n.title}</h3>
                      {expired && (
                        <span className="badge bg-red-400/10 text-red-400 border border-red-400/20 text-xs">
                          Expired
                        </span>
                      )}
                      {!n.is_active && !expired && (
                        <span className="badge bg-gray-400/10 text-gray-400 border border-gray-400/20 text-xs">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[10px] text-gray-600">
                        Created {new Date(n.created_at).toLocaleDateString()}
                      </span>
                      {n.expires_at && (
                        <span className={`text-[10px] ${expired ? "text-red-400" : "text-gray-600"}`}>
                          Expires {new Date(n.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggle(n.id, n.is_active)}
                      title={n.is_active ? "Deactivate" : "Activate"}
                      className="p-2 rounded-xl hover:bg-surface-hover transition-all text-gray-400 hover:text-white">
                      {n.is_active
                        ? <ToggleRight className="w-5 h-5 text-green-400"/>
                        : <ToggleLeft  className="w-5 h-5"/>}
                    </button>
                    <button onClick={() => openEdit(n)}
                      title="Edit"
                      className="p-2 rounded-xl hover:bg-surface-hover transition-all text-gray-400 hover:text-brand-400">
                      <Pencil className="w-4 h-4"/>
                    </button>
                    <button onClick={() => handleDelete(n.id, n.title)}
                      title="Delete"
                      className="p-2 rounded-xl hover:bg-red-900/20 transition-all text-gray-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
              <h3 className="font-display font-semibold text-white">
                {modal === "create" ? "Create Notice" : "Edit Notice"}
              </h3>
              <button onClick={closeModal}
                className="p-1.5 rounded-xl hover:bg-surface-hover text-gray-400 hover:text-white transition-all">
                <X className="w-4 h-4"/>
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Title *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  placeholder="e.g. Admission Open for 2025-26"
                  className="input-field"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Message *</label>
                <textarea value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
                  placeholder="Enter the notice content students will see in chat…"
                  rows={4} className="input-field resize-none"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  Expiry Date <span className="text-gray-600">(optional — leave blank = never expires)</span>
                </label>
                <input type="date" value={form.expires_at}
                  onChange={e=>setForm(f=>({...f,expires_at:e.target.value}))}
                  className="input-field"/>
              </div>

              {/* Preview */}
              {(form.title || form.body) && (
                <div className="p-3 rounded-xl bg-surface-input border border-surface-border">
                  <p className="text-[10px] text-gray-500 mb-2">Preview (how it looks in chat)</p>
                  <div className="flex items-start gap-2">
                    <span className="text-base">📢</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{form.title || "Notice Title"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{form.body || "Notice body…"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving
                  ? <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      Saving…
                    </span>
                  : modal === "create" ? "Create Notice" : "Save Changes"}
              </button>
              <button onClick={closeModal} className="btn-ghost flex-1 text-center">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
