import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────
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
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  status: "NEW" | "IN REVIEW" | "SENT TO PRIYA";
  evidence: string[];
  suggestedActions: string[];
  spans: LangfuseSpan[];
  product: string;
  estimatedImpact: { resolutionTime: string; affectedCalls: string; confidenceBoost: string };
  whyActions: string;
}

// ── Scenarios ──────────────────────────────────────────────────────
const SCENARIOS: Record<string, Partial<LangfuseTrace>> = {
  "intent-detection-v2": {
    product: "CUSTOMER SERVICE", severity: "CRITICAL", status: "NEW",
    failureType: "Intent misclassification",
    explanation: "The agent classified 'billing dispute' as 'general inquiry' on 6 consecutive calls. Customers were routed to the wrong department, increasing average handle time by 4 minutes.",
    evidence: ["6 consecutive misclassifications detected", "Confidence score dropped from 71% → 28% over 3 days", "Wrong department routing confirmed in call logs", "Average handle time increased by 4 minutes", "3 customer escalations linked to this failure"],
    suggestedActions: ["Adjust similarity threshold", "Expand retrieval top-k", "Retrain intent classifier", "Send to Call Supervisor (Priya) →", "Review similar failures"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Speech to text", status: "success", latency: 340 }, { name: "Intent detection", status: "error", latency: 210 }, { name: "Department routing", status: "error", latency: 45 }, { name: "Agent handoff", status: "warning", latency: 820 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~15 min", affectedCalls: "6 today", confidenceBoost: "+43%" },
    whyActions: "Based on the confidence drop pattern and routing failures, adjusting the similarity threshold has a 78% success rate for similar issues in customer service models.",
  },
  "sentiment-analysis": {
    product: "CUSTOMER SERVICE", severity: "HIGH", status: "IN REVIEW",
    failureType: "Sentiment detection failure",
    explanation: "The sentiment model failed to detect high customer frustration during 4 calls. Escalation was not triggered automatically, resulting in calls ending without resolution.",
    evidence: ["4 calls with undetected frustration", "Confidence score: 31% (threshold: 70%)", "Escalation not triggered on any affected calls", "Post-call survey scores averaged 1.8/5", "2 customers churned within 48 hours"],
    suggestedActions: ["Retrain sentiment model", "Lower frustration threshold", "Add keyword fallback rules", "Send to Call Supervisor (Priya) →", "Review similar failures"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Speech to text", status: "success", latency: 340 }, { name: "Sentiment analysis", status: "error", latency: 180 }, { name: "Escalation check", status: "error", latency: 90 }, { name: "Resolution attempt", status: "warning", latency: 1200 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~30 min", affectedCalls: "4 today", confidenceBoost: "+28%" },
    whyActions: "Sentiment models degrade when customer vocabulary shifts. Retraining on recent call data has shown 65% improvement in similar cases.",
  },
  "appointment-scheduler": {
    product: "HEALTHCARE", severity: "CRITICAL", status: "IN REVIEW",
    failureType: "Scheduling conflict error",
    explanation: "The appointment scheduler double-booked 3 patient slots due to a failure in availability checking. Patients arrived to find their appointments conflicted with existing bookings.",
    evidence: ["3 double-bookings confirmed", "Confidence score: 19% (threshold: 70%)", "Availability check returned stale cache data", "2 patients rescheduled same-day", "1 patient did not reschedule — potential churn"],
    suggestedActions: ["Invalidate availability cache", "Add real-time slot locking", "Retrain scheduler model", "Send to Call Supervisor (Priya) →", "Audit recent bookings"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Patient identification", status: "success", latency: 420 }, { name: "Availability check", status: "error", latency: 310 }, { name: "Slot booking", status: "error", latency: 180 }, { name: "Confirmation", status: "warning", latency: 95 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~45 min", affectedCalls: "3 today", confidenceBoost: "+51%" },
    whyActions: "Cache invalidation resolves 89% of double-booking issues. Immediate action recommended given clinical compliance risk.",
  },
  "call-summary-generator": {
    product: "CUSTOMER SERVICE", severity: "MEDIUM", status: "NEW",
    failureType: "Incomplete summary output",
    explanation: "The call summary generator produced truncated outputs for 8 calls, missing key action items. Support agents had no record of promised callbacks or follow-up actions.",
    evidence: ["8 truncated summaries in past 24 hours", "Confidence score: 54% (threshold: 70%)", "Average summary length dropped from 180 → 42 words", "4 promised callbacks not logged", "Token limit exceeded in generation step"],
    suggestedActions: ["Increase max_tokens limit", "Add summary validation step", "Compress prompt context", "Send to Call Supervisor (Priya) →", "Review affected call records"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Transcript generation", status: "success", latency: 890 }, { name: "Key point extraction", status: "warning", latency: 340 }, { name: "Summary generation", status: "error", latency: 620 }, { name: "CRM logging", status: "error", latency: 180 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~10 min", affectedCalls: "8 today", confidenceBoost: "+19%" },
    whyActions: "Token limit increases resolve truncation in 94% of cases. Low risk change with immediate impact.",
  },
  "escalation-detector": {
    product: "HEALTHCARE", severity: "CRITICAL", status: "NEW",
    failureType: "Missed escalation signal",
    explanation: "The escalation detector failed to identify 2 calls requiring immediate clinical attention. Patients with urgent symptoms were not connected to a nurse or physician.",
    evidence: ["2 missed escalations with urgent symptoms", "Confidence score: 22% (threshold: 70%)", "Keywords 'chest pain' and 'difficulty breathing' not flagged", "Both patients called back within 30 minutes", "Clinical risk review flagged by compliance team"],
    suggestedActions: ["Add keyword override rules", "Lower escalation threshold", "Retrain on clinical vocabulary", "Send to Call Supervisor (Priya) →", "File compliance report"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Speech to text", status: "success", latency: 340 }, { name: "Symptom extraction", status: "warning", latency: 290 }, { name: "Escalation detection", status: "error", latency: 180 }, { name: "Routing decision", status: "error", latency: 65 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~20 min", affectedCalls: "2 today", confidenceBoost: "+48%" },
    whyActions: "Keyword override rules provide immediate protection while model retraining is in progress. Critical compliance risk requires urgent action.",
  },
};

