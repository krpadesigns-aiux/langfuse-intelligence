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
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  traceStatus: "NEW" | "IN REVIEW" | "SENT TO PRIYA";
  evidence: string[];
  suggestedActions: string[];
  spans: LangfuseSpan[];
  product: string;
  estimatedImpact: { resolutionTime: string; affectedCalls: string; confidenceBoost: string };
  whyActions: string;
}

const SCENARIOS: Record<string, Partial<LangfuseTrace>> = {
  "intent-detection-v2": {
    product: "CUSTOMER SERVICE", severity: "CRITICAL", traceStatus: "NEW",
    failureType: "Intent misclassification",
    explanation: "The agent classified 'billing dispute' as 'general inquiry' on 6 consecutive calls. Customers were routed to the wrong department, increasing average handle time by 4 minutes.",
    evidence: ["6 consecutive misclassifications detected", "Confidence score dropped from 71% → 28% over 3 days", "Wrong department routing confirmed in call logs", "Average handle time increased by 4 minutes", "3 customer escalations linked to this failure"],
    suggestedActions: ["Adjust similarity threshold", "Expand retrieval top-k", "Retrain intent classifier", "Send to Call Supervisor (Priya) →", "Review similar failures"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Speech to text", status: "success", latency: 340 }, { name: "Intent detection", status: "error", latency: 210 }, { name: "Department routing", status: "error", latency: 45 }, { name: "Agent handoff", status: "warning", latency: 820 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~15 min", affectedCalls: "6 today", confidenceBoost: "+43%" },
    whyActions: "Based on the confidence drop pattern and routing failures, adjusting the similarity threshold has a 78% success rate for similar issues in customer service models.",
  },
  "sentiment-analysis": {
    product: "CUSTOMER SERVICE", severity: "HIGH", traceStatus: "IN REVIEW",
    failureType: "Sentiment detection failure",
    explanation: "The sentiment model failed to detect high customer frustration during 4 calls. Escalation was not triggered automatically, resulting in calls ending without resolution.",
    evidence: ["4 calls with undetected frustration", "Confidence score: 31% (threshold: 70%)", "Escalation not triggered on any affected calls", "Post-call survey scores averaged 1.8/5", "2 customers churned within 48 hours"],
    suggestedActions: ["Retrain sentiment model", "Lower frustration threshold", "Add keyword fallback rules", "Send to Call Supervisor (Priya) →", "Review similar failures"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Speech to text", status: "success", latency: 340 }, { name: "Sentiment analysis", status: "error", latency: 180 }, { name: "Escalation check", status: "error", latency: 90 }, { name: "Resolution attempt", status: "warning", latency: 1200 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~30 min", affectedCalls: "4 today", confidenceBoost: "+28%" },
    whyActions: "Sentiment models degrade when customer vocabulary shifts. Retraining on recent call data has shown 65% improvement in similar cases.",
  },
  "appointment-scheduler": {
    product: "HEALTHCARE", severity: "CRITICAL", traceStatus: "IN REVIEW",
    failureType: "Scheduling conflict error",
    explanation: "The appointment scheduler double-booked 3 patient slots due to a failure in availability checking. Patients arrived to find their appointments conflicted with existing bookings.",
    evidence: ["3 double-bookings confirmed", "Confidence score: 19% (threshold: 70%)", "Availability check returned stale cache data", "2 patients rescheduled same-day", "1 patient did not reschedule — potential churn"],
    suggestedActions: ["Invalidate availability cache", "Add real-time slot locking", "Retrain scheduler model", "Send to Call Supervisor (Priya) →", "Audit recent bookings"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Patient identification", status: "success", latency: 420 }, { name: "Availability check", status: "error", latency: 310 }, { name: "Slot booking", status: "error", latency: 180 }, { name: "Confirmation", status: "warning", latency: 95 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~45 min", affectedCalls: "3 today", confidenceBoost: "+51%" },
    whyActions: "Cache invalidation resolves 89% of double-booking issues. Immediate action recommended given clinical compliance risk.",
  },
  "call-summary-generator": {
    product: "CUSTOMER SERVICE", severity: "MEDIUM", traceStatus: "NEW",
    failureType: "Incomplete summary output",
    explanation: "The call summary generator produced truncated outputs for 8 calls, missing key action items. Support agents had no record of promised callbacks or follow-up actions.",
    evidence: ["8 truncated summaries in past 24 hours", "Confidence score: 54% (threshold: 70%)", "Average summary length dropped from 180 → 42 words", "4 promised callbacks not logged", "Token limit exceeded in generation step"],
    suggestedActions: ["Increase max_tokens limit", "Add summary validation step", "Compress prompt context", "Send to Call Supervisor (Priya) →", "Review affected call records"],
    spans: [{ name: "Call received", status: "success", latency: 8 }, { name: "Transcript generation", status: "success", latency: 890 }, { name: "Key point extraction", status: "warning", latency: 340 }, { name: "Summary generation", status: "error", latency: 620 }, { name: "CRM logging", status: "error", latency: 180 }, { name: "Evaluation", status: "error", latency: 140 }],
    estimatedImpact: { resolutionTime: "~10 min", affectedCalls: "8 today", confidenceBoost: "+19%" },
    whyActions: "Token limit increases resolve truncation in 94% of cases. Low risk change with immediate impact.",
  },
  "escalation-detector": {
    product: "HEALTHCARE", severity: "CRITICAL", traceStatus: "NEW",
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
  const res = await fetch(host + "/api/public/traces?limit=20", { headers: { Authorization: "Basic " + credentials } });
  if (!res.ok) throw new Error("Langfuse API error: " + res.status);
  const data = await res.json();
  return (data.data || []).map((t: any): LangfuseTrace => {
    const scores = t.scores || [];
    const avg = scores.length > 0 ? scores.reduce((s: number, x: any) => s + x.value, 0) / scores.length : Math.random() * 0.6;
    const score = Math.min(avg, 1);
    const s = SCENARIOS[t.name] || {};
    return {
      id: t.id, name: t.name || "Unnamed trace", timestamp: t.timestamp,
      failureType: s.failureType || "Evaluation failure",
      explanation: s.explanation || `Confidence score: ${(score * 100).toFixed(0)}%. Flagged by evaluation pipeline.`,
      confidenceScore: score,
      confidenceLevel: score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low",
      severity: s.severity || "MEDIUM",
      traceStatus: s.traceStatus || "NEW",
      evidence: s.evidence || [`Trace ID: ${t.id.slice(0, 16)}`, "Score below threshold", "Flagged for review"],
      suggestedActions: s.suggestedActions || ["Review trace manually", "Re-run evaluation", "Escalate to team", "Send to Call Supervisor (Priya) →"],
      spans: s.spans || [{ name: "Processing", status: "success", latency: 120 }, { name: "Evaluation", status: "error", latency: 140 }],
      product: s.product || "GENERAL",
      estimatedImpact: s.estimatedImpact || { resolutionTime: "~20 min", affectedCalls: "Unknown", confidenceBoost: "+25%" },
      whyActions: s.whyActions || "Based on the failure pattern, these actions have the highest success rate for similar traces.",
    };
  });
}

// Design tokens from Figma
const blue = "#1d4ed8";
const blueBg = "#eff2fe";
const dark = "#111827";
const gray50 = "#f9fafb";
const gray100 = "#f1f2f4";
const gray200 = "#e5eaed";
const gray500 = "#6b7280";
const gray700 = "#374151";
const white = "#ffffff";
const pageBg = "#f3f4f5";
const red = "#dc2626";
const redBg = "#ffefef";
const redBorder = "#fca5a5";
const orange = "#d95400";
const orangeBg = "#fff5ef";
const orangeBorder = "#fcc7a5";
const amber = "#854d0e";
const amberBg = "#fffce0";
const amberBorder = "#fde047";
const green = "#16803d";

const sevStyle: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: redBg, border: redBorder, text: red },
  HIGH: { bg: orangeBg, border: orangeBorder, text: orange },
  MEDIUM: { bg: amberBg, border: amberBorder, text: amber },
};

