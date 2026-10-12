import { useState } from "react";
import {
  Search,
  Trash2,
  Download,
  Filter,
  ShieldCheck,
  MessageSquare,
  Link2,
  AlertTriangle,
} from "lucide-react";

import type { ScanHistoryItem } from "../utils/storage";

interface ScanHistoryProps {
  history: ScanHistoryItem[];
  onDelete: (id: number) => void;
  onClear: () => void;
}

type RiskFilter = "all" | "high" | "medium" | "low";

export default function ScanHistory({
  history,
  onDelete,
  onClear,
}: ScanHistoryProps) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  const getRiskLevel = (score: number): "high" | "medium" | "low" => {
    if (score >= 60) return "high";
    if (score >= 30) return "medium";
    return "low";
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.verdict.toLowerCase().includes(search.toLowerCase()) ||
      item.type.toLowerCase().includes(search.toLowerCase()) ||
      item.date.toLowerCase().includes(search.toLowerCase());

    const matchesRisk =
      riskFilter === "all" ||
      getRiskLevel(item.score) === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const exportCSV = () => {
    if (filteredHistory.length === 0) return;

    const escapeCSV = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const rows = [
      ["ID", "Type", "Risk Score", "Risk Level", "Verdict", "Date"],
      ...filteredHistory.map((item) => [
        item.id,
        item.type,
        item.score,
        getRiskLevel(item.score),
        item.verdict,
        item.date,
      ]),
    ];

    const csv = rows
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ScamShield_Scan_History.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (history.length === 0) return;

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete all saved scans?"
    );

    if (confirmed) {
      onClear();
    }
  };

  return (
    <section className="history-page">
      <div className="history-page-header">
        <div>
          <div className="premium-label">
            <ShieldCheck size={15} />
            SECURITY INVESTIGATION
          </div>

          <h2>Scan History</h2>

          <p>
            Review, search, and manage your previous security
            analyses.
          </p>
        </div>

        <div className="history-actions">
          <button
            className="history-export-button"
            onClick={exportCSV}
            disabled={filteredHistory.length === 0}
          >
            <Download size={17} />
            Export CSV
          </button>

          <button
            className="history-clear-button"
            onClick={handleClear}
            disabled={history.length === 0}
          >
            <Trash2 size={17} />
            Clear History
          </button>
        </div>
      </div>

      <div className="history-overview">
        <div className="history-overview-card">
          <span>TOTAL SCANS</span>
          <strong>{history.length}</strong>
        </div>

        <div className="history-overview-card">
          <span>HIGH RISK</span>
          <strong className="history-high">
            {history.filter((item) => item.score >= 60).length}
          </strong>
        </div>

        <div className="history-overview-card">
          <span>MEDIUM RISK</span>
          <strong className="history-medium">
            {
              history.filter(
                (item) => item.score >= 30 && item.score < 60
              ).length
            }
          </strong>
        </div>

        <div className="history-overview-card">
          <span>LOW RISK</span>
          <strong className="history-low">
            {history.filter((item) => item.score < 30).length}
          </strong>
        </div>
      </div>

      <div className="history-table-card">
        <div className="history-toolbar">
          <div className="history-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search scans by verdict, type, or date..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="history-filter">
            <Filter size={17} />

            <select
              value={riskFilter}
              onChange={(event) =>
                setRiskFilter(event.target.value as RiskFilter)
              }
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="history-empty">
            <ShieldCheck size={45} />

            <h3>No scans found</h3>

            <p>
              {history.length === 0
                ? "Run your first security scan to see results here."
                : "Try adjusting your search or risk filter."}
            </p>
          </div>
        ) : (
          <div className="history-table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>SCAN TYPE</th>
                  <th>VERDICT</th>
                  <th>RISK LEVEL</th>
                  <th>SCORE</th>
                  <th>DATE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.map((item) => {
                  const risk = getRiskLevel(item.score);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="history-type">
                          {item.type === "message" ? (
                            <MessageSquare size={17} />
                          ) : (
                            <Link2 size={17} />
                          )}

                          <span>
                            {item.type === "message"
                              ? "Message"
                              : "URL"}
                          </span>
                        </div>
                      </td>

                      <td className="history-verdict">
                        {item.verdict}
                      </td>

                      <td>
                        <span className={`risk-pill ${risk}`}>
                          {risk.toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <strong>{item.score}/100</strong>
                      </td>

                      <td className="history-date">
                        {item.date}
                      </td>

                      <td>
                        <button
                          className="history-delete-button"
                          title="Delete scan"
                          aria-label={`Delete scan ${item.id}`}
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="history-table-footer">
          <span>
            Showing {filteredHistory.length} of {history.length} scans
          </span>

          <span>
            <AlertTriangle size={14} />
            Stored locally in this browser
          </span>
        </div>
      </div>
    </section>
  );
}