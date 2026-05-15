import { NavLink, useNavigate } from "react-router-dom";
import { GraduationCap, MessageSquare, Upload, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { logoutAPI } from "../services/api";
import toast from "react-hot-toast";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logoutAPI(); } catch (_) {}
    logout();
    toast.success("Logged out.");
    navigate("/login");
  };

  const links = [
    { to: "/chat", icon: MessageSquare, label: "Chat" },
    ...(user?.is_admin ? [{ to: "/admin", icon: Upload, label: "Admin Panel" }] : []),
  ];

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-surface-card border-r border-surface-border">
      {/* Brand */}
      <div className="p-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="font-display font-semibold text-white text-sm">EduBot</p>
            <p className="text-[10px] text-gray-500">College Assistant</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              "sidebar-link" + (isActive ? " active" : "")
            }>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-30" />
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-3 border-t border-surface-border space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center shrink-0">
            <span className="text-brand-300 font-semibold text-xs">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.is_admin ? "Admin" : "Student"}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
