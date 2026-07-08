/**
 * AdminDashboard.jsx — Master admin layout with tab navigation.
 * Replaces the old AdminPage.jsx as the main admin route.
 *
 * Tabs:
 *  📄 Documents   — upload + manage (existing AdminPage logic)
 *  📊 Analytics   — queries, agent breakdown, chat logs
 *  👥 Students    — list, activate/deactivate, reset password
 *  🖥️ System      — health, doc preview, query test
 *  📢 Notices     — notice board CRUD
 */

import { useState } from "react";
import {
  FileText, BarChart2, Users, Server, Bell,
  Upload, ChevronRight
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import AnalyticsPage from "./admin/AnalyticsPage";
import StudentsPage  from "./admin/StudentsPage";
import SystemPage    from "./admin/SystemPage";
import NoticesPage   from "./admin/NoticesPage";

// ── Import existing document upload panel ─────────────────────────────────────
import DocumentsTab  from "./admin/DocumentsTab";

const TABS = [
  { id: "documents",  label: "Documents",  icon: FileText,  component: DocumentsTab  },
  { id: "analytics",  label: "Analytics",  icon: BarChart2, component: AnalyticsPage },
  { id: "students",   label: "Students",   icon: Users,     component: StudentsPage  },
  { id: "system",     label: "System",     icon: Server,    component: SystemPage    },
  { id: "notices",    label: "Notices",    icon: Bell,      component: NoticesPage   },
];

export default function AdminDashboard() {
  const [active, setActive] = useState("documents");
  const ActiveComponent = TABS.find(t => t.id === active)?.component || DocumentsTab;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top tab bar */}
        <nav className="shrink-0 border-b border-surface-border bg-surface-card px-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap
                  border-b-2 transition-all duration-200
                  ${active === t.id
                    ? "border-brand-500 text-brand-300"
                    : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
                  }`}
              >
                <t.icon className="w-4 h-4 shrink-0"/>
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
