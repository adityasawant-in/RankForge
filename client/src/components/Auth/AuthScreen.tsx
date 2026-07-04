import React, { useState } from "react";
import { useProject } from "../../store/ProjectContext";

export default function AuthScreen() {
  const { login, register } = useProject();
  const [isRegister, setIsRegister] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(usernameInput.trim(), passwordInput);
      } else {
        await login(usernameInput.trim(), passwordInput);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f14] relative overflow-hidden font-sans">
      {/* Dynamic Background Blur Glows */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] animate-pulse pointer-events-none" 
        style={{ animationDuration: '8s' }} 
      />
      <div 
        className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] animate-pulse pointer-events-none" 
        style={{ animationDuration: '12s' }} 
      />

      <div className="w-full max-w-md mx-4 z-10">
        <div className="bg-surface-dim/40 backdrop-blur-xl border border-outline/25 p-8 rounded-2xl shadow-2xl flex flex-col gap-6 relative transition-all duration-300">
          
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-on-primary text-2xl font-bold">bolt</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white mt-2">RankForge</h2>
            <p className="text-xs text-on-surface-variant text-center px-4">
              Create and rank high-converting vertical videos in seconds
            </p>
          </div>

          {/* Form Tabs */}
          <div className="flex bg-surface-container rounded-lg p-1 border border-outline/20">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorMsg(""); }}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all duration-200 ${
                !isRegister ? "bg-surface text-white shadow-md border border-outline/10" : "text-on-surface-variant hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorMsg(""); }}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all duration-200 ${
                isRegister ? "bg-surface text-white shadow-md border border-outline/10" : "text-on-surface-variant hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-error/10 border border-error/25 text-error px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 animate-pulse">
              <span className="material-symbols-outlined text-sm font-bold">error</span>
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Username</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">person</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. aditya"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-surface-container/30 border border-outline/20 hover:border-outline/40 focus:border-primary/50 focus:bg-surface-container/70 rounded-lg pl-9 pr-4 py-2.5 outline-none text-white text-xs transition-all placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">lock</span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-surface-container/30 border border-outline/20 hover:border-outline/40 focus:border-primary/50 focus:bg-surface-container/70 rounded-lg pl-9 pr-4 py-2.5 outline-none text-white text-xs transition-all placeholder:text-white/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:brightness-110 active:scale-[0.98] text-on-primary font-bold text-xs py-3 rounded-lg mt-2 shadow-lg shadow-primary/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-on-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <span>{isRegister ? "Create Account & Login" : "Sign In to Workspace"}</span>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
