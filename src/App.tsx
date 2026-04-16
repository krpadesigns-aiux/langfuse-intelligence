import { useEffect, useState, useRef } from "react";

interface Span { name: string; status: "success"|"error"|"warning"; latency: number; }
interface Trace {
  id: string; name: string; timestamp: string;
  failureType: string; explanation: string; confidenceScore: number;
  severity: "CRITICAL"|"HIGH"|"MEDIUM"; traceStatus: "NEW"|"IN REVIEW"|"SENT TO TEAM";
  evidence: string[]; suggestedActions: string[]; spans: Span[]; product: string;
  impact: { time: string; calls: string; boost: string }; whyActions: string;
}

const SCENARIOS: Record<string, Partial<Trace>> = {
  "intent-detection-v2": {
    product:"CUSTOMER SERVICE", severity:"CRITICAL", traceStatus:"NEW",
    failureType:"Intent misclassification",
    explanation:"The agent classified 'billing dispute' as 'general inquiry' on 6 consecutive calls. Customers were routed to the wrong department, increasing average handle time by 4 minutes.",
    evidence:["6 consecutive misclassifications detected","Confidence score dropped from 71% → 28% over 3 days","Wrong department routing confirmed in call logs","Average handle time increased by 4 minutes","3 customer escalations linked to this failure"],
    suggestedActions:["Adjust similarity threshold","Expand retrieval top-k","Retrain intent classifier","Send to call supervisor","Review similar failures"],
    spans:[{name:"Call received",status:"success",latency:8},{name:"Speech to text",status:"success",latency:340},{name:"Intent detection",status:"error",latency:210},{name:"Department routing",status:"error",latency:45},{name:"Agent handoff",status:"warning",latency:820},{name:"Evaluation",status:"error",latency:140}],
    impact:{time:"~15 min",calls:"6 today",boost:"+43%"},
    whyActions:"Based on the confidence drop pattern and routing failures, adjusting the similarity threshold has a 78% success rate for similar issues in customer service models.",
  },
  "sentiment-analysis": {
    product:"CUSTOMER SERVICE", severity:"HIGH", traceStatus:"IN REVIEW",
    failureType:"Sentiment detection failure",
    explanation:"The sentiment model failed to detect high customer frustration during 4 calls. Escalation was not triggered automatically, resulting in calls ending without resolution.",
    evidence:["4 calls with undetected frustration","Confidence score: 31% (threshold: 70%)","Escalation not triggered on any affected calls","Post-call survey scores averaged 1.8/5","2 customers churned within 48 hours"],
    suggestedActions:["Retrain sentiment model","Lower frustration threshold","Add keyword fallback rules","Send to call supervisor","Review similar failures"],
    spans:[{name:"Call received",status:"success",latency:8},{name:"Speech to text",status:"success",latency:340},{name:"Sentiment analysis",status:"error",latency:180},{name:"Escalation check",status:"error",latency:90},{name:"Resolution attempt",status:"warning",latency:1200},{name:"Evaluation",status:"error",latency:140}],
    impact:{time:"~30 min",calls:"4 today",boost:"+28%"},
    whyActions:"Sentiment models degrade when customer vocabulary shifts. Retraining on recent call data has shown 65% improvement in similar cases.",
  },
  "appointment-scheduler": {
    product:"HEALTHCARE", severity:"CRITICAL", traceStatus:"IN REVIEW",
    failureType:"Scheduling conflict error",
    explanation:"The appointment scheduler double-booked 3 patient slots due to a failure in availability checking. Patients arrived to find their appointments conflicted with existing bookings.",
    evidence:["3 double-bookings confirmed","Confidence score: 19% (threshold: 70%)","Availability check returned stale cache data","2 patients rescheduled same-day","1 patient did not reschedule — potential churn"],
    suggestedActions:["Invalidate availability cache","Add real-time slot locking","Retrain scheduler model","Send to call supervisor","Audit recent bookings"],
    spans:[{name:"Call received",status:"success",latency:8},{name:"Patient identification",status:"success",latency:420},{name:"Availability check",status:"error",latency:310},{name:"Slot booking",status:"error",latency:180},{name:"Confirmation",status:"warning",latency:95},{name:"Evaluation",status:"error",latency:140}],
    impact:{time:"~45 min",calls:"3 today",boost:"+51%"},
    whyActions:"Cache invalidation resolves 89% of double-booking issues. Immediate action recommended given clinical compliance risk.",
  },
  "call-summary-generator": {
    product:"CUSTOMER SERVICE", severity:"MEDIUM", traceStatus:"NEW",
    failureType:"Incomplete summary output",
    explanation:"The call summary generator produced truncated outputs for 8 calls, missing key action items. Support agents had no record of promised callbacks or follow-up actions.",
    evidence:["8 truncated summaries in past 24 hours","Confidence score: 54% (threshold: 70%)","Average summary length dropped from 180 → 42 words","4 promised callbacks not logged","Token limit exceeded in generation step"],
    suggestedActions:["Increase max_tokens limit","Add summary validation step","Compress prompt context","Send to call supervisor","Review affected call records"],
    spans:[{name:"Call received",status:"success",latency:8},{name:"Transcript generation",status:"success",latency:890},{name:"Key point extraction",status:"warning",latency:340},{name:"Summary generation",status:"error",latency:620},{name:"CRM logging",status:"error",latency:180},{name:"Evaluation",status:"error",latency:140}],
    impact:{time:"~10 min",calls:"8 today",boost:"+19%"},
    whyActions:"Token limit increases resolve truncation in 94% of cases. Low risk change with immediate impact.",
  },
  "escalation-detector": {
    product:"HEALTHCARE", severity:"CRITICAL", traceStatus:"NEW",
    failureType:"Missed escalation signal",
    explanation:"The escalation detector failed to identify 2 calls requiring immediate clinical attention. Patients with urgent symptoms were not connected to a nurse or physician.",
    evidence:["2 missed escalations with urgent symptoms","Confidence score: 22% (threshold: 70%)","Keywords 'chest pain' and 'difficulty breathing' not flagged","Both patients called back within 30 minutes","Clinical risk review flagged by compliance team"],
    suggestedActions:["Add keyword override rules","Lower escalation threshold","Retrain on clinical vocabulary","Send to call supervisor","File compliance report"],
    spans:[{name:"Call received",status:"success",latency:8},{name:"Speech to text",status:"success",latency:340},{name:"Symptom extraction",status:"warning",latency:290},{name:"Escalation detection",status:"error",latency:180},{name:"Routing decision",status:"error",latency:65},{name:"Evaluation",status:"error",latency:140}],
    impact:{time:"~20 min",calls:"2 today",boost:"+48%"},
    whyActions:"Keyword override rules provide immediate protection while model retraining is in progress. Critical compliance risk requires urgent action.",
  },
};

