import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Link2,
  MessageSquare,
  Radar,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/header";
import Analytics from "./pages/Analytics";
import ScanHistory from "./pages/ScanHistory";

import {
  getScanHistory,
  saveScanHistory,
  type ScanHistoryItem,
} from "./utils/storage";

import "./App.css";

// ==========================================
// TYPES
// ==========================================

type ScannerType = "message" | "url";

interface MLResult {
  prediction: string;
  scam_probability: number;
  model: string;
}

interface ScanResult {
  risk_score: number;
  risk_level: string;
  verdict: string;
  detected_keywords?: string[];
  urls_found?: string[];
  warnings?: string[];
  domain?: string;
  recommendation: string;
}

// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE = "http://127.0.0.1:8002";

// ==========================================
// MAIN APPLICATION
// ==========================================

function App() {
  // Navigation
  const [activePage, setActivePage] = useState("Dashboard");

  // Scanner
  const [scannerType, setScannerType] =
    useState<ScannerType>("message");

  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");

  // Results
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mlResult, setMlResult] = useState<MLResult | null>(null);
  const [mlWarning, setMlWarning] = useState("");

  // Loading and errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Scan history
  const [history, setHistory] = useState<ScanHistoryItem[]>(
    () => getScanHistory()
  );

  // ==========================================
  // SAVE HISTORY
  // ==========================================

  useEffect(() => {
    saveScanHistory(history);
  }, [history]);

  // ==========================================
  // DELETE INDIVIDUAL SCAN
  // ==========================================

  const deleteScan = (id: number) => {
    setHistory((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  // ==========================================
  // CLEAR ALL SCANS
  // ==========================================

  const clearAllScans = () => {
    setHistory([]);
  };

  // ==========================================
  // DASHBOARD STATISTICS
  // ==========================================

  const totalScans = history.length;

  const highRiskCount = history.filter(
    (item) => item.score >= 60
  ).length;

  const averageRisk =
    history.length > 0
      ? Math.round(
          history.reduce(
            (sum, item) => sum + item.score,
            0
          ) / history.length
        )
      : 0;

  // ==========================================
  // RISK LEVEL CLASS
  // ==========================================

  const getRiskClass = (score: number) => {
    if (score >= 60) return "high";
    if (score >= 30) return "medium";
    return "low";
  };

  // ==========================================
  // NAVIGATION
  // ==========================================

  const changePage = (page: string) => {
    setActivePage(page);
    setResult(null);
    setMlResult(null);
    setMlWarning("");
    setError("");

    if (page === "Message Scanner") {
      setScannerType("message");
    }

    if (page === "URL Scanner") {
      setScannerType("url");
    }
  };

  // ==========================================
  // SWITCH SCANNER TYPE
  // ==========================================

  const switchScanner = (type: ScannerType) => {
    setScannerType(type);
    setResult(null);
    setMlResult(null);
    setMlWarning("");
    setError("");
  };

  // ==========================================
  // ANALYZE MESSAGE OR URL
  // ==========================================

  const analyze = async () => {
    if (loading) return;

    const input =
      scannerType === "message" ? message : url;

    if (!input.trim()) {
      setError(
        scannerType === "message"
          ? "Please enter a message to analyze."
          : "Please enter a URL to analyze."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setMlResult(null);
    setMlWarning("");

    const endpoint =
      scannerType === "message"
        ? "/api/analyze"
        : "/api/analyze-url";

    const payload =
      scannerType === "message"
        ? { text: message.trim() }
        : { url: url.trim() };

    try {
      const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        throw new Error(
          `Backend returned error ${response.status}`
        );
      }

      const data: ScanResult = await response.json();

      setResult(data);

      // Machine learning only supports messages, not URLs.
      // ML failure must never break an otherwise successful rule-based scan.
      if (scannerType === "message") {
        try {
          const mlResponse = await fetch(`${API_BASE}/api/analyze-ml`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message.trim() }),
          });
          if (!mlResponse.ok) throw new Error("ML service unavailable");
          const mlData: MLResult = await mlResponse.json();
          setMlResult(mlData);
        } catch {
          setMlWarning("ML analysis is temporarily unavailable. Rule-based analysis is still shown.");
        }
      }

      // Save scan to history
      const newScan: ScanHistoryItem = {
        id: Date.now() + Math.random(),
        type: scannerType,
        score: data.risk_score,
        verdict: data.verdict,
        date: new Date().toLocaleString(),
      };

      setHistory((previous) => [
        newScan,
        ...previous,
      ]);
    } catch (err) {
      console.error("Analysis error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // MAIN USER INTERFACE
  // ==========================================

  return (
    <div className="premium-app">

      {/* ======================================
          SIDEBAR
      ====================================== */}

      <Sidebar
        activePage={activePage}
        setActivePage={changePage}
      />

      <div className="main-area">

        {/* ======================================
            HEADER
        ====================================== */}

        <Header activePage={activePage} />

        <main className="dashboard-content">

          {/* ======================================
              HERO SECTION
          ====================================== */}

          <motion.section
            className="welcome-section"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="welcome-text">

              <div className="premium-label">
                <Sparkles size={14} />
                INTELLIGENT THREAT DETECTION
              </div>

              <h1>
                Your digital world.
                <br />
                <span>
                  Protected intelligently.
                </span>
              </h1>

              <p>
                Analyze suspicious messages and URLs
                through a unified security intelligence
                workspace.
              </p>

              <button
                className="primary-action"
                onClick={() =>
                  changePage("Message Scanner")
                }
              >
                Start a security scan
                <ArrowRight size={18} />
              </button>

            </div>

            <div className="hero-visual">

              <div className="shield-glow">
                <Shield
                  size={105}
                  strokeWidth={1.2}
                />
              </div>

              <div className="visual-caption">
                <span className="live-dot"></span>
                SCAMSHIELD DETECTION ENGINE
              </div>

            </div>

          </motion.section>

          {/* ======================================
              DASHBOARD METRICS
          ====================================== */}

          <section className="metrics-grid">

            {/* TOTAL SCANS */}

            <div className="metric-card">

              <div className="metric-top">
                <span>Total Scans</span>
                <Activity size={20} />
              </div>

              <h2>{totalScans}</h2>

              <p>
                Saved security analyses
              </p>

            </div>

            {/* HIGH RISK */}

            <div className="metric-card">

              <div className="metric-top">
                <span>High-Risk Findings</span>
                <AlertTriangle size={20} />
              </div>

              <h2>{highRiskCount}</h2>

              <p>
                Scans requiring attention
              </p>

            </div>

            {/* AVERAGE RISK */}

            <div className="metric-card">

              <div className="metric-top">
                <span>Average Risk Score</span>
                <Radar size={20} />
              </div>

              <h2>
                {averageRisk}
                <small>/100</small>
              </h2>

              <p>
                Across completed scans
              </p>

            </div>

            {/* ENGINE STATUS */}

            <div className="metric-card">

              <div className="metric-top">
                <span>Detection Engine</span>
                <Zap size={20} />
              </div>

              <h2 className="active-text">
                Ready
              </h2>

              <p>
                Rule-based analysis available
              </p>

            </div>

          </section>

          {/* ======================================
              LIVE GMAIL PROTECTION — DASHBOARD
          ====================================== */}

          {/* ======================================
              PAGE CONTENT
          ====================================== */}

          {activePage === "Scan History" ? (

            // ====================================
            // PROFESSIONAL SCAN HISTORY
            // ====================================

            <ScanHistory
              history={history}
              onDelete={deleteScan}
              onClear={clearAllScans}
            />

          ) : activePage === "Analytics" ? (

            // ====================================
            // ANALYTICS DASHBOARD
            // ====================================

            <Analytics history={history} />

          ) : activePage === "Settings" ? (

            // ====================================
            // SETTINGS
            // ====================================

            <section className="workspace-card">

              <div className="card-heading">

                <div>
                  <h2>
                    Workspace Settings
                  </h2>

                  <p>
                    Application configuration
                  </p>
                </div>

              </div>

              <div className="settings-content">

                <p className="settings-line">
                  <strong>API Endpoint:</strong>{" "}
                  {API_BASE}
                </p>

                <p className="settings-line">
                  <strong>Detection Mode:</strong>{" "}
                  Rule-based + experimental ML
                </p>

                <p className="settings-line">
                  <strong>Scan History:</strong>{" "}
                  Browser local storage
                </p>

                <p className="settings-line">
                  <strong>Application:</strong>{" "}
                  ScamShield AI
                </p>

              </div>

            </section>

          ) : (

            // ====================================
            // SCANNER WORKSPACE
            // ====================================

            <section className="workspace-grid">

              {/* ==================================
                  LEFT: SCANNER
              ================================== */}

              <div className="workspace-card scanner-workspace">

                <div className="card-heading">

                  <div className="heading-icon">
                    <Radar size={21} />
                  </div>

                  <div>
                    <h2>
                      Threat Intelligence Scanner
                    </h2>

                    <p>
                      Submit suspicious content
                      for security analysis.
                    </p>
                  </div>

                </div>

                {/* SCANNER SWITCH */}

                <div className="scanner-switch">

                  <button
                    className={
                      scannerType === "message"
                        ? "switch-button selected"
                        : "switch-button"
                    }
                    onClick={() =>
                      switchScanner("message")
                    }
                  >
                    <MessageSquare size={17} />
                    Message
                  </button>

                  <button
                    className={
                      scannerType === "url"
                        ? "switch-button selected"
                        : "switch-button"
                    }
                    onClick={() =>
                      switchScanner("url")
                    }
                  >
                    <Link2 size={17} />
                    URL
                  </button>

                </div>

                {/* SCANNER INPUT */}

                <div className="scanner-input">

                  <label>
                    {scannerType === "message"
                      ? "MESSAGE CONTENT"
                      : "WEBSITE ADDRESS"}
                  </label>

                  {scannerType === "message" ? (

                    <textarea
                      placeholder="Paste a suspicious SMS, email, or message..."
                      value={message}
                      onChange={(event) =>
                        setMessage(event.target.value)
                      }
                    />

                  ) : (

                    <input
                      type="text"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(event) =>
                        setUrl(event.target.value)
                      }
                    />

                  )}

                </div>

                {/* ANALYZE BUTTON */}

                <button
                  className="scan-action"
                  onClick={analyze}
                  disabled={loading}
                >

                  {loading ? (

                    <>
                      <Activity size={18} />
                      Analyzing threat...
                    </>

                  ) : (

                    <>
                      <Zap size={18} />
                      Run Threat Analysis
                      <ArrowRight size={18} />
                    </>

                  )}

                </button>

                {/* ERROR MESSAGE */}

                {error && (

                  <div className="scan-error">
                    <AlertTriangle size={18} />
                    {error}
                  </div>

                )}

                {/* SCANNER FOOTER */}

                <div className="scanner-footer">
                  <ShieldCheck size={16} />
                  Rule-based analysis with optional experimental ML
                </div>

              </div>

              {/* ==================================
                  RIGHT: INTELLIGENCE REPORT
              ================================== */}

              <div className="workspace-card intelligence-panel">

                <div className="card-heading">

                  <div className="heading-icon">
                    <ShieldCheck size={21} />
                  </div>

                  <div>
                    <h2>
                      Intelligence Report
                    </h2>

                    <p>
                      Security analysis results
                    </p>
                  </div>

                </div>

                {!result ? (

                  // EMPTY REPORT

                  <div className="empty-report">

                    <div className="empty-report-icon">
                      <ShieldCheck
                        size={52}
                        strokeWidth={1.3}
                      />
                    </div>

                    <h3>
                      Awaiting analysis
                    </h3>

                    <p>
                      Submit a message or URL
                      to generate a detailed
                      threat assessment.
                    </p>

                    <span className="awaiting-badge">
                      <span className="live-dot"></span>
                      READY TO SCAN
                    </span>

                  </div>

                ) : (

                  // ANALYSIS RESULTS

                  <motion.div
                    className="report-content"
                    initial={{
                      opacity: 0,
                      y: 10,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                  >

                    {/* RISK SCORE */}

                    <div className="report-score-row">

                      <div
                        className={`score-ring ${getRiskClass(
                          result.risk_score
                        )}`}
                      >
                        <strong>
                          {result.risk_score}
                        </strong>

                        <span>/100</span>
                      </div>

                      <div>

                        <span
                          className={`risk-pill ${getRiskClass(
                            result.risk_score
                          )}`}
                        >
                          {result.risk_level}
                        </span>

                        <h3>
                          {result.verdict}
                        </h3>

                      </div>

                    </div>

                    {mlResult && scannerType === "message" && (
                      <div className="ml-result-card">
                        <h4>MACHINE-LEARNING ANALYSIS</h4>
                        <p><strong>Prediction:</strong> {mlResult.prediction}</p>
                        <p><strong>Model score:</strong> {Math.round(mlResult.scam_probability * 100)}%</p>
                        <small>{mlResult.model} · Experimental score, not verified fraud probability.</small>
                      </div>
                    )}

                    {mlWarning && scannerType === "message" && (
                      <p className="report-disclaimer">{mlWarning}</p>
                    )}

                    <div className="report-divider"></div>

                    {/* ANALYZED DOMAIN */}

                    {result.domain && (

                      <div className="report-detail">

                        <h4>
                          ANALYZED DOMAIN
                        </h4>

                        <p>
                          {result.domain}
                        </p>

                      </div>

                    )}

                    {/* DETECTED KEYWORDS */}

                    {result.detected_keywords &&
                      result.detected_keywords.length > 0 && (

                        <div className="report-detail">

                          <h4>
                            DETECTED INDICATORS
                          </h4>

                          <div className="threat-tags">

                            {result.detected_keywords.map(
                              (keyword, index) => (

                                <span key={index}>
                                  {keyword}
                                </span>

                              )
                            )}

                          </div>

                        </div>

                      )}

                    {/* WARNINGS */}

                    {result.warnings &&
                      result.warnings.length > 0 && (

                        <div className="report-detail">

                          <h4>
                            SECURITY WARNINGS
                          </h4>

                          {result.warnings.map(
                            (warning, index) => (

                              <p key={index}>
                                ⚠ {warning}
                              </p>

                            )
                          )}

                        </div>

                      )}

                    {/* URLS FOUND */}

                    {result.urls_found &&
                      result.urls_found.length > 0 && (

                        <div className="report-detail">

                          <h4>
                            LINKS FOUND
                          </h4>

                          {result.urls_found.map(
                            (foundUrl, index) => (

                              <p key={index}>
                                {foundUrl}
                              </p>

                            )
                          )}

                        </div>

                      )}

                    {/* RECOMMENDATION */}

                    <div className="report-recommendation">

                      <CheckCircle2 size={19} />

                      <div>

                        <strong>
                          Security Recommendation
                        </strong>

                        <p>
                          {result.recommendation}
                        </p>

                      </div>

                    </div>

                    <p className="report-disclaimer">
                      Risk scores are heuristic indicators,
                      not verified probabilities of fraud.
                    </p>

                  </motion.div>

                )}

              </div>

            </section>

          )}

          {/* ======================================
              FOOTER
          ====================================== */}

          <footer className="premium-footer">

            <span>
              © 2026 ScamShield AI
            </span>

            <span>
              <ShieldCheck size={14} />
              SECURITY INTELLIGENCE WORKSPACE
            </span>

          </footer>

        </main>

      </div>

    </div>
  );
}

export default App;