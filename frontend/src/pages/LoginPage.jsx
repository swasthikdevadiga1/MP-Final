import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { loginAPI, registerAPI } from "../services/api";
import toast from "react-hot-toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (mode === "login") {
        res = await loginAPI(form.email, form.password);
      } else {
        if (!form.name.trim()) { toast.error("Name is required"); setLoading(false); return; }
        res = await registerAPI(form.name, form.email, form.password);
      }
      login(res.data.token, res.data.user);
      toast.success(`Welcome${res.data.user.name ? ", " + res.data.user.name : ""}!`);
      navigate(res.data.user.is_admin ? "/admin" : "/chat");
    } catch (err) {
      toast.error(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      {/* Background glow blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand-900/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mb-4 shadow-lg shadow-brand-600/10">
            <GraduationCap className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">EduBot</h1>
          <p className="text-gray-500 text-sm mt-1">Smart College Information Assistant</p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl shadow-black/30">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-surface-border mb-6">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-200 capitalize
                  ${mode === m ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Full Name</label>
                <input
                  type="text" value={form.name} onChange={set("name")}
                  placeholder="Your full name" className="input-field" required
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email" value={form.email} onChange={set("email")}
                  placeholder="you@college.edu"
                  className="input-field pl-10" required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPw ? "text" : "password"} value={form.password} onChange={set("password")}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10" required minLength={6}
                />
                <button type="button" onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            {mode === "login" ? "Default admin: " : "Have an account? "}
            {mode === "login"
              ? <span className="text-gray-500 font-mono">admin@college.edu / Admin@123</span>
              : <button onClick={() => setMode("login")} className="text-brand-400 hover:underline">Sign in</button>
            }
          </p>
        </div>
      </div>
    </div>
  );
}