async function fetchTraces(): Promise<LangfuseTrace[]> {
  const publicKey = "pk-lf-d05e60cb-f349-4d23-93b3-649bb0b9468e";
  const secretKey = "sk-lf-7d64433c-6df0-4b56-b95e-2dd654b32c15";
  const host = "https://us.cloud.langfuse.com";
  const credentials = btoa(publicKey + ":" + secretKey);
  const res = await fetch(host + "/api/public/traces?limit=20", {
    headers: { Authorization: "Basic " + credentials },
  });
  if (!res.ok) throw new Error("Langfuse API error: " + res.status);
  const data = await res.json();
  const traces = data.data || [];
  return traces.map((t: any): LangfuseTrace => {
    const scores = t.scores || [];
    const avg = scores.length > 0 ? scores.reduce((s: number, x: any) => s + x.value, 0) / scores.length : Math.random() * 0.6;
    const score = Math.min(avg, 1);
    const level = score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
    const s = SCENARIOS[t.name] || {};
    return {
      id: t.id, name: t.name || "Unnamed trace", timestamp: t.timestamp,
      failureType: s.failureType || "Evaluation failure",
      explanation: s.explanation || "Confidence score: " + (score * 100).toFixed(0) + "%. Flagged by evaluation pipeline.",
      confidenceScore: score, confidenceLevel: level as "high" | "medium" | "low",
      severity: s.severity || "MEDIUM",
      status: s.status || "NEW",
      evidence: s.evidence || ["Trace ID: " + t.id.slice(0, 16), "Score below threshold", "Flagged for review"],
      suggestedActions: s.suggestedActions || ["Review trace manually", "Re-run evaluation", "Escalate to team", "Send to Call Supervisor (Priya) →"],
      spans: s.spans || [{ name: "Processing", status: "success", latency: 120 }, { name: "Evaluation", status: "error", latency: 140 }],
      product: s.product || "GENERAL",
      estimatedImpact: s.estimatedImpact || { resolutionTime: "~20 min", affectedCalls: "Unknown", confidenceBoost: "+25%" },
      whyActions: s.whyActions || "Based on the failure pattern, these actions have the highest success rate for similar traces.",
    };
  });
}

// ── Design tokens from Figma ───────────────────────────────────────
const C = {
  bg: "#f3f4f5", white: "#ffffff", dark: "#111827",
  blue: "#1d4ed8", blueBg: "#eff2fe", blueBorder: "#1d4ed8",
  gray50: "#f9fafb", gray100: "#f1f2f4", gray200: "#e5eaed",
  gray500: "#6b7280", gray700: "#374151",
  red: "#dc2626", redBg: "#ffefef", redBorder: "#fca5a5",
  orange: "#d95400", orangeBg: "#fff5ef", orangeBorder: "#fcc7a5",
  amber: "#854d0e", amberBg: "#fffce0", amberBorder: "#fde047",
  green: "#16803d",
};

