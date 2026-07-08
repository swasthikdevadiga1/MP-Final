import { useState, useEffect } from "react";
import { Users, UserCheck, UserX, Key, Trash2, RefreshCw, Search } from "lucide-react";
import { getStudentsAPI, toggleStudentAPI, resetPasswordAPI, deleteStudentAPI } from "../../services/api";
import toast from "react-hot-toast";

export default function StudentsPage() {
  const [students, setStudents]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [search,   setSearch]     = useState("");
  const [loading,  setLoading]    = useState(true);
  const [resetModal, setResetModal] = useState(null); // { id, name }
  const [newPass,  setNewPass]    = useState("");

  const fetch = async () => {
    setLoading(true);
    try {
      const r = await getStudentsAPI();
      setStudents(r.data.students || []);
      setFiltered(r.data.students || []);
    } catch { toast.error("Failed to load students."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(students.filter(s =>
      s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    ));
  }, [search, students]);

  const handleToggle = async (id, name, active) => {
    try {
      await toggleStudentAPI(id);
      toast.success(`${name} ${active ? "deactivated" : "activated"}.`);
      fetch();
    } catch { toast.error("Failed to update."); }
  };

  const handleReset = async () => {
    if (!newPass || newPass.length < 6) { toast.error("Min 6 characters."); return; }
    try {
      await resetPasswordAPI(resetModal.id, newPass);
      toast.success(`Password reset for ${resetModal.name}.`);
      setResetModal(null); setNewPass("");
    } catch { toast.error("Failed to reset password."); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
    try {
      await deleteStudentAPI(id);
      toast.success(`${name} deleted.`);
      fetch();
    } catch { toast.error("Delete failed."); }
  };

  const active   = students.filter(s => s.is_active !== false).length;
  const inactive = students.length - active;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Student Management</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {students.length} total · {active} active · {inactive} inactive
          </p>
        </div>
        <button onClick={fetch} disabled={loading}
          className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={"w-4 h-4 " + (loading ? "animate-spin" : "")}/>Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="input-field pl-10"/>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-hover">
                {["Name","Email","Status","Last Login","Logins","Actions"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-600">No students found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-surface-hover/50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center shrink-0">
                        <span className="text-brand-300 font-bold text-xs">
                          {s.name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white font-medium">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge border ${s.is_active !== false
                      ? "text-green-400 bg-green-400/10 border-green-400/20"
                      : "text-red-400 bg-red-400/10 border-red-400/20"}`}>
                      {s.is_active !== false ? <UserCheck className="w-3 h-3"/> : <UserX className="w-3 h-3"/>}
                      {s.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {s.last_login
                      ? new Date(s.last_login).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.login_count || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {/* Toggle */}
                      <button onClick={()=>handleToggle(s.id, s.name, s.is_active!==false)}
                        title={s.is_active!==false ? "Deactivate" : "Activate"}
                        className={`p-1.5 rounded-lg transition-all ${s.is_active!==false
                          ? "text-yellow-400 hover:bg-yellow-900/20"
                          : "text-green-400 hover:bg-green-900/20"}`}>
                        {s.is_active!==false ? <UserX className="w-4 h-4"/> : <UserCheck className="w-4 h-4"/>}
                      </button>
                      {/* Reset password */}
                      <button onClick={()=>{setResetModal({id:s.id,name:s.name});setNewPass("");}}
                        title="Reset password"
                        className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-900/20 transition-all">
                        <Key className="w-4 h-4"/>
                      </button>
                      {/* Delete */}
                      <button onClick={()=>handleDelete(s.id, s.name)}
                        title="Delete student"
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/20 transition-all">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset password modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
            <h3 className="font-display font-semibold text-white mb-1">Reset Password</h3>
            <p className="text-gray-500 text-sm mb-4">Set a new password for <strong className="text-white">{resetModal.name}</strong></p>
            <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="input-field mb-4" minLength={6}
              onKeyDown={e=>e.key==="Enter" && handleReset()}/>
            <div className="flex gap-3">
              <button onClick={handleReset} className="btn-primary flex-1 justify-center">
                Reset Password
              </button>
              <button onClick={()=>setResetModal(null)} className="btn-ghost flex-1 text-center">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
