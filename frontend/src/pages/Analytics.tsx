import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

interface HistoryItem {
  id: number;
  type: "message" | "url";
  score: number;
  verdict: string;
  date: string;
}

interface AnalyticsProps {
  history: HistoryItem[];
}

export default function Analytics({ history }: AnalyticsProps) {
  const lowRisk = history.filter((item) => item.score < 30).length;

  const mediumRisk = history.filter(
    (item) => item.score >= 30 && item.score < 60
  ).length;

  const highRisk = history.filter((item) => item.score >= 60).length;

  const messageScans = history.filter(
    (item) => item.type === "message"
  ).length;

  const urlScans = history.filter(
    (item) => item.type === "url"
  ).length;

  const highRiskRate = history.length
    ? Math.round((highRisk / history.length) * 100)
    : 0;

  const distributionData = [
    { name: "Low Risk", value: lowRisk, color: "#22c55e" },
    { name: "Medium Risk", value: mediumRisk, color: "#f59e0b" },
    { name: "High Risk", value: highRisk, color: "#ef4444" },
  ];

  const trendData = [...history]
    .reverse()
    .map((item, index) => ({
      scan: index + 1,
      risk: item.score,
    }));

  return (
    <div className="analytics-page">
      <div className="analytics-intro">
        <h2>Threat Intelligence Analytics</h2>
        <p>
          Explore security findings and risk trends across your
          completed scans.
        </p>
      </div>

      <div className="analytics-metrics">
        <div className="analytics-metric">
          <span>TOTAL SCANS</span>
          <h2>{history.length}</h2>
          <p>Completed analyses</p>
        </div>

        <div className="analytics-metric">
          <span>MESSAGE SCANS</span>
          <h2>{messageScans}</h2>
          <p>Messages analyzed</p>
        </div>

        <div className="analytics-metric">
          <span>URL SCANS</span>
          <h2>{urlScans}</h2>
          <p>Website links analyzed</p>
        </div>

        <div className="analytics-metric">
          <span>HIGH-RISK RATE</span>
          <h2>{highRiskRate}%</h2>
          <p>Of completed scans</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="analytics-chart-card">
          <h3>No analytics available yet</h3>
          <p>
            Run a message or URL scan to generate your first
            security analytics report.
          </p>
        </div>
      ) : (
        <div className="analytics-charts">
          <div className="analytics-chart-card">
            <h3>Threat Distribution</h3>
            <p>Risk classification across all scans</p>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={4}
                  >
                    {distributionData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    contentStyle={{
                      background: "#101724",
                      border: "1px solid #29374e",
                      borderRadius: "10px",
                      color: "#fff",
                    }}
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="analytics-chart-card">
            <h3>Risk Score Trend</h3>
            <p>Risk scores across consecutive scans</p>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient
                      id="riskGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#38bdf8"
                        stopOpacity={0.35}
                      />

                      <stop
                        offset="100%"
                        stopColor="#38bdf8"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#253047"
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="scan"
                    stroke="#8290a9"
                    tick={{ fontSize: 12 }}
                  />

                  <YAxis
                    domain={[0, 100]}
                    stroke="#8290a9"
                    tick={{ fontSize: 12 }}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#101724",
                      border: "1px solid #29374e",
                      borderRadius: "10px",
                      color: "#fff",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    fill="url(#riskGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}