function SevBadge({ sev }: { sev: string }) {
  const s = sevStyle[sev] || sevStyle.MEDIUM;
  return <span style={{ fontSize: 8, fontWeight: 700, background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 4, padding: "2px 5px", whiteSpace: "nowrap" }}>{sev}</span>;
}

function GrayBadge({ label, small }: { label: string; small?: boolean }) {
  return <span style={{ fontSize: small ? 8 : 9, fontWeight: 500, background: gray100, color: gray700, border: `1px solid ${gray200}`, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>{label}</span>;
}

function ProductTag({ product }: { product: string }) {
  const isCS = product === "CUSTOMER SERVICE";
  return <span style={{ fontSize: 7, fontWeight: 500, background: isCS ? blueBg : gray100, color: isCS ? blue : gray700, border: `1px solid ${isCS ? blue : gray200}`, borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{product}</span>;
}

const NAV_ITEMS = [
  { icon: "📊", label: "Traces", active: true },
  { icon: "✓", label: "Evals", active: false },
  { icon: "💬", label: "Prompts", active: false },
  { icon: "📈", label: "Analytics", active: false },
  { icon: "⚙", label: "Settings", active: false },
];

export default function App() {
  const [traces, setTraces] = useState<LangfuseTrace[]>([]);
  const [selected, setSelected] = useState<LangfuseTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [chatVal, setChatVal] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1100);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetchTraces()
      .then(data => { setTraces(data); if (data.length > 0) setSelected(data[0]); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const critCount = traces.filter(t => t.severity === "CRITICAL").length;
  const avgConf = traces.length > 0 ? Math.round(traces.reduce((s, t) => s + t.confidenceScore * 100, 0) / traces.length) : 0;

  const showNav = !isMobile && !isTablet;
  const navW = showNav ? 52 : 0;
  const sidebarW = isMobile ? 0 : 220;
  const rightW = isMobile || isTablet ? 0 : 296;
  const showSidebar = !isMobile || mobileView === "list";
  const showDetail = !isMobile || mobileView === "detail";

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", minHeight: "100vh", background: pageBg, display: "flex", flexDirection: "column" }}>

      {/* ── Header (full width) ── */}
      <div style={{ height: 52, background: white, borderBottom: `1px solid ${gray200}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0, position: "sticky", top: 0, zIndex: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: dark, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: white, fontSize: 14, lineHeight: 1 }}>⬡</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: dark }}>Trace Intel</span>
          {!isMobile && <span style={{ fontSize: 11, color: "#9ba3af" }}>Making AI behavior readable</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: blueBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: blue }}>J</span>
          </div>
          {!isMobile && <span style={{ fontSize: 11, color: gray500 }}>Jason · AI Investigator</span>}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "calc(100vh - 52px)" }}>

        {/* Left nav */}
        {showNav && (
          <div style={{ width: navW, background: white, borderRight: `1px solid ${gray200}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, flexShrink: 0, overflowY: "auto" }}>
            {NAV_ITEMS.map(item => (
              <div key={item.label} style={{ width: 40, height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, marginBottom: 2, background: item.active ? blueBg : "transparent", cursor: "pointer" }}>
                <span style={{ fontSize: 14, lineHeight: 1, marginBottom: 3 }}>{item.icon}</span>
                <span style={{ fontSize: 8, fontWeight: item.active ? 700 : 400, color: item.active ? blue : gray500 }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sidebar */}
        {showSidebar && (
          <div style={{ width: isMobile ? "100%" : sidebarW, background: white, borderRight: `1px solid ${gray200}`, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>

            {/* Summary strip */}
            <div style={{ background: gray50, borderBottom: `1px solid ${gray200}`, padding: "14px 16px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: dark, lineHeight: 1 }}>{traces.length}</span>
                <span style={{ fontSize: 11, color: gray500 }}>failures today</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: red, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: red }}>{critCount} critical · avg {avgConf}% ↓</span>
              </div>
            </div>

            {/* Section header */}
            <div style={{ padding: "10px 16px 6px" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: gray500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Failed Evaluations</span>
            </div>

            {loading && <p style={{ padding: "12px 16px", fontSize: 12, color: gray500 }}>Loading traces...</p>}
            {error && <p style={{ padding: "12px 16px", fontSize: 12, color: red }}>Error: {error}</p>}

            {/* Trace rows */}
            {traces.map(trace => {
              const isSelected = selected?.id === trace.id;
              const sc = sevStyle[trace.severity];
              return (
                <div key={trace.id} onClick={() => { setSelected(trace); setEvidenceOpen(true); setMobileView("detail"); }}
                  style={{ padding: "10px 12px 10px 0", borderBottom: `1px solid ${pageBg}`, background: isSelected ? blueBg : white, borderLeft: `3px solid ${isSelected ? blue : sc.text}`, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ paddingLeft: 10 }}>
                    {/* Row 1: name + status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{trace.name}</span>
                      <GrayBadge label={trace.traceStatus} small />
                    </div>
                    {/* Row 2: severity + confidence */}
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                      <SevBadge sev={trace.severity} />
                      <GrayBadge label="LOW CONF." small />
                    </div>
                    {/* Row 3: product tag */}
                    <div style={{ marginBottom: 4 }}>
                      <ProductTag product={trace.product} />
                    </div>
                    {/* Row 4: failure type */}
                    <span style={{ fontSize: 9, color: gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{trace.failureType}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Main content area */}
        {showDetail && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

            {!selected ? (
              <div style={{ padding: 32, color: gray500, fontSize: 14 }}>Select a trace to investigate</div>
            ) : (
              <>
                {/* Title bar — spans main + right */}
                <div style={{ background: white, borderBottom: `1px solid ${gray200}`, padding: "12px 24px", flexShrink: 0 }}>
                  {/* Breadcrumb */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, background: blueBg, color: blue, border: `1px solid ${blue}`, borderRadius: 4, padding: "2px 6px" }}>{selected.product}</span>
                    <span style={{ fontSize: 10, color: gray500 }}>→  {selected.name}</span>
                  </div>
                  {/* Title row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: dark }}>{selected.failureType}</span>
                      <SevBadge sev={selected.severity} />
                      <GrayBadge label={`LOW · ${(selected.confidenceScore * 100).toFixed(0)}%`} />
                      <GrayBadge label={selected.traceStatus} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {isMobile && (
                        <button onClick={() => setMobileView("list")} style={{ padding: "7px 12px", background: gray100, border: `1px solid ${gray200}`, borderRadius: 8, fontSize: 11, cursor: "pointer", color: gray700 }}>← Back</button>
                      )}
                      <button style={{ padding: "8px 16px", background: blue, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, color: white, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                        ↺ Rerun Evaluation
                      </button>
                      <button style={{ padding: "8px 14px", background: white, border: `1px solid ${gray200}`, borderRadius: 8, fontSize: 11, color: gray700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ⚠ Quarantine
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main + Right panel */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                  {/* Main panel */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", minWidth: 0 }}>
                    <p style={{ fontSize: 10, color: gray500, margin: "0 0 20px" }}>
                      Investigated by Jason · {new Date(selected.timestamp).toLocaleString()} · Trace ID: {selected.id.slice(0, 16)}...
                    </p>

                    {/* Timeline */}
                    <div style={{ background: white, border: `1px solid ${gray200}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: gray700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>Trace Timeline</p>
                      {selected.spans.map((span, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: span.status === "error" ? red : span.status === "warning" ? "#d97706" : "#16a34a" }} />
                          <span style={{ fontSize: 11, flex: 1, fontWeight: span.status === "error" ? 700 : 400, color: span.status === "error" ? dark : gray500, minWidth: 0 }}>{span.name}</span>
                          <span style={{ fontSize: 9, color: gray500, background: pageBg, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{span.latency}ms</span>
                          <span style={{ fontSize: 9, fontWeight: 700, flexShrink: 0, minWidth: 44, textAlign: "right", color: span.status === "error" ? red : span.status === "warning" ? "#d97706" : "#16a34a" }}>
                            {span.status === "error" ? "FAILED" : span.status === "warning" ? "WARNING" : "OK"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Root cause */}
                    <div style={{ background: "#fff9f9", border: `1px solid ${redBorder}`, borderLeft: `4px solid ${red}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: red }}>⚠</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: gray500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Root Cause Detected</span>
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: dark, margin: "0 0 10px" }}>{selected.failureType}</p>
                      <p style={{ fontSize: 12, color: gray700, lineHeight: 1.7, margin: 0 }}>{selected.explanation}</p>
                    </div>

                    {/* Evidence */}
                    <div style={{ background: white, border: `1px solid ${gray200}`, borderRadius: 12, overflow: "hidden" }}>
                      <button onClick={() => setEvidenceOpen(!evidenceOpen)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: gray50, border: "none", borderBottom: evidenceOpen ? `1px solid ${gray200}` : "none", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: gray700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Evidence</span>
                          <span style={{ fontSize: 9, fontWeight: 700, background: gray200, color: gray500, borderRadius: 10, padding: "1px 6px" }}>{selected.evidence.length}</span>
                        </div>
                        <span style={{ fontSize: 9, color: gray500 }}>{evidenceOpen ? "▲ Hide" : "▼ Show"}</span>
                      </button>
                      {evidenceOpen && (
                        <div style={{ padding: "12px 16px" }}>
                          {selected.evidence.map((item, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                              <div style={{ width: 4, height: 4, borderRadius: "50%", background: gray500, marginTop: 6, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: gray700, lineHeight: 1.5 }}>{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right panel */}
                  {!isMobile && !isTablet && (
                    <div style={{ width: rightW, background: gray50, borderLeft: `1px solid ${gray200}`, overflowY: "auto", flexShrink: 0, padding: "16px 16px" }}>

                      {/* Suggested actions */}
                      <p style={{ fontSize: 9, fontWeight: 700, color: gray500, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 12px" }}>Suggested Actions</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                        {selected.suggestedActions.map((action, i) => {
                          const isPriya = action.includes("Priya");
                          const isPrimary = i === 0;
                          return (
                            <button key={i}
                              onClick={() => isPriya && alert(`Sending to Priya (Call Supervisor)...\n\nTrace: ${selected.name}\nFailure: ${selected.failureType}\nConfidence: ${(selected.confidenceScore * 100).toFixed(0)}%`)}
                              style={{ width: "100%", padding: isPrimary ? "10px 14px" : "8px 14px", background: isPrimary ? blue : isPriya ? blueBg : white, color: isPrimary ? white : isPriya ? blue : gray700, border: `1px solid ${isPrimary ? blue : isPriya ? blue : gray200}`, borderRadius: 8, fontSize: 11, fontWeight: isPrimary || isPriya ? 700 : 400, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}>
                              {action}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ height: 1, background: gray200, margin: "0 0 16px" }} />

                      {/* Why these actions */}
                      <div style={{ background: "#fffcef", border: `1px solid ${amberBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 12 }}>💡</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: dark }}>Why these actions?</span>
                        </div>
                        <p style={{ fontSize: 10, color: gray700, lineHeight: 1.6, margin: 0 }}>{selected.whyActions}</p>
                      </div>

                      <div style={{ height: 1, background: gray200, margin: "0 0 16px" }} />

                      {/* Estimated impact */}
                      <p style={{ fontSize: 9, fontWeight: 700, color: gray500, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Estimated Impact</p>
                      {[
                        { label: "Resolution time", value: selected.estimatedImpact.resolutionTime, green: false },
                        { label: "Affected calls", value: selected.estimatedImpact.affectedCalls, green: false },
                        { label: "Confidence boost", value: selected.estimatedImpact.confidenceBoost, green: true },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 11, color: gray500 }}>{item.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: item.green ? green : dark }}>{item.value}</span>
                        </div>
                      ))}

                      {/* Confidence progress bar */}
                      <div style={{ height: 4, background: gray200, borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(selected.confidenceScore * 100).toFixed(0)}%`, background: selected.confidenceScore < 0.4 ? red : selected.confidenceScore < 0.7 ? "#d97706" : green, borderRadius: 2, transition: "width 0.4s" }} />
                      </div>

                      {/* Quick stats */}
                      <div style={{ background: white, border: `1px solid ${gray200}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 10, color: gray500 }}>Confidence</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: selected.confidenceScore < 0.4 ? red : dark }}>{(selected.confidenceScore * 100).toFixed(0)}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: gray500 }}>Evidence items</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: dark }}>{selected.evidence.length}</span>
                        </div>
                      </div>

                      <div style={{ height: 1, background: gray200, margin: "0 0 16px" }} />

                      {/* Ask about this failure */}
                      <div style={{ background: blueBg, border: `1px solid ${blue}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, color: blue }}>◎</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: dark }}>Ask about this failure</span>
                        </div>
                        <p style={{ fontSize: 10, color: gray500, margin: 0 }}>Chat with Claude about this trace</p>
                      </div>

                      {/* Chat input */}
                      <div style={{ background: white, border: `1px solid ${gray200}`, borderRadius: 20, display: "flex", alignItems: "center", padding: "3px 3px 3px 14px", gap: 6 }}>
                        <input value={chatVal} onChange={e => setChatVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && chatVal.trim()) { alert("Claude: Analyzing \"" + chatVal + "\" for trace: " + selected.name); setChatVal(""); } }}
                          placeholder="Why is intent detection failing?"
                          style={{ flex: 1, border: "none", outline: "none", fontSize: 11, color: dark, background: "transparent", minWidth: 0 }} />
                        <button onClick={() => { if (chatVal.trim()) { alert("Claude: Analyzing \"" + chatVal + "\" for trace: " + selected.name); setChatVal(""); } }}
                          style={{ width: 30, height: 30, borderRadius: 15, background: blue, border: "none", color: white, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          ↑
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