async function fetchTraces(): Promise<Trace[]> {
  const creds = btoa("pk-lf-d05e60cb-f349-4d23-93b3-649bb0b9468e:sk-lf-7d64433c-6df0-4b56-b95e-2dd654b32c15");
  const res = await fetch("https://us.cloud.langfuse.com/api/public/traces?limit=20", {
    headers: { Authorization: "Basic " + creds },
  });
  if (!res.ok) throw new Error("Langfuse " + res.status);
  const { data = [] } = await res.json();
  return data.map((t: any): Trace => {
    const scores = t.scores || [];
    const score = Math.min(
      scores.length ? scores.reduce((s: number, x: any) => s + x.value, 0) / scores.length : Math.random() * 0.5,
      1
    );
    const s = SCENARIOS[t.name] || {};
    return {
      id: t.id, name: t.name || "Unnamed", timestamp: t.timestamp,
      failureType: s.failureType || "Evaluation failure",
      explanation: s.explanation || `Score: ${(score * 100).toFixed(0)}%. Flagged.`,
      confidenceScore: score, severity: s.severity || "MEDIUM",
      traceStatus: s.traceStatus || "NEW",
      evidence: s.evidence || ["Below threshold", "Flagged for review"],
      suggestedActions: s.suggestedActions || ["Review trace", "Re-run evaluation", "Send to call supervisor"],
      spans: s.spans || [{ name: "Processing", status: "success", latency: 120 }, { name: "Evaluation", status: "error", latency: 140 }],
      product: s.product || "GENERAL",
      impact: s.impact || { time: "~20 min", calls: "Unknown", boost: "+25%" },
      whyActions: s.whyActions || "Based on failure pattern, these actions have the highest success rate.",
    };
  });
}

