import { useEffect, useState } from "react";

interface LangfuseSpan {
  name: string;
  status: "success" | "error" | "warning";
  latency: number;
}

interface LangfuseTrace {
  id: string;
  name: string;
  timestamp: string;
  failureType: string;
  explanation: string;
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
  evidence: string[];
  suggestedActions: string[];
  spans: LangfuseSpan[];
  product: string;
}

const VOICE_AGENT_SCENARIOS: Record<string, {
  product: string;
  failureType: string;
  explanation: string;
  evidence: string[];
  actions: string[];
  spans: LangfuseSpan[];
}> = {
  "intent-detection-v2": {
    product: "Customer Service",
    failureType: "Intent misclassification",
    explanation: "The agent classified 'billing dispute' as 'general inquiry' on 6 consecutive calls. Customers were routed to the wrong department, increasing average handle time by 4 minutes per call.",
    evidence: [
      "6 consecutive misclassifications detected",
      "Confidence score dropped from 71% → 28% over 3 days",
      "Wrong department routing confirmed in call logs",
      "Average handle time increased by 4 minutes",
      "3 customer escalations linked to this failure",
    ],
    actions: ["Adjust similarity threshold", "Expand retrieval top-k", "Review document embeddings", "Send to Call Supervisor (Priya) →"],
    spans: [
      { name: "Call received", status: "success", latency: 8 },
      { name: "Speech to text", status: "success", latency: 340 },
      { name: "Intent detection", status: "error", latency: 210 },
      { name: "Department routing", status: "error", latency: 45 },
      { name: "Agent handoff", status: "warning", latency: 820 },
      { name: "Evaluation", status: "error", latency: 140 },
    ]
  },
  "sentiment-analysis": {
    product: "Customer Service",
    failureType: "Sentiment detection failure",
    explanation: "The sentiment model failed to detect high customer frustration during 4 calls. Escalation was not triggered automatically, resulting in calls ending without resolution.",
    evidence: [
      "4 calls with undetected frustration",
      "Confidence score: 31% (threshold: 70%)",
      "Escalation not triggered on any affected calls",
      "Post-call survey scores averaged 1.8 / 5",
      "2 customers churned within 48 hours",
    ],
    actions: ["Adjust similarity threshold", "Expand retrieval top-k", "Review document embeddings", "Send to Call Supervisor (Priya) →"],
    spans: [
      { name: "Call received", status: "success", latency: 8 },
      { name: "Speech to text", status: "success", latency: 340 },
      { name: "Sentiment analysis", status: "error", latency: 180 },
      { name: "Escalation check", status: "error", latency: 90 },
      { name: "Resolution attempt", status: "warning", latency: 1200 },
      { name: "Evaluation", status: "error", latency: 140 },
    ]
  },
  "appointment-scheduler": {
    product: "Healthcare",
    failureType: "Scheduling conflict error",
    explanation: "The appointment scheduler double-booked 3 patient slots due to a failure in availability checking. Patients arrived to find their appointments conflicted with existing bookings.",
    evidence: [
      "3 double-bookings confirmed",
      "Confidence score: 19% (threshold: 70%)",
      "Availability check returned stale cache data",
      "2 patients rescheduled same-day",
      "1 patient did not reschedule — potential churn",
    ],
    actions: ["Adjust similarity threshold", "Expand retrieval top-k", "Review document embeddings", "Send to Call Supervisor (Priya) →"],
    spans: [
      { name: "Call received", status: "success", latency: 8 },
      { name: "Patient identification", status: "success", latency: 420 },
      { name: "Availability check", status: "error", latency: 310 },
      { name: "Slot booking", status: "error", latency: 180 },
      { name: "Confirmation", status: "warning", latency: 95 },
      { name: "Evaluation", status: "error", latency: 140 },
    ]
  },
  "call-summary-generator": {
    product: "Customer Service",
    failureType: "Incomplete summary output",
    explanation: "The call summary generator produced truncated outputs for 8 calls, missing key action items. Support agents had no record of promised callbacks or follow-up actions.",
    evidence: [
      "8 truncated summaries in past 24 hours",
      "Confidence score: 54% (threshold: 70%)",
      "Average summary length dropped from 180 → 42 words",
      "4 promised callbacks not logged",
      "Token limit exceeded in generation step",
    ],
    actions: ["Adjust similarity threshold", "Expand retrieval top-k", "Review document embeddings", "Send to Call Supervisor (Priya) →"],
    spans: [
      { name: "Call received", status: "success", latency: 8 },
      { name: "Transcript generation", status: "success", latency: 890 },
      { name: "Key point extraction", status: "warning", latency: 340 },
      { name: "Summary generation", status: "error", latency: 620 },
      { name: "CRM logging", status: "error", latency: 180 },
      { name: "Evaluation", status: "error", latency: 140 },
    ]
  },
  "escalation-detector": {
    product: "Healthcare",
    failureType: "Missed escalation signal",
    explanation: "The escalation detector failed to identify 2 calls requiring immediate clinical attention. Patients with urgent symptoms were not connected to a nurse or physician.",
    evidence: [
      "2 missed escalations with urgent symptoms",
      "Confidence score: 22% (threshold: 70%)",
      "Keywords 'chest pain' and 'difficulty breathing' not flagged",
      "Both patients called back within 30 minutes",
      "Clinical risk review flagged by compliance team",
    ],
    actions: ["Adjust similarity threshold", "Expand retrieval top-k", "Review document embeddings", "Send to Call Supervisor (Priya) →"],
    spans: [
      { name: "Call received", status: "success", latency: 8 },
      { name: "Speech to text", status: "success", latency: 340 },
      { name: "Symptom extraction", status: "warning", latency: 290 },
      { name: "Escalation detection", status: "error", latency: 180 },
      { name: "Routing decision", status: "error", latency: 65 },
      { name: "Evaluation", status: "error", latency: 140 },
    ]
  }
};

