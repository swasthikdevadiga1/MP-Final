import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage      from "./pages/LoginPage";
import ChatPage       from "./pages/ChatPage";
import AdminDashboard from "./pages/AdminDashboard";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  if (!user) return <Navigate to="/login" replace/>;
  if (adminOnly && !user.is_admin) return <Navigate to="/chat" replace/>;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={user.is_admin ? "/admin" : "/chat"} replace/> : <LoginPage/>
      }/>
      <Route path="/chat"  element={<ProtectedRoute><ChatPage/></ProtectedRoute>}/>
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard/></ProtectedRoute>}/>
      <Route path="*"      element={<Navigate to="/login" replace/>}/>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes/>
        <Toaster position="top-right" toastOptions={{
          style:{ background:"#161b22", color:"#f0f6fc",
            border:"1px solid #30363d", borderRadius:"12px", fontSize:"13px" },
          success:{ iconTheme:{ primary:"#4ade80", secondary:"#161b22" } },
          error:{   iconTheme:{ primary:"#f87171", secondary:"#161b22" } },
        }}/>
      </BrowserRouter>
    </AuthProvider>
  );
}
