import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import "./GmailProtection.css";

const API_BASE = "http://127.0.0.1:8002";
const REFRESH_INTERVAL_MS = 15000;

interface GmailStatus {
  connected: boolean;
  running: boolean;
  last_checked: string | null;
  last_error: string | null;
  emails_scanned: number;
  scams_detected: number;
  scan_interval_seconds?: number;
  monitored_folders?: string[];
}

interface GmailEmail {
  id: string;
  folder?: string;
  subject: string;
  sender: string;
  preview: string;
  prediction: string;
  scam_probability: number;
  risk_level: string;
  scanned_at?: string;
}

interface GmailResults {
  success: boolean;
  total: number;
  emails: GmailEmail[];
}

const formatTime = (value: string | null | undefined): string => {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const getRisk = (item: GmailEmail): "high" | "medium" | "low" => {
  const level = item.risk_level.toUpperCase();
  if (level === "HIGH") return "high";
  if (level === "MEDIUM") return "medium";
  return "low";
};

/**
 * Frontend presentation for the local, single-user Gmail monitoring prototype.
 * The actual polling of Gmail is performed separately by the FastAPI backend.
 */
export default function GmailProtection() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [newAlert, setNewAlert] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const initialized = useRef(false);
  const previousIDs = useRef<Set<string>>(new Set());
  const updating = useRef(false);
  const mounted = useRef(true);
  const notificationsEnabledRef = useRef(false);

  const refresh = useCallback(async (manual = false) => {
    if (updating.current) return;
    updating.current = true;
    if (manual) setRefreshing(true);

    try {
      const [statusResponse, resultsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/gmail/status`, { cache: "no-store" }),
        fetch(`${API_BASE}/api/gmail/results`, { cache: "no-store" }),
      ]);

      if (!statusResponse.ok || !resultsResponse.ok) {
        throw new Error("Unable to load Gmail monitoring data from FastAPI.");
      }

      const nextStatus: GmailStatus = await statusResponse.json();
      const nextResults: GmailResults = await resultsResponse.json();
      const nextEmails = Array.isArray(nextResults.emails) ? nextResults.emails : [];

      if (!mounted.current) return;

      // Do not raise alerts for messages that were scanned before this tab opened.
      if (initialized.current) {
        const freshScams = nextEmails.filter(
          (email) =>
            !previousIDs.current.has(email.id) &&
            email.prediction.toLowerCase() === "scam"
        );
        if (freshScams.length > 0) {
          const subject = freshScams[0].subject || "Suspicious email";
          setNewAlert(
            `${freshScams.length} new potential scam email${freshScams.length === 1 ? "" : "s"} detected: ${subject}`
          );
          if (notificationsEnabledRef.current && "Notification" in window && Notification.permission === "granted") {
            new Notification("ScamShield AI: Potential scam detected", {
              body: subject,
            });
          }
        }
      }

      initialized.current = true;
      previousIDs.current = new Set(nextEmails.map((email) => email.id));
      setStatus(nextStatus);
      setEmails(nextEmails);
      setError("");
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "Unable to reach the Gmail monitor.");
      }
    } finally {
      updating.current = false;
      if (mounted.current) {
        setBusy(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setError("This browser does not support desktop notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      notificationsEnabledRef.current = granted;
      setNotificationsEnabled(granted);
      if (!granted) setError("Notifications were not enabled. In-app alerts will still appear.");
      else setError("");
    } catch {
      setError("Could not enable notifications. In-app alerts will still appear.");
    }
  };

  const flagged = emails.filter((email) => email.prediction.toLowerCase() === "scam");
  const online = Boolean(status?.connected && status?.running && !status?.last_error);

  return (
    <section className="gmail-protection" aria-label="Live email protection">
      <div className="gmail-protection-header">
        <div className="gmail-heading">
          <span className="gmail-heading-icon"><Mail size={22} /></span>
          <div>
            <div className="gmail-eyebrow">AUTOMATIC THREAT MONITORING</div>
            <h2>Live Email Protection</h2>
            <p>New Gmail messages are checked automatically by your backend — including Spam.</p>
          </div>
        </div>
        <span className={`gmail-status-badge ${online ? "connected" : "disconnected"}`}>
          {online ? <Wifi size={15} /> : <WifiOff size={15} />}
          {busy ? "Checking…" : online ? "Monitoring live" : status?.connected ? "Monitor needs attention" : "Gmail not connected"}
        </span>
      </div>

      {error && (
        <div className="gmail-error" role="alert">
          <AlertTriangle size={17} /><span>{error}</span>
        </div>
      )}
      {status?.last_error && (
        <div className="gmail-error" role="alert">
          <AlertTriangle size={17} /><span>Gmail monitor: {status.last_error}</span>
        </div>
      )}
      {newAlert && (
        <div className="gmail-new-alert" role="status">
          <ShieldAlert size={19} /><span>{newAlert}</span>
          <button type="button" onClick={() => setNewAlert("")} aria-label="Dismiss alert">×</button>
        </div>
      )}

      <div className="gmail-stat-grid">
        <div className="gmail-stat"><span><Inbox size={18} /> Emails saved</span><strong>{emails.length}</strong><small>Recent analysis results</small></div>
        <div className="gmail-stat"><span><ShieldAlert size={18} /> Potential scams</span><strong>{flagged.length}</strong><small>Among saved analyses</small></div>
        <div className="gmail-stat"><span><ShieldCheck size={18} /> Emails scanned</span><strong>{status?.emails_scanned ?? "—"}</strong><small>Since backend started</small></div>
        <div className="gmail-stat"><span><Clock3 size={18} /> Last inbox check</span><strong className="gmail-stat-time">{formatTime(status?.last_checked)}</strong><small>Backend checks about every {status?.scan_interval_seconds ?? 30}s</small></div>
      </div>

      <div className="gmail-action-bar">
        {!status?.connected && (
          <a className="gmail-action-button primary" href={`${API_BASE}/auth/google/login`} target="_blank" rel="noopener noreferrer">
            <Mail size={16} /> Connect Gmail
          </a>
        )}
        <button className="gmail-action-button" onClick={() => void refresh(true)} disabled={refreshing} type="button">
          <RefreshCw size={16} className={refreshing ? "gmail-spin" : ""} /> Refresh now
        </button>
        <button className="gmail-action-button" onClick={() => void enableNotifications()} disabled={notificationsEnabled} type="button">
          <Bell size={16} /> {notificationsEnabled ? "Desktop alerts enabled" : "Enable desktop alerts"}
        </button>
        <span className="gmail-refresh-note">Dashboard updates every 15 seconds while this page is open.</span>
      </div>

      <div className="gmail-feed-title">
        <h3>Recent analyzed emails</h3>
        <span>{emails.length} saved</span>
      </div>

      {busy ? (
        <div className="gmail-empty"><RefreshCw size={24} className="gmail-spin" /><p>Loading monitoring results…</p></div>
      ) : emails.length === 0 ? (
        <div className="gmail-empty">
          <CheckCircle2 size={29} />
          <h3>No email analyses yet</h3>
          <p>Send a new test email to your connected Inbox or Spam folder. Results will appear here after the backend checks it.</p>
        </div>
      ) : (
        <div className="gmail-email-list">
          {emails.slice(0, 20).map((email) => {
            const risk = getRisk(email);
            return (
              <article className="gmail-email" key={email.id}>
                <div className="gmail-email-top">
                  <span className={`gmail-risk gmail-risk-${risk}`}>
                    {risk === "high" ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                    {risk.toUpperCase()} RISK · {email.prediction}
                  </span>
                  <span className="gmail-folder">{email.folder || "GMAIL"}</span>
                </div>
                <h4>{email.subject || "(No subject)"}</h4>
                <p className="gmail-email-sender">From: {email.sender || "Unknown sender"}</p>
                <p className="gmail-email-preview">{email.preview || "No plain-text preview available."}</p>
                <div className="gmail-email-bottom">
                  <span>ML model score: {Number.isFinite(email.scam_probability) ? Math.round(email.scam_probability * 100) : "—"}%</span>
                  <span>{formatTime(email.scanned_at)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="gmail-disclaimer">
        <ShieldCheck size={15} /> Experimental detection: model scores are not verified fraud probabilities.
        A low-risk result does not guarantee that an email is safe. Desktop alerts work only while this site is open.
      </p>
    </section>
  );
}
