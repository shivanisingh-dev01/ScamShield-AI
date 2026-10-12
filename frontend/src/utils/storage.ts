export interface ScanHistoryItem {
  id: number;
  type: "message" | "url";
  score: number;
  verdict: string;
  date: string;
}

const STORAGE_KEY = "scamshield_scan_history";

export function getScanHistory(): ScanHistoryItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is ScanHistoryItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "number" &&
        (item.type === "message" || item.type === "url") &&
        typeof item.score === "number" &&
        typeof item.verdict === "string" &&
        typeof item.date === "string"
    );
  } catch {
    return [];
  }
}

export function saveScanHistory(
  history: ScanHistoryItem[]
): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history)
    );
  } catch (error) {
    console.error("Unable to save scan history:", error);
  }
}

export function clearScanHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}