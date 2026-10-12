import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  Info,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  RefreshCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  WifiOff,
} from "lucide-react";
import "./App.css";

type ScanType = "url" | "message";
type Page = "scanner" | "about";
type Health = "checking" | "online" | "offline" | "unconfigured";

type ScanResult = {
  risk_score?: number;
  risk_level?: string;
  verdict?: string;
  detected_keywords?: string[];
  urls_found?: string[];
  warnings?: string[];
  domain?: string;
  recommendation?: string | string[];
  dns_status?: string;
  verification_status?: string;
  tls_status?: string;
  reputation_check?: unknown;
  possible_brand?: string;
  official_domain_reference?: string;
};

type MLResult = {
  prediction?: string;
  scam_probability?: number;
  model?: string;
};

const configuredApi = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const API_BASE = (configuredApi || (import.meta.env.DEV ? "http://127.0.0.1:8002" : "")).replace(/\/+$/, "");
const HEALTH_TIMEOUT_MS = 12000;
const SCAN_TIMEOUT_MS = 45000;

const urlExamples = [
  { label: "Recognized website", value: "https://www.google.com" },
  { label: "Simulated impersonation", value: "https://paypal-login.example.com" },
  { label: "Unresolvable domain", value: "https://not-a-real-host-4582.example" },
];
const messageExamples = [
  { label: "Suspicious bank text", value: "URGENT: Your bank account will be blocked. Verify now and share your OTP immediately." },
  { label: "Fake job offer", value: "Congratulations! You have been selected. Pay the registration fee now to secure your job offer." },
  { label: "Ordinary message", value: "Hi, our study group is meeting tomorrow at 2 PM. See you there!" },
];

function scoreOf(result: ScanResult): number | null {
  if (typeof result.risk_score !== "number" || !Number.isFinite(result.risk_score)) return null;
  return Math.max(0, Math.min(100, Math.round(result.risk_score)));
}

function assess(result: ScanResult): { kind: "high" | "medium" | "low"; label: string; description: string } {
  const level = String(result.risk_level ?? "").toLowerCase();
  const score = scoreOf(result);
  const high = level.includes("high") || (level === "" && score !== null && score >= 60);
  const medium = level.includes("medium") || level.includes("suspicious") || (level === "" && score !== null && score >= 30);
  if (high) return { kind: "high", label: "Potential threat", description: "Multiple warning signs were found. Avoid sharing passwords, OTPs or payment information." };
  if (medium) return { kind: "medium", label: "Review carefully", description: "Some warning signs were found. Verify the sender or website independently." };
  return { kind: "low", label: "No strong warnings detected", description: "The available checks found few risk indicators. This does not prove the content is safe." };
}

function formatError(status: number, detail?: unknown): string {
  if (status === 404) return "The scanning API endpoint was not found. Check that the Python backend is deployed and the API URL is correct.";
  if (status === 422) return "The scanner could not process this input. Please check the text or URL and try again.";
  if (status === 429) return "Too many scans right now. Please wait a moment and try again.";
  if (status >= 500) return "The scanning service encountered an error. Please try again in a moment.";
  if (typeof detail === "string" && detail.length < 180) return detail;
  return `The scanning service returned error ${status}.`;
}

function asLines(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim().length > 0);
  return typeof value === "string" && value.trim() ? [value] : [];
}