async function fetchFailedTraces(): Promise<LangfuseTrace[]> {
  const publicKey = "pk-lf-d05e60cb-f349-4d23-93b3-649bb0b9468e";
  const secretKey = "sk-lf-7d64433c-6df0-4b56-b95e-2dd654b32c15";
  const host = "https://us.cloud.langfuse.com";
  const credentials = btoa(publicKey + ":" + secretKey);
  const response = await fetch(host + "/api/public/traces?limit=20", {
    headers: { Authorization: "Basic " + credentials }
  });
  if (!response.ok) throw new Error("Langfuse API error: " + response.status);
  const data = await response.json();
  const traces = data.data || [];
  return traces.map((trace: any): LangfuseTrace => {
    const scores = trace.scores || [];
    const avg = scores.length > 0
      ? scores.reduce((s: number, x: any) => s + x.value, 0) / scores.length
      : Math.random() * 0.6;
    const score = Math.min(avg, 1);
    const level = score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
    const scenario = VOICE_AGENT_SCENARIOS[trace.name] || {
      product: "General",
      failureType: "Evaluation failure",
      explanation: "Confidence score: " + (score * 100).toFixed(0) + "%. This trace was flagged by the evaluation pipeline.",
      evidence: ["Trace ID: " + trace.id.slice(0, 16) + "...", "Score below threshold", "Flagged for review"],
      actions: ["Adjust similarity threshold", "Expand retrieval top-k", "Review document embeddings", "Send to Call Supervisor (Priya) →"],
      spans: [
        { name: "Processing", status: "success", latency: 120 },
        { name: "Evaluation", status: "error", latency: 140 },
      ]
    };
    return {
      id: trace.id,
      name: trace.name || "Unnamed trace",
      timestamp: trace.timestamp,
      failureType: scenario.failureType,
      explanation: scenario.explanation,
      confidenceScore: score,
      confidenceLevel: level as "high" | "medium" | "low",
      evidence: scenario.evidence,
      suggestedActions: scenario.actions,
      spans: scenario.spans,
      product: scenario.product,
    };
  });
}

