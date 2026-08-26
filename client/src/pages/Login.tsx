import { motion } from "framer-motion";
import { ArrowRight, CircleDot, Download, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type AuthMode = "signIn" | "register";
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState("");
  const auth = trpc.credentials.me.useQuery();
  const utils = trpc.useUtils();
  const destination = new URLSearchParams(window.location.search).get("next");
  const nextLocation = destination?.startsWith("/") && !destination.startsWith("//") ? destination : "/";

  const completeAuth = async () => {
    await utils.credentials.me.invalidate();
    setLocation(nextLocation);
  };
  const signIn = trpc.credentials.signIn.useMutation({ onSuccess: completeAuth, onError: result => setError(result.message) });
  const register = trpc.credentials.register.useMutation({ onSuccess: completeAuth, onError: result => setError(result.message) });

  useEffect(() => {
    if (auth.data) setLocation(nextLocation);
  }, [auth.data, nextLocation, setLocation]);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setInstallMessage("Use your browser menu to install Branice. On iPhone or iPad, choose Share, then Add to Home Screen.");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallMessage("Branice is now available from your device home screen.");
    setInstallPrompt(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const values = { email, password };
    if (mode === "signIn") signIn.mutate(values);
    else register.mutate(values);
  }

  const busy = signIn.isPending || register.isPending;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0a0710] px-5 py-10 text-white">
      <div className="hero-grid absolute inset-0 opacity-60" aria-hidden />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#9e49f4]/20 blur-[100px]" aria-hidden />
      <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#df5aaf]/10 blur-[105px]" aria-hidden />
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="relative w-full max-w-md rounded-[1.8rem] border border-white/12 bg-[#170b20]/92 p-6 shadow-[0_30px_90px_rgba(0,0,0,.58)] backdrop-blur-xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#dbacff]/30 bg-[#ae58f7]/12 text-[#e5b7ff] purple-glow"><CircleDot className="h-5 w-5" /></span>
          <div><p className="text-xl font-bold leading-none tracking-tight">Branice</p><p className="font-mono mt-1 text-[9px] uppercase tracking-[.19em] text-white/40">Private player access</p></div>
        </div>
        <button onClick={installApp} className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl border border-[#d7a3ff]/30 bg-[#ad5afb]/12 px-3 text-xs font-semibold text-[#e9c9ff] transition hover:bg-[#ad5afb]/20"><Download className="h-3.5 w-3.5" /> Install Branice</button>
        <div className="mt-9">
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#d9a4ff]">{mode === "signIn" ? "Welcome back" : "Create your table key"}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">{mode === "signIn" ? "Sign in to play." : "Join Branice."}</h1>
          <p className="mt-3 text-sm leading-6 text-white/54">Use your email and password to protect your private rooms and reconnect across devices.</p>
        </div>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/75"><Mail className="h-3.5 w-3.5 text-[#d9a4ff]" /> Email</span><input required type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" className="h-12 w-full rounded-xl border border-white/12 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d8a1ff] focus:ring-4 focus:ring-[#ae58f7]/12" /></label>
          <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/75"><KeyRound className="h-3.5 w-3.5 text-[#d9a4ff]" /> Password</span><input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "signIn" ? "current-password" : "new-password"} placeholder="At least 8 characters" className="h-12 w-full rounded-xl border border-white/12 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d8a1ff] focus:ring-4 focus:ring-[#ae58f7]/12" /></label>
          {error && <p role="alert" className="rounded-xl border border-[#ff9c8b]/25 bg-[#601f35]/25 px-3 py-2 text-xs leading-5 text-[#ffc5b8]">{error}</p>}
          {installMessage && <p role="status" className="rounded-xl border border-[#d7a3ff]/20 bg-[#b766ff]/[.08] px-3 py-2 text-xs leading-5 text-[#e7c7ff]">{installMessage}</p>}
          <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b55cff] to-[#db8dff] text-sm font-bold text-[#230634] shadow-[0_0_30px_rgba(184,93,255,.28)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70 active:scale-[.985]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{busy ? "Securing access" : mode === "signIn" ? "Sign in" : "Create account"}</button>
        </form>
        <button onClick={() => { setMode(mode === "signIn" ? "register" : "signIn"); setError(""); }} className="mt-5 w-full text-center text-sm text-white/55 transition hover:text-[#e3b9ff]">{mode === "signIn" ? "New to Branice? Create an account" : "Already have an account? Sign in"}</button>
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 text-xs leading-5 text-white/44"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d9a4ff]" /> Passwords are stored only as secure one-way hashes. There is no social or third-party sign-in.</div>
      </motion.section>
    </main>
  );
}