function formatTechnical(value: unknown): string {
  if (typeof value === "string") return value.replaceAll("_", " ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === null || value === undefined ? "Not checked" : String(value);
}

export default function App() {
  const [page, setPage] = useState<Page>("scanner");
  const [scanType, setScanType] = useState<ScanType>("url");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mlResult, setMlResult] = useState<MLResult | null>(null);
  const [mlWarning, setMlWarning] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Health>(API_BASE ? "checking" : "unconfigured");
  const [enableML, setEnableML] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const activeText = scanType === "url" ? url : message;
  const examples = scanType === "url" ? urlExamples : messageExamples;

  // One-time migration cleanup: erase old ScamShield scan-history keys.
  // Never remove unrelated websites' localStorage data.
  useEffect(() => {
    try {
      const storage = window.localStorage;
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key && /scam.?shield/i.test(key) && /(?:history|scan)/i.test(key)) {
          storage.removeItem(key);
        }
      }
    } catch {
      // Storage may be blocked. This app does not rely on it.
    }
  }, []);

  async function checkHealth() {
    if (!API_BASE) { setHealth("unconfigured"); return; }
    setHealth("checking");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/api/health`, { signal: controller.signal, cache: "no-store" });
      setHealth(response.ok ? "online" : "offline");
    } catch {
      setHealth("offline");
    } finally { clearTimeout(timeout); }
  }

  useEffect(() => { void checkHealth(); }, []);

  function selectType(type: ScanType) {
    setScanType(type);
    setUrl("");
    setMessage("");
    setResult(null);
    setMlResult(null);
    setMlWarning("");
    setError("");
    setExpanded(false);
  }

  function chooseExample(value: string) {
    if (scanType === "url") { setUrl(value); setMessage(""); }
    else { setMessage(value); setUrl(""); }
    setResult(null);
    setError("");
    setMlResult(null);
    setMlWarning("");
    fieldRef.current?.focus();
  }

  async function analyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (loading) return;
    if (!API_BASE) {
      setError("Scanning isn't connected yet. The website administrator needs to configure the public API URL in Vercel and redeploy.");
      return;
    }
    const input = activeText.trim();
    if (!input) {
      setError(scanType === "url" ? "Enter a website address to scan." : "Paste a message or email text to scan.");
      fieldRef.current?.focus();
      return;
    }
    if (scanType === "url" && !/^([a-z][a-z\d+.-]*:\/\/)?[^\s]+$/i.test(input)) {
      setError("Enter a single web address without spaces, such as https://example.com.");
      fieldRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setMlResult(null);
    setMlWarning("");
    setExpanded(false);

    const endpoint = scanType === "url" ? "/api/analyze-url" : "/api/analyze";
    const body = scanType === "url" ? { url: input } : { text: input };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const json: { detail?: unknown } | null = await response.json().catch(() => null);
        throw new Error(formatError(response.status, json?.detail));
      }
      const data = (await response.json()) as ScanResult;
      if (!data || typeof data !== "object" || !data.verdict && !data.risk_level && typeof data.risk_score !== "number") {
        throw new Error("The scanner returned an unexpected response. Please check the backend API.");
      }
      setResult(data);
      setHealth("online");
      // No history: the report lives only in React memory until cleared/closed.
      // ML is optional: a second network request is sent only with user consent.
      if (scanType === "message" && enableML) {
        try {
          const mlController = new AbortController();
          const mlTimeout = setTimeout(() => mlController.abort(), 9000);
          try {
            const mlResponse = await fetch(`${API_BASE}/api/analyze-ml`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: input }), cache: "no-store", signal: mlController.signal,
            });
            if (!mlResponse.ok) throw new Error("Unavailable");
            setMlResult((await mlResponse.json()) as MLResult);
          } finally { clearTimeout(mlTimeout); }
        } catch {
          setMlWarning("Experimental ML analysis is unavailable. The main scan report is still valid as a heuristic assessment.");
        }
      }
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    } catch (caught) {
      const reason = caught instanceof Error ? caught : new Error("Unknown error");
      const offline = reason.name === "AbortError" || reason.message.toLowerCase().includes("fetch");
      if (offline) {
        setHealth("offline");
        setError(reason.name === "AbortError"
          ? "Scanning took too long. The server may be starting up. Please try again."
          : "Couldn't reach the scanning server. Check the connection or try again later. The backend may not be deployed or configured correctly.");
      } else {
        setError(reason.message);
      }
    } finally {
      clearTimeout(timeout);
      // Immediately clear the submitted input from the form on completion.
      // The API and hosting provider must independently enforce server-side deletion.
      setUrl("");
      setMessage("");
      setLoading(false);
    }
  }

  function buildReport(): string {
    if (!result) return "";
    const rating = assess(result);
    const warningLines = (result.warnings ?? []).map((item) => `- ${item}`).join("\n") || "- None detected by current checks";
    const keyLines = (result.detected_keywords ?? []).map((item) => `- ${item}`).join("\n") || "- None listed";
    const advice = asLines(result.recommendation).map((line) => `- ${line}`).join("\n") || "- Verify unexpected requests through official channels.";
    return ["SCAMSHIELD AI — SECURITY SCAN REPORT", "", `Scan: ${scanType === "url" ? "Website" : "Message"}`,
      `Time: ${new Date().toLocaleString()}`, `Assessment: ${rating.label}`, `Heuristic score: ${scoreOf(result) ?? "Not available"}/100`,
      `Backend verdict: ${result.verdict ?? "Not provided"}`, `Domain: ${result.domain ?? "Not applicable"}`, "", "WARNING SIGNS", warningLines,
      "", "DETECTED INDICATORS", keyLines, "", "RECOMMENDED ACTION", advice, "",
      "Note: A low score does not prove content is safe. ScamShield does not guarantee fraud detection."].join("\n");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { setError("Couldn't copy automatically. Try downloading the report instead."); }
  }

  function downloadReport() {
    const blob = new Blob([buildReport()], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `scamshield-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  function clearReport() {
    setUrl("");
    setMessage("");
    setResult(null);
    setMlResult(null);
    setMlWarning("");
    setError("");
    setCopied(false);
    setExpanded(false);
  }

  function goToScanner(type: ScanType) {
    setPage("scanner");
    selectType(type);
  }
  const verdict = result ? assess(result) : null;
  const score = result ? scoreOf(result) : null;
  const unverified = Boolean(result && (
    String(result.verification_status ?? "").toLowerCase().includes("unverified") ||
    String(result.dns_status ?? "").toLowerCase().includes("not_resolved") ||
    String(result.dns_status ?? "").toLowerCase().includes("unresolved")
  ));

  return (
    <div className="ss-shell">
      <a className="ss-skip" href="#main-content">Skip to content</a>
      <aside className="ss-sidebar" aria-label="Primary navigation">
        <div className="ss-brand">
          <div className="ss-brand-symbol"><ShieldCheck size={22} aria-hidden="true" /></div>
          <div className="ss-brand-text"><strong>ScamShield <span>AI</span></strong><small>SECURITY WORKSPACE</small></div>
        </div>
        <p className="ss-nav-label">WORKSPACE</p>
        <nav className="ss-nav">
          <button type="button" className={page === "scanner" ? "ss-nav-item active" : "ss-nav-item"} onClick={() => setPage("scanner")}> <Search size={18} aria-hidden="true" /> <span>Security scanner</span> <ChevronRight size={15} className="ss-chevron" aria-hidden="true" /></button>
          <button type="button" className={page === "about" ? "ss-nav-item active" : "ss-nav-item"} onClick={() => { clearReport(); setPage("about"); }}> <Info size={18} aria-hidden="true" /> <span>How it works</span> <ChevronRight size={15} className="ss-chevron" aria-hidden="true" /></button>
        </nav>
        <div className="ss-sidebar-bottom">
          <div className="ss-sidebar-insight"><Shield size={20} aria-hidden="true" /><p><strong>Think before you click.</strong><br/>If a message feels urgent, verify it through a trusted channel.</p></div>
          <span>© 2026 ScamShield AI · Prototype</span>
        </div>
      </aside>

      <div className="ss-main-wrap">
        <header className="ss-topbar">
          <div className="ss-topbar-left"><span className="ss-eyebrow">SCAMSHIELD AI</span><span className="ss-topbar-separator">/</span><strong>{page === "scanner" ? "Security scanner" : "How it works"}</strong></div>
          <div className="ss-health-box" title={health === "online" ? "Backend health endpoint responded" : "Backend connection not verified"}>
            <span className={`ss-health ss-health-${health}`} aria-live="polite"><span className="ss-health-dot" aria-hidden="true" />{health === "online" ? "Scanner connected" : health === "checking" ? "Checking connection" : health === "unconfigured" ? "Setup needed" : "Scanner unavailable"}</span>
            <button type="button" className="ss-icon-btn" aria-label="Recheck scanner connection" title="Recheck scanner connection" onClick={() => void checkHealth()}><RefreshCcw size={15} /></button>
          </div>
        </header>

        <main id="main-content" className="ss-content">
          {page === "scanner" && <>
            <section className="ss-hero">
              <div>
                <div className="ss-hero-tag"><Sparkles size={14} aria-hidden="true" /> SIMPLE, EXPLAINABLE SECURITY CHECKS</div>
                <h1>Check suspicious links<br/><span>before you trust them.</span></h1>
                <p>Paste a website link or a message. We'll highlight warning signs and explain what to do next — in plain language.</p>
                <div className="ss-hero-actions"><button type="button" className="ss-hero-link" onClick={() => { selectType("url"); document.getElementById("scan-field")?.focus(); }}>Scan a website <ArrowRight size={16} aria-hidden="true" /></button><button type="button" className="ss-hero-outline" onClick={() => { selectType("message"); document.getElementById("scan-field")?.focus(); }}>Check a message</button></div>
              </div>
              <div className="ss-hero-art" aria-hidden="true"><div className="ss-orbit ss-orbit-one"/><div className="ss-orbit ss-orbit-two"/><div className="ss-center-shield"><ShieldCheck size={63} strokeWidth={1.2}/></div><span className="ss-art-tag tag-one">DOMAIN CHECK</span><span className="ss-art-tag tag-two">RISK SIGNALS</span></div>
            </section>

            <div className="ss-metrics ss-trust-metrics" aria-label="Privacy approach">
              <div className="ss-metric"><div className="ss-metric-icon blue"><LockKeyhole size={19} aria-hidden="true"/></div><div><span>Browser privacy</span><strong>No scan history</strong><small>Results are not saved locally</small></div></div>
              <div className="ss-metric"><div className="ss-metric-icon orange"><RefreshCcw size={19} aria-hidden="true"/></div><div><span>Temporary inputs</span><strong>Cleared after a scan</strong><small>Message and URL fields reset</small></div></div>
              <div className="ss-metric"><div className="ss-metric-icon teal"><ShieldCheck size={19} aria-hidden="true"/></div><div><span>Report privacy</span><strong>Visible this session</strong><small>Clear it anytime or close the tab</small></div></div>
            </div>

            <section className="ss-workspace" aria-label="Scan workspace">
              <div className="ss-card ss-scan-card">
                <div className="ss-card-heading"><div className="ss-heading-icon"><Search size={20} aria-hidden="true"/></div><div><h2>Run a security check</h2><p>Follow these simple steps. No account needed.</p></div></div>
                <div className="ss-step-heading"><span className="ss-step-badge">1</span><strong>What would you like to check?</strong></div>
                <div className="ss-type-switch" role="group" aria-label="Scan type">
                  <button type="button" className={scanType === "url" ? "ss-type active" : "ss-type"} aria-pressed={scanType === "url"} onClick={() => selectType("url")}><Link2 size={19} aria-hidden="true"/><span><strong>Website link</strong><small>Check a suspicious URL</small></span></button>
                  <button type="button" className={scanType === "message" ? "ss-type active" : "ss-type"} aria-pressed={scanType === "message"} onClick={() => selectType("message")}><MessageSquare size={19} aria-hidden="true"/><span><strong>Message or email</strong><small>Check text for scam signs</small></span></button>
                </div>
                <form onSubmit={(event) => void analyze(event)}>
                  <div className="ss-step-heading ss-spaced"><span className="ss-step-badge">2</span><label htmlFor="scan-field">{scanType === "url" ? "Paste the website address" : "Paste the message text"}</label></div>
                  {scanType === "url" ? (
                    <div className="ss-input-wrapper"><Link2 size={19} aria-hidden="true"/><input id="scan-field" ref={(el) => { fieldRef.current = el; }} type="text" spellCheck={false} autoComplete="url" inputMode="url" placeholder="https://example.com" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048} disabled={loading} aria-describedby="scan-help" /></div>
                  ) : (
                    <textarea id="scan-field" ref={(el) => { fieldRef.current = el; }} className="ss-textarea" placeholder="Paste the SMS, email, or message you're unsure about..." value={message} onChange={(event) => setMessage(event.target.value)} maxLength={10000} rows={6} disabled={loading} aria-describedby="scan-help" />
                  )}
                  <div id="scan-help" className="ss-field-help"><LockKeyhole size={14} aria-hidden="true"/> Don't enter passwords, OTPs, or other private information. {scanType === "message" && `${message.length}/10000 characters`}</div>
                  {scanType === "message" && <label className="ss-ml-consent"><input type="checkbox" checked={enableML} onChange={(event) => setEnableML(event.target.checked)} disabled={loading}/><span><strong>Include experimental ML check (optional)</strong><small>This sends your text in an additional request to the ML endpoint. Off by default.</small></span></label>}
                  <div className="ss-examples"><span>TRY AN EXAMPLE</span><div className="ss-example-list">{examples.map((example) => <button type="button" className="ss-example" key={example.label} onClick={() => chooseExample(example.value)} disabled={loading}>{example.label} <ArrowRight size={13} aria-hidden="true"/></button>)}</div></div>
                  {error && <div className="ss-error" role="alert"><AlertCircle size={19} aria-hidden="true"/><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
                  {health === "unconfigured" && <p className="ss-admin-note">Deployment setup: set <code>VITE_API_BASE_URL</code> to the public backend address in Vercel, then redeploy the frontend.</p>}
                  {health === "offline" && <p className="ss-admin-note"><WifiOff size={15} aria-hidden="true"/> The scanning service isn't responding. Use the refresh icon at the top to retry.</p>}
                  <div className="ss-step-heading ss-spaced"><span className="ss-step-badge">3</span><strong>Get a clear, actionable report</strong></div>
                  <button className="ss-submit" type="submit" disabled={loading || !activeText.trim()}>{loading ? <><LoaderCircle className="ss-spin" size={19} aria-hidden="true"/> Analyzing, please wait…</> : <><ShieldCheck size={19} aria-hidden="true"/> Analyze {scanType === "url" ? "website" : "message"} <ArrowRight size={18} aria-hidden="true"/></>}</button>
                  {loading && <div role="status" className="ss-progress-hint">Checking the available security signals. This can take a little time.</div>}
                </form>
              </div>

              <div className="ss-card ss-report-card" ref={reportRef}>
                <div className="ss-card-heading ss-report-heading"><div className="ss-heading-icon purple"><FileText size={20} aria-hidden="true"/></div><div><h2>Your security report</h2><p>What we found and what it means.</p></div></div>
                {loading ? <div className="ss-report-loading" role="status"><div className="ss-big-spinner"><LoaderCircle size={40} className="ss-spin"/></div><h3>Analyzing your {scanType === "url" ? "link" : "message"}…</h3><p>Looking for suspicious patterns and other available indicators.</p><div className="ss-skeleton"/><div className="ss-skeleton short"/><div className="ss-skeleton"/></div>
                : !result ? <div className="ss-report-empty"><div className="ss-empty-art"><ShieldQuestion size={49} strokeWidth={1.35} aria-hidden="true"/></div><h3>Ready when you are.</h3><p>Your results will show up here after you run a scan.</p><ul><li><CheckCircle2 size={16} aria-hidden="true"/> A clear risk summary</li><li><CheckCircle2 size={16} aria-hidden="true"/> Signs we noticed</li><li><CheckCircle2 size={16} aria-hidden="true"/> Practical next steps</li></ul></div>
                : <div className="ss-report-body" aria-live="polite"><div className={`ss-result-banner ${verdict?.kind ?? "low"}`}><div className="ss-result-icon">{verdict?.kind === "high" ? <ShieldAlert size={23}/> : verdict?.kind === "medium" ? <AlertTriangle size={23}/> : <ShieldCheck size={23}/>}</div><div><span>SCAN COMPLETE</span><h3>{verdict?.label}</h3></div></div>
                  <div className="ss-score-block"><div><span className="ss-small-label">RISK INDICATOR</span><div className="ss-score-value">{score ?? "—"}<small>{score === null ? "" : "/100"}</small></div></div><div className="ss-score-note">{verdict?.description}</div></div>
                  <div className="ss-score-meter"><div className="ss-score-fill" style={{ width: `${score ?? 0}%`, background: verdict?.kind === "high" ? "#e45b5b" : verdict?.kind === "medium" ? "#db9a39" : "#21a687" }}/></div>
                  {unverified && <div className="ss-unverified"><ShieldQuestion size={20} aria-hidden="true"/><span><strong>Website couldn't be verified.</strong> A missing or unresolvable site isn't automatically fraudulent. Avoid entering private details until independently confirmed.</span></div>}
                  <p className="ss-original-verdict"><strong>Detector result:</strong> {result.verdict || "No further details provided."}</p>
                  {result.domain && <div className="ss-report-section"><h4>Website being checked</h4><p className="ss-domain">{result.domain}</p></div>}
                  {result.possible_brand && <div className="ss-report-section"><h4>Possible impersonated brand</h4><p>{result.possible_brand}</p>{result.official_domain_reference && <p className="ss-hint">Configured official domain reference: {result.official_domain_reference}</p>}</div>}
                  <div className="ss-report-section"><h4><AlertTriangle size={16} aria-hidden="true"/> Security findings</h4>{result.warnings?.length ? <ul className="ss-finding-list">{result.warnings.map((item, index) => <li key={index}><span className="ss-list-bullet"/>{item}</li>)}</ul> : <p className="ss-muted">No major warning signs were reported by the available checks.</p>}</div>
                  {Boolean(result.detected_keywords?.length) && <div className="ss-report-section"><h4>Detected indicators</h4><div className="ss-keyword-row">{result.detected_keywords?.map((item, index) => <span className="ss-keyword" key={index}>{item}</span>)}</div></div>}
                  {Boolean(result.urls_found?.length) && <div className="ss-report-section"><h4>Links found in message</h4><ul className="ss-link-list">{result.urls_found?.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
                  <div className="ss-advice"><div><ShieldCheck size={19} aria-hidden="true"/><strong>What should you do?</strong></div>{asLines(result.recommendation).length ? asLines(result.recommendation).map((item, index) => <p key={index}>{item}</p>) : <p>Verify the website or sender independently before taking action.</p>}</div>
                  {mlResult && scanType === "message" && <div className="ss-ml-block"><strong>Experimental ML result</strong><p>{mlResult.prediction || "Unknown prediction"}{typeof mlResult.scam_probability === "number" ? ` · Model score ${Math.round(mlResult.scam_probability * 100)}%` : ""}</p><small>Experimental classifier; not a verified fraud probability.</small></div>}
                  {mlWarning && scanType === "message" && <p className="ss-hint">{mlWarning}</p>}
                  {Boolean(result.dns_status || result.verification_status || result.tls_status || result.reputation_check) && (
                    <div className="ss-tech">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded(!expanded)}
                      >
                        Technical checks
                        <ChevronRight size={17} className={expanded ? "ss-open" : ""} />
                      </button>
                      {expanded && (
                        <dl>
                          {Boolean(result.dns_status) && <><dt>DNS resolution</dt><dd>{formatTechnical(result.dns_status)}</dd></>}
                          {Boolean(result.verification_status) && <><dt>Verification</dt><dd>{formatTechnical(result.verification_status)}</dd></>}
                          {Boolean(result.tls_status) && <><dt>Certificate</dt><dd>{formatTechnical(result.tls_status)}</dd></>}
                          {Boolean(result.reputation_check) && <><dt>Reputation</dt><dd>{formatTechnical(result.reputation_check)}</dd></>}
                        </dl>
                      )}
                    </div>
                  )}
                  <div className="ss-report-actions"><button type="button" onClick={() => void copyReport()}><Clipboard size={16} aria-hidden="true"/>{copied ? "Copied!" : "Copy report"}</button><button type="button" onClick={downloadReport}><Download size={16} aria-hidden="true"/>Download .txt</button><button type="button" className="ss-clear-report" onClick={clearReport}><ShieldCheck size={16} aria-hidden="true"/>Clear report</button></div>
                  <p className="ss-hint">Copy and Download save a report only when you choose. Clear report removes it from this page.</p>
                  <p className="ss-disclaimer"><Info size={14} aria-hidden="true"/> Heuristic risk score, not a probability or a guarantee that content is safe.</p>
                </div>}
              </div>
            </section>
            <div className="ss-privacy-line"><LockKeyhole size={15} aria-hidden="true"/> No scan history is stored by this interface. Inputs clear after processing; the report stays only until cleared or you leave the page. Text and URLs are transmitted to the backend, whose logs and external services require separate privacy controls.</div>
          </>}

          {page === "about" && <section className="ss-page-panel"><div className="ss-page-title"><div><span className="ss-overline">HOW IT WORKS</span><h1>A clearer way to spot scams</h1><p>ScamShield AI explains potentially suspicious patterns so you can make informed decisions.</p></div><div className="ss-page-icon"><ShieldCheck size={29} aria-hidden="true"/></div></div><div className="ss-steps"><div className="ss-step-card"><div className="ss-about-number">01</div><div className="ss-about-icon"><Clipboard size={22} aria-hidden="true"/></div><h3>Paste suspicious content</h3><p>Enter a website address or the text of an email or SMS. Don't include passwords or other secrets.</p></div><div className="ss-step-card"><div className="ss-about-number">02</div><div className="ss-about-icon"><Search size={22} aria-hidden="true"/></div><h3>Scan for warning signs</h3><p>Rules look for risky language and URL patterns. The URL engine also checks configured brand references and other available signals.</p></div><div className="ss-step-card"><div className="ss-about-number">03</div><div className="ss-about-icon"><ShieldCheck size={22} aria-hidden="true"/></div><h3>Act with confidence</h3><p>Read the explanation and recommendations. Always confirm important requests through official channels.</p></div></div><div className="ss-info-grid"><div className="ss-card ss-info-card"><div className="ss-info-head"><ShieldAlert size={20} aria-hidden="true"/><h3>What the score means</h3></div><p>Scores measure patterns found by this prototype. A low score does <strong>not</strong> certify a link as safe, and a high score is not definitive proof of fraud.</p></div><div className="ss-card ss-info-card"><div className="ss-info-head"><LockKeyhole size={20} aria-hidden="true"/><h3>Your privacy</h3></div><p>This frontend does not save scan history. Entered text and URLs are cleared when each scan finishes. The current report exists only in page memory until you clear it or close the page. Your input is still transmitted to the scanning backend; server logs, hosting records, and external threat-check services need separate controls before anyone can promise immediate server-side deletion.</p></div></div><div className="ss-final-action"><span><Sparkles size={20} aria-hidden="true"/> Have a link or message you're unsure about?</span><button type="button" onClick={() => goToScanner("url")}>Start a check <ArrowRight size={16} aria-hidden="true"/></button></div></section>}
        </main>
        <footer className="ss-footer"><span>ScamShield AI · Detect. Verify. Stay Protected.</span><span><ShieldCheck size={15} aria-hidden="true"/> Educational prototype · No guaranteed detection</span></footer>
      </div>
    </div>
  );
}