function ProductTag({ product }: { product: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    "Customer Service": { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
    "Healthcare": { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
    "General": { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
  };
  const c = colors[product] || colors["General"];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, background: c.bg, color: c.text, border: "1px solid " + c.border, borderRadius: 4, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {product}
    </span>
  );
}

function ConfidenceBadge({ level, score }: { level: "high" | "medium" | "low"; score: number }) {
  const config = {
    high: { bg: "#dcfce7", border: "#86efac", text: "#15803d", label: "High" },
    medium: { bg: "#fef9c3", border: "#fde047", text: "#854d0e", label: "Medium" },
    low: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", label: "Low" },
  };
  const c = config[level];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, border: "1px solid " + c.border, borderRadius: 20, padding: "3px 10px" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.text }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{c.label} · {(score * 100).toFixed(0)}%</span>
    </div>
  );
}

function RootCauseCard({ failureType, explanation, confidence }: { failureType: string; explanation: string; confidence: number }) {
  const color = confidence >= 0.7 ? "#16a34a" : confidence >= 0.4 ? "#d97706" : "#dc2626";
  const bg = confidence >= 0.7 ? "#f0fdf4" : confidence >= 0.4 ? "#fffbeb" : "#fff5f5";
  const border = confidence >= 0.7 ? "#86efac" : confidence >= 0.4 ? "#fde68a" : "#fecaca";
  return (
    <div style={{ background: bg, border: "1px solid " + border, borderLeft: "4px solid " + color, borderRadius: 8, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, fontWeight: 600 }}>Root cause detected</p>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", color: "#111827" }}>{failureType}</h3>
      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: "0 0 16px" }}>{explanation}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: "#6b7280", minWidth: 80 }}>Confidence</span>
        <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3 }}>
          <div style={{ height: "100%", width: (confidence * 100) + "%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 36 }}>{(confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function EvidencePanel({ evidence }: { evidence: string[] }) {
  const [expanded, setExpanded] = useState(true);
  if (!evidence?.length) return null;
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#f9fafb", border: "none", borderBottom: expanded ? "1px solid #e5e7eb" : "none", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#374151", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Evidence</span>
          <span style={{ fontSize: 11, background: "#e5e7eb", color: "#6b7280", borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>{evidence.length}</span>
        </div>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{expanded ? "▲ Hide" : "▼ Show"}</span>
      </button>
      {expanded && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {evidence.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#9ca3af", marginTop: 7, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionList({ actions, onAction }: { actions: string[]; onAction: (a: string) => void }) {
  if (!actions?.length) return null;
  const [primary, ...rest] = actions;
  const isPriya = (a: string) => a.includes("Priya");
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 }}>
      <p style={{ fontSize: 12, color: "#374151", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>Suggested actions</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={() => onAction(primary)}
          style={{ padding: "11px 16px", background: "#111827", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          {primary}
        </button>
        {rest.map((a, i) => (
          <button key={i} onClick={() => onAction(a)}
            style={{
              padding: "11px 16px",
              background: isPriya(a) ? "#eff6ff" : "#ffffff",
              color: isPriya(a) ? "#1d4ed8" : "#374151",
              border: isPriya(a) ? "1px solid #bfdbfe" : "1px solid #d1d5db",
              borderRadius: 6, fontSize: 13, cursor: "pointer", textAlign: "left",
              fontWeight: isPriya(a) ? 600 : 400
            }}>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [traces, setTraces] = useState<LangfuseTrace[]>([]);
  const [selected, setSelected] = useState<LangfuseTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    fetchFailedTraces()
      .then((data) => { setTraces(data); if (data.length > 0) setSelected(data[0]); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const products = ["All", "Customer Service", "Healthcare"];
  const filtered = filter === "All" ? traces : traces.filter(t => t.product === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f3f4f6", fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "#111827", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#ffffff", fontSize: 14 }}>⬡</span>
          </div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Trace Intel</span>
            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>Making AI behavior readable</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>J</span>
          </div>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Jason</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>AI Investigator</span>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1 }}>

        {/* Sidebar */}
        <div style={{ width: 300, background: "#ffffff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#111827" }}>Failed evaluations</h2>
            <div style={{ display: "flex", gap: 6 }}>
              {products.map(p => (
                <button key={p} onClick={() => setFilter(p)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid " + (filter === p ? "#111827" : "#e5e7eb"),
                    background: filter === p ? "#111827" : "#ffffff", color: filter === p ? "#ffffff" : "#6b7280",
                    cursor: "pointer", fontWeight: 500 }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {loading && <div style={{ padding: 20, color: "#6b7280", fontSize: 14 }}>Loading traces...</div>}
          {error && <div style={{ padding: 20, color: "#dc2626", fontSize: 14 }}>Error: {error}</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 20, color: "#6b7280", fontSize: 14 }}>No traces found.</div>}

          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.map((trace) => (
              <div key={trace.id} onClick={() => setSelected(trace)}
                style={{ padding: "14px 20px", cursor: "pointer", borderBottom: "1px solid #f3f4f6",
                  background: selected?.id === trace.id ? "#f8faff" : "#ffffff",
                  borderLeft: selected?.id === trace.id ? "3px solid #2563eb" : "3px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{trace.name}</span>
                  <ConfidenceBadge level={trace.confidenceLevel} score={trace.confidenceScore} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <ProductTag product={trace.product} />
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{trace.failureType}</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>{new Date(trace.timestamp).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!selected ? (
            <div style={{ padding: 40, color: "#6b7280", fontSize: 14 }}>Select a trace to investigate</div>
          ) : (
            <div style={{ padding: 32, maxWidth: 800 }}>

              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <ProductTag product={selected.product} />
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>→</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{selected.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111827" }}>{selected.failureType}</h1>
                  <ConfidenceBadge level={selected.confidenceLevel} score={selected.confidenceScore} />
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  Investigated by Jason · {new Date(selected.timestamp).toLocaleString()} · Trace ID: {selected.id.slice(0, 16)}...
                </p>
              </div>

              {/* Trace timeline */}
              <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#374151", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>Trace timeline</p>
                {selected.spans.map((span, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: span.status === "error" ? "#dc2626" : span.status === "warning" ? "#d97706" : "#16a34a" }} />
                    <span style={{ fontSize: 13, color: span.status === "error" ? "#111827" : "#6b7280",
                      fontWeight: span.status === "error" ? 600 : 400, flex: 1 }}>{span.name}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>{span.latency}ms</span>
                    <span style={{ fontSize: 11, fontWeight: 600,
                      color: span.status === "error" ? "#dc2626" : span.status === "warning" ? "#d97706" : "#16a34a" }}>
                      {span.status === "error" ? "FAILED" : span.status === "warning" ? "WARNING" : "OK"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Intelligence components */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <RootCauseCard
                  failureType={selected.failureType}
                  explanation={selected.explanation}
                  confidence={selected.confidenceScore}
                />
                <EvidencePanel evidence={selected.evidence} />
                <ActionList
                  actions={selected.suggestedActions}
                  onAction={(a) => {
                    if (a.includes("Priya")) {
                      alert("Sending to Priya (Call Supervisor) in Retell Supervise...\n\nTrace: " + selected.name + "\nFailure: " + selected.failureType + "\nConfidence: " + (selected.confidenceScore * 100).toFixed(0) + "%");
                    } else {
                      alert("Action triggered: " + a);
                    }
                  }}
                />
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