const sevConfig = {
  CRITICAL: { bg: C.redBg, border: C.redBorder, text: C.red },
  HIGH: { bg: C.orangeBg, border: C.orangeBorder, text: C.orange },
  MEDIUM: { bg: C.amberBg, border: C.amberBorder, text: C.amber },
};

// ── Components ────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: "CRITICAL" | "HIGH" | "MEDIUM" }) {
  const s = sevConfig[severity];
  return (
    <span style={{ fontSize: 9, fontWeight: 700, background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 4, padding: "3px 6px", whiteSpace: "nowrap" }}>
      {severity}
    </span>
  );
}

function NeutralBadge({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 500, background: C.gray100, color: C.gray700, border: `1px solid ${C.gray200}`, borderRadius: 4, padding: "3px 6px", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ProductTag({ product }: { product: string }) {
  const isCS = product === "CUSTOMER SERVICE";
  return (
    <span style={{ fontSize: 7, fontWeight: 500, background: isCS ? C.blueBg : C.gray100, color: isCS ? C.blue : C.gray700, border: `1px solid ${isCS ? C.blueBorder : C.gray200}`, borderRadius: 4, padding: "2px 4px", whiteSpace: "nowrap" }}>
      {product}
    </span>
  );
}

export default function App() {
  const [traces, setTraces] = useState<LangfuseTrace[]>([]);
  const [selected, setSelected] = useState<LangfuseTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  useEffect(() => {
    fetchTraces()
      .then((data) => { setTraces(data); if (data.length > 0) setSelected(data[0]); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const criticalCount = traces.filter(t => t.severity === "CRITICAL").length;
  const avgConf = traces.length > 0 ? Math.round(traces.reduce((s, t) => s + t.confidenceScore * 100, 0) / traces.length) : 0;

  const handleSelectTrace = (trace: LangfuseTrace) => {
    setSelected(trace);
    setMobileView("detail");
    setEvidenceExpanded(true);
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", minHeight: "100vh", background: C.bg }}>

      {/* ── Full width header ── */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 52, background: C.white, borderBottom: `1px solid ${C.gray200}`, display: "flex", alignItems: "center", padding: "0 16px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: C.dark, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: C.white, fontSize: 13 }}>⬡</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Trace Intel</span>
          <span style={{ fontSize: 11, color: "#9ba3af", display: "none" }} className="tagline">Making AI behavior readable</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 13, background: C.blueBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.blue }}>J</span>
          </div>
          <span style={{ fontSize: 11, color: C.gray500 }}>Jason · AI Investigator</span>
        </div>
      </div>

      <div style={{ paddingTop: 52, display: "flex", height: "100vh" }}>

        {/* ── Left nav — hidden on mobile ── */}
        <div style={{ width: 52, background: C.white, borderRight: `1px solid ${C.gray200}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, flexShrink: 0, position: "fixed", top: 52, bottom: 0, left: 0, zIndex: 90, overflowY: "auto" }}
          className="left-nav">
          {[["◈", "Traces", true], ["◉", "Evals", false], ["⊞", "Prompts", false], ["◎", "Analytics", false], ["◌", "Settings", false]].map(([icon, label, active]) => (
            <div key={label as string} style={{ width: 40, height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, marginBottom: 4, background: active ? C.blueBg : "transparent", cursor: "pointer" }}>
              <span style={{ fontSize: 16, color: active ? C.blue : C.gray500, lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: 8, fontWeight: active ? 700 : 400, color: active ? C.blue : C.gray500, marginTop: 4 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Sidebar — hidden on mobile when viewing detail ── */}
        <div style={{ width: 220, background: C.white, borderRight: `1px solid ${C.gray200}`, position: "fixed", top: 52, bottom: 0, left: 52, zIndex: 80, overflowY: "auto", display: mobileView === "detail" ? "none" : "block" }}
          className="sidebar">

          {/* Summary strip */}
          <div style={{ background: C.gray50, borderBottom: `1px solid ${C.gray200}`, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: C.dark }}>{traces.length}</span>
              <span style={{ fontSize: 10, color: C.gray500 }}>failures today</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red }} />
              <span style={{ fontSize: 9, fontWeight: 500, color: C.red }}>{criticalCount} critical  ·  avg {avgConf}% ↓</span>
            </div>
          </div>

          <div style={{ padding: "8px 16px 4px" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.gray500, letterSpacing: "0.05em" }}>FAILED EVALUATIONS</span>
          </div>

          {loading && <p style={{ padding: 16, fontSize: 12, color: C.gray500 }}>Loading...</p>}
          {error && <p style={{ padding: 16, fontSize: 12, color: C.red }}>Error: {error}</p>}

          {traces.map(trace => (
            <div key={trace.id} onClick={() => handleSelectTrace(trace)} style={{ padding: "10px 12px 10px 14px", borderBottom: `1px solid ${C.bg}`, background: selected?.id === trace.id ? C.blueBg : C.white, borderLeft: `3px solid ${selected?.id === trace.id ? C.blue : sevConfig[trace.severity].text}`, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.dark }}>{trace.name}</span>
                <NeutralBadge label={trace.status} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <SeverityBadge severity={trace.severity} />
                <NeutralBadge label="LOW CONF." />
              </div>
              <div style={{ marginBottom: 2 }}>
                <ProductTag product={trace.product} />
              </div>
              <span style={{ fontSize: 9, color: C.gray500 }}>{trace.failureType}</span>
            </div>
          ))}
        </div>

        {/* ── Content area ── */}
        <div style={{ marginLeft: 272, flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }} className="content-area">

          {!selected ? (
            <div style={{ padding: 32, color: C.gray500, fontSize: 14 }}>Select a trace to investigate</div>
          ) : (
            <>
              {/* ── Title bar ── */}
              <div style={{ background: C.white, borderBottom: `1px solid ${C.gray200}`, padding: "12px 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 500, background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}`, borderRadius: 4, padding: "2px 5px" }}>{selected.product}</span>
                    <span style={{ fontSize: 10, color: C.gray500 }}>→  {selected.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: C.dark }}>{selected.failureType}</span>
                    <SeverityBadge severity={selected.severity} />
                    <NeutralBadge label={`LOW · ${(selected.confidenceScore * 100).toFixed(0)}%`} />
                    <NeutralBadge label={selected.status} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {mobileView === "detail" && (
                    <button onClick={() => setMobileView("list")} style={{ padding: "8px 12px", background: C.gray100, border: `1px solid ${C.gray200}`, borderRadius: 8, fontSize: 11, cursor: "pointer", color: C.gray700 }}>
                      ← Back
                    </button>
                  )}
                  <button style={{ padding: "8px 16px", background: C.blue, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.white, cursor: "pointer", whiteSpace: "nowrap" }}>
                    ↺  Rerun Evaluation
                  </button>
                  <button style={{ padding: "8px 12px", background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8, fontSize: 11, fontWeight: 500, color: C.gray700, cursor: "pointer" }}>
                    ⚠  Quarantine
                  </button>
                </div>
              </div>

              {/* ── Main + Right panel ── */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

                {/* Main panel */}
                <div style={{ flex: 1, overflowY: "auto", padding: 24, minWidth: 0 }}>
                  <p style={{ fontSize: 10, color: C.gray500, marginBottom: 16 }}>
                    Investigated by Jason · {new Date(selected.timestamp).toLocaleString()} · Trace ID: {selected.id.slice(0, 16)}...
                  </p>

                  {/* Timeline */}
                  <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: C.gray700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 16px" }}>Trace Timeline</p>
                    {selected.spans.map((span, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: span.status === "error" ? C.red : span.status === "warning" ? "#d97706" : "#16a34a" }} />
                        <span style={{ fontSize: 11, flex: 1, fontWeight: span.status === "error" ? 700 : 400, color: span.status === "error" ? C.dark : C.gray500 }}>{span.name}</span>
                        <span style={{ fontSize: 9, color: C.gray500, background: C.bg, padding: "3px 6px", borderRadius: 4 }}>{span.latency}ms</span>
                        <span style={{ fontSize: 9, fontWeight: 700, minWidth: 40, color: span.status === "error" ? C.red : span.status === "warning" ? "#d97706" : "#16a34a" }}>
                          {span.status === "error" ? "FAILED" : span.status === "warning" ? "WARNING" : "OK"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Root cause */}
                  <div style={{ background: "#fff9f9", border: `1px solid ${C.redBorder}`, borderLeft: `4px solid ${C.red}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: C.red }}>⚠</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Root Cause Detected</span>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: C.dark, margin: "0 0 10px" }}>{selected.failureType}</p>
                    <p style={{ fontSize: 11, color: C.gray700, lineHeight: 1.7, margin: 0 }}>{selected.explanation}</p>
                  </div>

                  {/* Evidence */}
                  <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                    <button onClick={() => setEvidenceExpanded(!evidenceExpanded)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: C.gray50, border: "none", borderBottom: evidenceExpanded ? `1px solid ${C.gray200}` : "none", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: C.gray700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Evidence</span>
                        <span style={{ fontSize: 9, fontWeight: 700, background: C.gray200, color: C.gray500, borderRadius: 10, padding: "1px 6px" }}>{selected.evidence.length}</span>
                      </div>
                      <span style={{ fontSize: 9, color: C.gray500 }}>{evidenceExpanded ? "▲ Hide" : "▼ Show"}</span>
                    </button>
                    {evidenceExpanded && (
                      <div style={{ padding: "12px 16px" }}>
                        {selected.evidence.map((item, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                            <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.gray500, marginTop: 6, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: C.gray700, lineHeight: 1.5 }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right panel */}
                <div style={{ width: 296, background: C.gray50, borderLeft: `1px solid ${C.gray200}`, overflowY: "auto", flexShrink: 0, padding: 16 }} className="right-panel">

                  {/* Suggested actions */}
                  <p style={{ fontSize: 9, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 12px" }}>Suggested Actions</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {selected.suggestedActions.map((action, i) => {
                      const isPriya = action.includes("Priya");
                      const isPrimary = i === 0;
                      return (
                        <button key={i} onClick={() => isPriya && alert(`Sending to Priya...\n\nTrace: ${selected.name}\nFailure: ${selected.failureType}\nConfidence: ${(selected.confidenceScore * 100).toFixed(0)}%`)}
                          style={{ width: "100%", padding: isPrimary ? "10px 12px" : "7px 12px", background: isPrimary ? C.blue : isPriya ? C.blueBg : C.white, color: isPrimary ? C.white : isPriya ? C.blue : C.gray700, border: `1px solid ${isPrimary ? C.blue : isPriya ? C.blueBorder : C.gray200}`, borderRadius: 8, fontSize: 11, fontWeight: isPrimary || isPriya ? 700 : 400, cursor: "pointer", textAlign: "left" }}>
                          {action}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ height: 1, background: C.gray200, marginBottom: 16 }} />

                  {/* Why these actions */}
                  <div style={{ background: "#fffcef", border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11 }}>💡</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Why these actions?</span>
                    </div>
                    <p style={{ fontSize: 10, color: C.gray700, lineHeight: 1.6, margin: 0 }}>{selected.whyActions}</p>
                  </div>

                  <div style={{ height: 1, background: C.gray200, marginBottom: 16 }} />

                  {/* Estimated impact */}
                  <p style={{ fontSize: 9, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Estimated Impact</p>
                  {[
                    { label: "Resolution time", value: selected.estimatedImpact.resolutionTime, green: false },
                    { label: "Affected calls", value: selected.estimatedImpact.affectedCalls, green: false },
                    { label: "Confidence boost", value: selected.estimatedImpact.confidenceBoost, green: true },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: C.gray500 }}>{item.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: item.green ? C.green : C.dark }}>{item.value}</span>
                    </div>
                  ))}

                  {/* Confidence bar */}
                  <div style={{ height: 4, background: C.gray200, borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(selected.confidenceScore * 100).toFixed(0)}%`, background: C.red, borderRadius: 2 }} />
                  </div>

                  {/* Quick stats */}
                  <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: C.gray500 }}>Confidence</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{(selected.confidenceScore * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: C.gray500 }}>Evidence items</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{selected.evidence.length}</span>
                    </div>
                  </div>

                  <div style={{ height: 1, background: C.gray200, marginBottom: 16 }} />

                  {/* Ask about this failure */}
                  <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: C.blue }}>◎</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>Ask about this failure</span>
                    </div>
                    <p style={{ fontSize: 10, color: C.gray500, margin: 0 }}>Chat with Claude about this trace</p>
                  </div>

                  {/* Chat input */}
                  <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, display: "flex", alignItems: "center", padding: "4px 4px 4px 12px", gap: 8 }}>
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      placeholder="Why is intent detection failing?"
                      style={{ flex: 1, border: "none", outline: "none", fontSize: 11, color: C.dark, background: "transparent" }} />
                    <button onClick={() => { if (chatInput) { alert("Claude: " + chatInput); setChatInput(""); } }}
                      style={{ width: 28, height: 28, borderRadius: 14, background: C.blue, border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      ↑
                    </button>
                  </div>

                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 1024px) {
          .left-nav { display: none !important; }
          .content-area { margin-left: 220px !important; }
          .right-panel { display: none !important; }
          .tagline { display: inline !important; }
        }
        @media (max-width: 768px) {
          .left-nav { display: none !important; }
          .sidebar { left: 0 !important; width: 100% !important; }
          .content-area { margin-left: 0 !important; }
          .right-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