// ── Exact tokens from Figma design system ─────────────────────────
const T = {
  white: "#ffffff", dark: "#111827", bg: "#f8fafc",
  gray50: "#f9fafb", gray100: "#f3f4f6", gray200: "#e5e7eb",
  gray400: "#9ca3af", gray500: "#6b7280", gray700: "#374151",

  // Blue — primary + logo (blue/700)
  blue:       "#1d4ed8",
  blueBg:     "#eef2ff",   // indigo/50
  blueBorder: "#c7d2fe",   // indigo/200

  // CRITICAL — red tokens
  critText:   "#e2483d",
  critBg:     "#fef2f2",   // red/50
  critBorder: "#fecaca",   // red/200
  critSel:    "#fff1f2",

  // HIGH — orange tokens
  highText:   "#c2410c",
  highBg:     "#fff7ed",   // orange/50
  highBorder: "#fed7aa",   // orange/200
  highSel:    "#fff7ed",

  // MEDIUM — amber tokens
  medText:    "#b45309",   // amber/700
  medBg:      "#fffbeb",   // amber/50
  medBorder:  "#fde68a",   // amber/200
  medSel:     "#fefce8",

  // CUSTOMER SERVICE badge — blue/indigo
  csBg:     "#eef2ff",   // indigo/50
  csBorder: "#c7d2fe",   // indigo/200
  csText:   "#1d4ed8",   // blue/700

  // HEALTHCARE badge — muted green (not bright)
  // Using desaturated green: light bg, subtle border, readable text
  hcBg:     "#f0fdf4",   // green/50 — very light, not bright
  hcBorder: "#bbf7d0",   // green/200 — soft border
  hcText:   "#15803d",   // green/700 — readable, not loud

  // Low confidence — amber/600 (warning, distinct from severity)
  lowConfColor:  "#d97706",  // amber/600
  highConfColor: "#16a34a",  // green/600

  green: "#16a34a",
};

const SEV: Record<string, { badge_bg: string; badge_bd: string; badge_tx: string; sel_bg: string; rc_bg: string; rc_bd: string; rc_left: string }> = {
  CRITICAL: { badge_bg: T.critBg,  badge_bd: T.critBorder, badge_tx: T.critText, sel_bg: T.critSel, rc_bg: T.critBg,  rc_bd: T.critBorder, rc_left: T.critText },
  HIGH:     { badge_bg: T.highBg,  badge_bd: T.highBorder, badge_tx: T.highText, sel_bg: T.highSel, rc_bg: T.highBg,  rc_bd: T.highBorder, rc_left: T.highText },
  MEDIUM:   { badge_bg: T.medBg,   badge_bd: T.medBorder,  badge_tx: T.medText,  sel_bg: T.medSel,  rc_bg: T.medBg,   rc_bd: T.medBorder,  rc_left: T.medText  },
};

// Product tag — muted green for HEALTHCARE, blue for CUSTOMER SERVICE
function ProductTag({ product }: { product: string }) {
  const isCS = product === "CUSTOMER SERVICE";
  return (
    <span style={{
      fontSize: 8, fontWeight: 600, letterSpacing: "0.03em",
      background: isCS ? T.csBg   : T.hcBg,
      color:      isCS ? T.csText : T.hcText,
      border:     `1px solid ${isCS ? T.csBorder : T.hcBorder}`,
      borderRadius: 4, padding: "2px 6px",
      whiteSpace: "nowrap" as const, display: "inline-block", lineHeight: "16px",
    }}>
      {product}
    </span>
  );
}

function SevBadge({ sev }: { sev: string }) {
  const s = SEV[sev] || SEV.MEDIUM;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
      background: s.badge_bg, color: s.badge_tx,
      border: `1px solid ${s.badge_bd}`,
      borderRadius: 8, padding: "2px 8px",
      whiteSpace: "nowrap" as const,
    }}>
      {sev}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: T.gray500, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 10px", textAlign: "left" as const }}>
      {children}
    </p>
  );
}

const NAV_ITEMS = [
  { icon: "📊", label: "Traces",    active: true  },
  { icon: "✅", label: "Evals",     active: false },
  { icon: "💬", label: "Prompts",   active: false },
  { icon: "📈", label: "Analytics", active: false },
  { icon: "⚙️", label: "Settings",  active: false },
];

export default function App() {
  const [traces, setTraces]         = useState<Trace[]>([]);
  const [sel, setSel]               = useState<Trace | null>(null);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState<string | null>(null);
  const [evOpen, setEvOpen]         = useState(true);
  const [msgs, setMsgs]             = useState<{ r: "u" | "a"; t: string }[]>([]);
  const [chat, setChat]             = useState("");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [winW, setWinW]             = useState(typeof window !== "undefined" ? window.innerWidth : 1440);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setWinW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    fetchTraces()
      .then(d => { setTraces(d); if (d.length) setSel(d[0]); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const isMobile = winW < 768;
  const isTablet = winW >= 768 && winW < 1100;
  const showNav  = !isMobile && !isTablet;

  const critN = traces.filter(t => t.severity === "CRITICAL").length;
  const avgC  = traces.length ? Math.round(traces.reduce((s, t) => s + t.confidenceScore * 100, 0) / traces.length) : 0;

  const sendChat = () => {
    if (!chat.trim() || !sel) return;
    const q = chat.trim(); setChat("");
    setMsgs(p => [...p, { r: "u", t: q }]);
    setTimeout(() => setMsgs(p => [...p, {
      r: "a",
      t: `Analyzing "${q}" for "${sel.name}"... ${sel.whyActions}`,
    }]), 700);
  };

  const sevCfg = sel ? (SEV[sel.severity] || SEV.MEDIUM) : SEV.CRITICAL;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: T.bg, overflow: "hidden", boxSizing: "border-box" }}>

      {/* ── Header ── */}
      <div style={{ width: "100%", height: 52, flexShrink: 0, background: T.white, borderBottom: `1px solid ${T.gray200}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 100, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo — blue */}
          <div style={{ width: 28, height: 28, background: T.blue, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: T.white, fontSize: 14 }}>⬡</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.dark }}>Trace Intel</span>
          {!isMobile && <span style={{ fontSize: 11, color: T.gray400 }}>Making AI behavior readable</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: T.blueBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.blue }}>J</span>
          </div>
          {!isMobile && <span style={{ fontSize: 11, color: T.gray500 }}>Jason · AI Investigator</span>}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", width: "100%" }}>

        {/* Left nav */}
        {showNav && (
          <div style={{ width: 52, flexShrink: 0, background: T.white, borderRight: `1px solid ${T.gray200}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, overflowY: "auto" }}>
            {NAV_ITEMS.map(item => (
              <div key={item.label} style={{ width: 42, height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, marginBottom: 2, background: item.active ? T.blueBg : "transparent", cursor: "pointer" }}>
                <span style={{ fontSize: 15, lineHeight: 1, marginBottom: 3 }}>{item.icon}</span>
                <span style={{ fontSize: 8, fontWeight: item.active ? 700 : 400, color: item.active ? T.blue : T.gray500 }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Sidebar ── */}
        {(!isMobile || mobileView === "list") && (
          <div style={{ width: isMobile ? "100%" : 280, flexShrink: 0, background: T.white, borderRight: `1px solid ${T.gray200}`, display: "flex", flexDirection: "column", overflowY: "auto" }}>

            {/* Summary strip */}
            <div style={{ background: T.gray50, borderBottom: `1px solid ${T.gray200}`, padding: "14px 16px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: T.dark, lineHeight: 1 }}>{traces.length}</span>
                <span style={{ fontSize: 13, color: T.gray500, lineHeight: 1 }}>failures today</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.critText, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: T.critText }}>{critN} critical · avg {avgC}% ↓</span>
              </div>
            </div>

            {/* Section title */}
            <div style={{ padding: "10px 16px 4px", textAlign: "left" as const }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.gray500, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                Failed Evaluations
              </span>
            </div>

            {loading && <p style={{ padding: "12px 16px", fontSize: 12, color: T.gray500 }}>Loading...</p>}
            {err     && <p style={{ padding: "12px 16px", fontSize: 12, color: T.critText }}>Error: {err}</p>}

            {/* Trace rows */}
            {traces.map(tr => {
              const isSel  = sel?.id === tr.id;
              const sc     = SEV[tr.severity] || SEV.MEDIUM;
              const pct    = Math.round(tr.confidenceScore * 100);
              const isLowConf = tr.confidenceScore < 0.7;
              const confTxt = isLowConf ? `Low conf. · ${pct}%` : `High conf. · ${pct}%`;
              const confColor = isLowConf ? T.lowConfColor : T.highConfColor;

              return (
                <div key={tr.id}
                  onClick={() => { setSel(tr); setEvOpen(true); setMsgs([]); setMobileView("detail"); }}
                  style={{ padding: "10px 16px", background: isSel ? sc.sel_bg : T.white, cursor: "pointer", borderBottom: `1px solid ${T.gray100}`, textAlign: "left" as const }}>

                  {/* Line 1: name + severity badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flex: 1 }}>
                      {tr.name}
                    </span>
                    <SevBadge sev={tr.severity} />
                  </div>

                  {/* Line 2: product tag + confidence */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, justifyContent: "flex-start" }}>
                    <ProductTag product={tr.product} />
                    {/* Low confidence — amber/600, no bg, no border */}
                    <span style={{ fontSize: 10, color: confColor, whiteSpace: "nowrap" as const, fontWeight: 500 }}>
                      {confTxt}
                    </span>
                  </div>

                  {/* Line 3: failure type */}
                  <p style={{ fontSize: 12, fontWeight: 500, color: T.gray700, margin: "0 0 5px", textAlign: "left" as const }}>
                    {tr.failureType}
                  </p>

                  {/* Line 4: status plain ALL CAPS */}
                  <span style={{ fontSize: 9, fontWeight: 600, color: T.gray400, textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block" }}>
                    {tr.traceStatus}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Detail area ── */}
        {(!isMobile || mobileView === "detail") && sel && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

            {/* Title bar */}
            <div style={{ background: T.white, borderBottom: `1px solid ${T.gray200}`, padding: "12px 24px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, justifyContent: "flex-start" }}>
                <ProductTag product={sel.product} />
                <span style={{ fontSize: 10, color: T.gray500 }}>→  {sel.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, justifyContent: "flex-start" }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: T.dark }}>{sel.failureType}</span>
                  <SevBadge sev={sel.severity} />
                  <span style={{ fontSize: 11, color: sel.confidenceScore < 0.7 ? T.lowConfColor : T.highConfColor, fontWeight: 500 }}>
                    {sel.confidenceScore >= 0.7 ? "High" : "Low"} conf. · {Math.round(sel.confidenceScore * 100)}%
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.gray400, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    {sel.traceStatus}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {isMobile && (
                    <button onClick={() => setMobileView("list")} style={{ padding: "7px 12px", background: T.gray100, border: `1px solid ${T.gray200}`, borderRadius: 8, fontSize: 11, cursor: "pointer", color: T.gray700 }}>← Back</button>
                  )}
                  {/* Quarantine first */}
                  <button style={{ padding: "8px 14px", background: T.white, border: `1px solid ${T.gray200}`, borderRadius: 8, fontSize: 11, color: T.gray700, cursor: "pointer" }}>
                    ⚠ Quarantine
                  </button>
                  {/* Rerun second — primary blue */}
                  <button style={{ padding: "8px 18px", background: T.blue, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.white, cursor: "pointer" }}>
                    ↺ Rerun Evaluation
                  </button>
                </div>
              </div>
            </div>

            {/* Main + Right */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

              {/* ── Main panel ── */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", minWidth: 0, background: T.white }}>
                <p style={{ fontSize: 10, color: T.gray500, margin: "0 0 20px", textAlign: "left" as const }}>
                  Investigated by Jason · {new Date(sel.timestamp).toLocaleString()} · Trace ID: {sel.id.slice(0, 16)}...
                </p>

                {/* Timeline */}
                <div style={{ border: `1px solid ${T.gray200}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: T.gray700, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 16px", textAlign: "left" as const }}>
                    Trace Timeline
                  </p>
                  {sel.spans.map((sp, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: sp.status === "error" ? T.critText : sp.status === "warning" ? "#d97706" : T.green }} />
                      <span style={{ fontSize: 11, flex: 1, fontWeight: sp.status === "error" ? 700 : 400, color: sp.status === "error" ? T.dark : T.gray500, textAlign: "left" as const }}>
                        {sp.name}
                      </span>
                      <span style={{ fontSize: 9, color: T.gray500, background: T.gray100, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{sp.latency}ms</span>
                      <span style={{ fontSize: 9, fontWeight: 700, minWidth: 52, textAlign: "right" as const, color: sp.status === "error" ? T.critText : sp.status === "warning" ? "#d97706" : T.green }}>
                        {sp.status === "error" ? "FAILED" : sp.status === "warning" ? "WARNING" : "OK"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Root cause — color matches severity */}
                <div style={{ background: sevCfg.rc_bg, border: `1px solid ${sevCfg.rc_bd}`, borderLeft: `4px solid ${sevCfg.rc_left}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: "flex-start" }}>
                    <span style={{ fontSize: 11, color: sevCfg.rc_left }}>⚠</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.gray500, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Root Cause Detected</span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: T.dark, margin: "0 0 10px", textAlign: "left" as const }}>{sel.failureType}</p>
                  <p style={{ fontSize: 12, color: T.gray700, lineHeight: 1.7, margin: 0, textAlign: "left" as const }}>{sel.explanation}</p>
                </div>

                {/* Evidence */}
                <div style={{ border: `1px solid ${T.gray200}`, borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setEvOpen(!evOpen)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: T.gray50, border: "none", borderBottom: evOpen ? `1px solid ${T.gray200}` : "none", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.gray700, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Evidence</span>
                      <span style={{ fontSize: 9, fontWeight: 700, background: T.gray200, color: T.gray500, borderRadius: 10, padding: "1px 6px" }}>{sel.evidence.length}</span>
                    </div>
                    <span style={{ fontSize: 9, color: T.gray500 }}>{evOpen ? "▲ Hide" : "▼ Show"}</span>
                  </button>
                  {evOpen && (
                    <div style={{ padding: "12px 16px", background: T.white }}>
                      {sel.evidence.map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.gray400, marginTop: 6, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: T.gray700, lineHeight: 1.5, textAlign: "left" as const }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right panel — 280px ── */}
              {!isMobile && !isTablet && (
                <div style={{ width: 280, flexShrink: 0, background: T.gray50, borderLeft: `1px solid ${T.gray200}`, overflowY: "auto", padding: "16px 14px" }}>

                  {/* Suggested actions — ALL buttons same plain style, no dark/black */}
                  <SectionTitle>Suggested Actions</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {sel.suggestedActions.map((a, i) => (
                      <button key={i}
                        style={{
                          width: "100%", padding: "8px 14px",
                          // All buttons identical — white bg, gray border, gray text
                          background: T.white,
                          color: T.gray700,
                          border: `1px solid ${T.gray200}`,
                          borderRadius: 8, fontSize: 11, fontWeight: 400,
                          cursor: "pointer", textAlign: "left" as const,
                        }}>
                        {a}
                      </button>
                    ))}
                  </div>

                  <div style={{ height: 1, background: T.gray200, marginBottom: 14 }} />

                  {/* Why these actions */}
                  <div style={{ background: "#fffbeb", border: `1px solid #fde68a`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span>💡</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.dark }}>Why these actions?</span>
                    </div>
                    <p style={{ fontSize: 10, color: T.gray700, lineHeight: 1.6, margin: 0, textAlign: "left" as const }}>{sel.whyActions}</p>
                  </div>

                  <div style={{ height: 1, background: T.gray200, marginBottom: 14 }} />

                  {/* Estimated impact */}
                  <SectionTitle>Estimated Impact</SectionTitle>
                  {[
                    { l: "Resolution time", v: sel.impact.time,  g: false },
                    { l: "Affected calls",  v: sel.impact.calls, g: false },
                    { l: "Confidence boost",v: sel.impact.boost, g: true  },
                  ].map(item => (
                    <div key={item.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: T.gray500 }}>{item.l}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: item.g ? T.green : T.dark }}>{item.v}</span>
                    </div>
                  ))}

                  <div style={{ height: 1, background: T.gray200, margin: "6px 0 14px" }} />

                  {/* Ask about this failure — chat inside */}
                  <div style={{ background: T.blueBg, border: `1px solid ${T.blue}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "12px 14px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start" }}>
                        <span style={{ fontSize: 14, color: T.blue }}>◎</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.dark }}>Ask about this failure</span>
                      </div>
                    </div>

                    {msgs.length > 0 && (
                      <div style={{ maxHeight: 160, overflowY: "auto", padding: "8px 12px", background: T.white, display: "flex", flexDirection: "column", gap: 8 }}>
                        {msgs.map((m, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: m.r === "u" ? "flex-end" : "flex-start" }}>
                            <div style={{ maxWidth: "88%", padding: "7px 10px", borderRadius: m.r === "u" ? "10px 10px 2px 10px" : "10px 10px 10px 2px", background: m.r === "u" ? T.blue : T.gray100, color: m.r === "u" ? T.white : T.gray700, fontSize: 11, lineHeight: 1.5 }}>
                              {m.t}
                            </div>
                          </div>
                        ))}
                        <div ref={endRef} />
                      </div>
                    )}

                    <div style={{ padding: "8px 10px", background: msgs.length > 0 ? T.white : "transparent", borderTop: msgs.length > 0 ? `1px solid ${T.gray200}` : "none" }}>
                      <div style={{ background: T.white, border: `1px solid ${T.gray200}`, borderRadius: 20, display: "flex", alignItems: "center", padding: "3px 3px 3px 12px" }}>
                        <input
                          value={chat}
                          onChange={e => setChat(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && sendChat()}
                          placeholder="Why is intent detection failing?"
                          style={{ flex: 1, border: "none", outline: "none", fontSize: 11, color: T.dark, background: "transparent", minWidth: 0 }}
                        />
                        <button onClick={sendChat} style={{ width: 28, height: 28, borderRadius: 14, background: T.blue, border: "none", color: T.white, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>↑</button>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
