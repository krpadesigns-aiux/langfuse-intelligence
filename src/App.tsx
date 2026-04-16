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
  const res = await fetch("https://us.cloud.langfuse.com/api/public/traces?limit=20", { headers:{ Authorization:"Basic "+creds } });
  if (!res.ok) throw new Error("Langfuse "+res.status);
  const { data = [] } = await res.json();
  return data.map((t: any): Trace => {
    const score = Math.min(t.scores?.length ? t.scores.reduce((s:number,x:any)=>s+x.value,0)/t.scores.length : Math.random()*0.5, 1);
    const s = SCENARIOS[t.name] || {};
    return {
      id:t.id, name:t.name||"Unnamed", timestamp:t.timestamp,
      failureType:s.failureType||"Evaluation failure",
      explanation:s.explanation||`Score: ${(score*100).toFixed(0)}%. Flagged.`,
      confidenceScore:score, severity:s.severity||"MEDIUM", traceStatus:s.traceStatus||"NEW",
      evidence:s.evidence||["Below threshold","Flagged for review"],
      suggestedActions:s.suggestedActions||["Review trace","Re-run evaluation","Send to call supervisor"],
      spans:s.spans||[{name:"Processing",status:"success",latency:120},{name:"Evaluation",status:"error",latency:140}],
      product:s.product||"GENERAL", impact:s.impact||{time:"~20 min",calls:"Unknown",boost:"+25%"},
      whyActions:s.whyActions||"Based on failure pattern, these actions have the highest success rate.",
    };
  });
}

// ── Tokens from Figma design system ──────────────────────────────
const C = {
  white:"#ffffff", dark:"#111827", bg:"#f8fafc",
  gray50:"#f9fafb", gray100:"#f3f4f6", gray200:"#e5e7eb",
  gray300:"#d1d5db", gray400:"#9ca3af", gray500:"#6b7280",
  gray600:"#4b5563", gray700:"#374151",
  blue:"#1d4ed8", blueBg:"#eff2fe", blueBorder:"#bfdbfe",
  // Severity — Figma risk tokens
  red:"#dc2626",    redBg:"#fef2f2",    redBorder:"#fecaca",
  orange:"#ea580c", orBg:"#fff7ed",     orBorder:"#fed7aa",
  amber:"#d97706",  ambBg:"#fffbeb",    ambBorder:"#fde68a",
  green:"#16a34a",
};

const SEV = {
  CRITICAL:{ bg:C.redBg,  bd:C.redBorder, tx:C.red    },
  HIGH:    { bg:C.orBg,   bd:C.orBorder,  tx:C.orange },
  MEDIUM:  { bg:C.ambBg,  bd:C.ambBorder, tx:C.amber  },
};

// Product tag — same style in both sidebar and main panel
function ProductTag({ product }: { product: string }) {
  const isCS = product === "CUSTOMER SERVICE";
  return (
    <span style={{
      fontSize:8, fontWeight:600,
      background: isCS ? C.blueBg : C.gray100,
      color: isCS ? C.blue : C.gray600,
      border: `1px solid ${isCS ? C.blueBorder : C.gray200}`,
      borderRadius:4, padding:"2px 6px", whiteSpace:"nowrap" as const,
      letterSpacing:"0.03em",
    }}>
      {product}
    </span>
  );
}

function SevBadge({ sev }: { sev: string }) {
  const s = SEV[sev as keyof typeof SEV] || SEV.MEDIUM;
  return (
    <span style={{ fontSize:9, fontWeight:700, background:s.bg, color:s.tx, border:`1px solid ${s.bd}`, borderRadius:4, padding:"2px 6px", whiteSpace:"nowrap" as const }}>
      {sev}
    </span>
  );
}

// Confidence — no bg, no border, just text
function ConfLabel({ label }: { label: string }) {
  return (
    <span style={{ fontSize:9, fontWeight:500, color:C.gray500, whiteSpace:"nowrap" as const }}>
      {label}
    </span>
  );
}

// Status — neutral, compact
function StatusBadge({ label }: { label: string }) {
  return (
    <span style={{ fontSize:8, fontWeight:500, background:C.gray100, color:C.gray600, border:`1px solid ${C.gray200}`, borderRadius:4, padding:"1px 5px", whiteSpace:"nowrap" as const }}>
      {label}
    </span>
  );
}

const NAV_ITEMS = [
  { icon:"📊", label:"Traces",   active:true  },
  { icon:"✅", label:"Evals",    active:false },
  { icon:"💬", label:"Prompts",  active:false },
  { icon:"📈", label:"Analytics",active:false },
  { icon:"⚙️", label:"Settings", active:false },
];

export default function App() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [sel, setSel]       = useState<Trace|null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string|null>(null);
  const [evOpen, setEvOpen]   = useState(true);
  const [msgs, setMsgs]       = useState<{r:"u"|"a"; t:string}[]>([]);
  const [chat, setChat]       = useState("");
  const [mobileView, setMobileView] = useState<"list"|"detail">("list");
  const [winW, setWinW]       = useState(typeof window!=="undefined" ? window.innerWidth : 1440);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    fetchTraces()
      .then(d => { setTraces(d); if (d.length) setSel(d[0]); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const isMobile = winW < 768;
  const isTablet = winW >= 768 && winW < 1100;
  const showNav  = !isMobile && !isTablet;

  const critN = traces.filter(t => t.severity==="CRITICAL").length;
  const avgC  = traces.length ? Math.round(traces.reduce((s,t) => s+t.confidenceScore*100, 0)/traces.length) : 0;

  const sendChat = () => {
    if (!chat.trim() || !sel) return;
    const q = chat.trim(); setChat("");
    setMsgs(p => [...p, { r:"u", t:q }]);
    setTimeout(() => setMsgs(p => [...p, {
      r:"a",
      t:`Analyzing "${q}" for "${sel.name}"... ${sel.whyActions}`,
    }]), 700);
  };

  return (
    <div style={{
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      height:"100vh", width:"100vw",           // ← full width
      display:"flex", flexDirection:"column",
      background:C.bg, overflow:"hidden",
      boxSizing:"border-box",
    }}>

      {/* ── Full-width header ── */}
      <div style={{
        width:"100%", height:52, background:C.white,
        borderBottom:`1px solid ${C.gray200}`,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 20px", flexShrink:0, zIndex:100,
        boxSizing:"border-box",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, background:C.dark, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ color:C.white, fontSize:14 }}>⬡</span>
          </div>
          <span style={{ fontSize:14, fontWeight:700, color:C.dark }}>Trace Intel</span>
          {!isMobile && <span style={{ fontSize:11, color:C.gray400 }}>Making AI behavior readable</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:14, background:C.blueBg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.blue }}>J</span>
          </div>
          {!isMobile && <span style={{ fontSize:11, color:C.gray500 }}>Jason · AI Investigator</span>}
        </div>
      </div>

      {/* ── Body row ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", width:"100%" }}>

        {/* Left nav — 52px */}
        {showNav && (
          <div style={{ width:52, flexShrink:0, background:C.white, borderRight:`1px solid ${C.gray200}`, display:"flex", flexDirection:"column", alignItems:"center", paddingTop:12, overflowY:"auto" }}>
            {NAV_ITEMS.map(item => (
              <div key={item.label} style={{ width:42, height:52, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderRadius:8, marginBottom:2, background:item.active ? C.blueBg : "transparent", cursor:"pointer" }}>
                <span style={{ fontSize:15, lineHeight:1, marginBottom:3 }}>{item.icon}</span>
                <span style={{ fontSize:8, fontWeight:item.active?700:400, color:item.active?C.blue:C.gray500 }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sidebar — 280px */}
        {(!isMobile || mobileView==="list") && (
          <div style={{ width:isMobile?"100%":280, flexShrink:0, background:C.white, borderRight:`1px solid ${C.gray200}`, display:"flex", flexDirection:"column", overflowY:"auto" }}>

            {/* Summary strip */}
            <div style={{ background:C.gray50, borderBottom:`1px solid ${C.gray200}`, padding:"14px 16px", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
                <span style={{ fontSize:28, fontWeight:700, color:C.dark, lineHeight:1 }}>{traces.length}</span>
                <span style={{ fontSize:11, color:C.gray500 }}>failures today</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:C.red, flexShrink:0 }} />
                <span style={{ fontSize:10, fontWeight:600, color:C.red }}>{critN} critical · avg {avgC}% ↓</span>
              </div>
            </div>

            {/* Section title — left aligned */}
            <div style={{ padding:"10px 16px 4px" }}>
              <span style={{ fontSize:10, fontWeight:700, color:C.gray500, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>
                Failed Evaluations
              </span>
            </div>

            {loading && <p style={{ padding:"12px 16px", fontSize:12, color:C.gray500 }}>Loading...</p>}
            {err     && <p style={{ padding:"12px 16px", fontSize:12, color:C.red   }}>Error: {err}</p>}

            {/* Rows — no left accent, clean bottom border only */}
            {traces.map(tr => {
              const isSel = sel?.id === tr.id;
              return (
                <div key={tr.id}
                  onClick={() => { setSel(tr); setEvOpen(true); setMsgs([]); setMobileView("detail"); }}
                  style={{ padding:"10px 16px", background:isSel ? C.blueBg : C.white, cursor:"pointer", borderBottom:`1px solid ${C.gray100}` }}>

                  {/* Row 1: name + status badge */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, maxWidth:186 }}>
                      {tr.name}
                    </span>
                    <StatusBadge label={tr.traceStatus} />
                  </div>

                  {/* Row 2: severity + confidence text */}
                  <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4, flexWrap:"wrap" as const }}>
                    <SevBadge sev={tr.severity} />
                    <ConfLabel label="Low conf." />
                  </div>

                  {/* Row 3: product tag — left aligned */}
                  <div style={{ marginBottom:4, textAlign:"left" as const }}>
                    <ProductTag product={tr.product} />
                  </div>

                  {/* Row 4: failure type — left aligned */}
                  <span style={{ fontSize:10, color:C.gray500, display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, textAlign:"left" as const }}>
                    {tr.failureType}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Detail area — flex:1, full remaining width ── */}
        {(!isMobile || mobileView==="detail") && sel && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>

            {/* Title bar */}
            <div style={{ background:C.white, borderBottom:`1px solid ${C.gray200}`, padding:"12px 24px", flexShrink:0 }}>
              {/* Breadcrumb */}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                {/* Same product tag as sidebar */}
                <ProductTag product={sel.product} />
                <span style={{ fontSize:10, color:C.gray500 }}>→  {sel.name}</span>
              </div>
              {/* Title row */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" as const }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
                  <span style={{ fontSize:20, fontWeight:700, color:C.dark }}>{sel.failureType}</span>
                  <SevBadge sev={sel.severity} />
                  <ConfLabel label={`Low · ${(sel.confidenceScore*100).toFixed(0)}%`} />
                  <StatusBadge label={sel.traceStatus} />
                </div>
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  {isMobile && (
                    <button onClick={() => setMobileView("list")} style={{ padding:"7px 12px", background:C.gray100, border:`1px solid ${C.gray200}`, borderRadius:8, fontSize:11, cursor:"pointer", color:C.gray700 }}>← Back</button>
                  )}
                  <button style={{ padding:"8px 18px", background:C.blue, border:"none", borderRadius:8, fontSize:11, fontWeight:700, color:C.white, cursor:"pointer" }}>
                    ↺ Rerun Evaluation
                  </button>
                  <button style={{ padding:"8px 14px", background:C.white, border:`1px solid ${C.gray200}`, borderRadius:8, fontSize:11, color:C.gray700, cursor:"pointer" }}>
                    ⚠ Quarantine
                  </button>
                </div>
              </div>
            </div>

            {/* Main + Right row */}
            <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

              {/* ── Main panel — white bg, flex:1, full width ── */}
              <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", minWidth:0, background:C.white }}>
                <p style={{ fontSize:10, color:C.gray500, margin:"0 0 20px", textAlign:"left" as const }}>
                  Investigated by Jason · {new Date(sel.timestamp).toLocaleString()} · Trace ID: {sel.id.slice(0,16)}...
                </p>

                {/* Timeline */}
                <div style={{ border:`1px solid ${C.gray200}`, borderRadius:12, padding:"16px 20px", marginBottom:16 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:C.gray700, textTransform:"uppercase" as const, letterSpacing:"0.06em", margin:"0 0 16px", textAlign:"left" as const }}>
                    Trace Timeline
                  </p>
                  {sel.spans.map((sp,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:sp.status==="error"?C.red:sp.status==="warning"?"#d97706":"#16a34a" }} />
                      {/* span name — left aligned */}
                      <span style={{ fontSize:11, flex:1, fontWeight:sp.status==="error"?700:400, color:sp.status==="error"?C.dark:C.gray500, textAlign:"left" as const }}>
                        {sp.name}
                      </span>
                      <span style={{ fontSize:9, color:C.gray500, background:C.gray100, padding:"2px 6px", borderRadius:4, flexShrink:0 }}>{sp.latency}ms</span>
                      <span style={{ fontSize:9, fontWeight:700, minWidth:52, textAlign:"right" as const, color:sp.status==="error"?C.red:sp.status==="warning"?"#d97706":"#16a34a" }}>
                        {sp.status==="error"?"FAILED":sp.status==="warning"?"WARNING":"OK"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Root cause */}
                <div style={{ background:C.redBg, border:`1px solid ${C.redBorder}`, borderLeft:`4px solid ${C.red}`, borderRadius:12, padding:"16px 20px", marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:11, color:C.red }}>⚠</span>
                    <span style={{ fontSize:9, fontWeight:700, color:C.gray500, textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>Root Cause Detected</span>
                  </div>
                  {/* failureType — left aligned */}
                  <p style={{ fontSize:15, fontWeight:700, color:C.dark, margin:"0 0 10px", textAlign:"left" as const }}>{sel.failureType}</p>
                  <p style={{ fontSize:12, color:C.gray700, lineHeight:1.7, margin:0, textAlign:"left" as const }}>{sel.explanation}</p>
                </div>

                {/* Evidence */}
                <div style={{ border:`1px solid ${C.gray200}`, borderRadius:12, overflow:"hidden" }}>
                  <button onClick={() => setEvOpen(!evOpen)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 16px", background:C.gray50, border:"none", borderBottom:evOpen?`1px solid ${C.gray200}`:"none", cursor:"pointer" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:C.gray700, textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>Evidence</span>
                      <span style={{ fontSize:9, fontWeight:700, background:C.gray200, color:C.gray500, borderRadius:10, padding:"1px 6px" }}>{sel.evidence.length}</span>
                    </div>
                    <span style={{ fontSize:9, color:C.gray500 }}>{evOpen?"▲ Hide":"▼ Show"}</span>
                  </button>
                  {evOpen && (
                    <div style={{ padding:"12px 16px", background:C.white }}>
                      {sel.evidence.map((item,i) => (
                        <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                          <div style={{ width:4, height:4, borderRadius:"50%", background:C.gray400, marginTop:6, flexShrink:0 }} />
                          <span style={{ fontSize:11, color:C.gray700, lineHeight:1.5, textAlign:"left" as const }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right panel — 280px ── */}
              {!isMobile && !isTablet && (
                <div style={{ width:280, flexShrink:0, background:C.gray50, borderLeft:`1px solid ${C.gray200}`, overflowY:"auto", padding:"16px 14px", display:"flex", flexDirection:"column", gap:0 }}>

                  {/* Suggested actions — left aligned, plain buttons no color */}
                  <p style={{ fontSize:10, fontWeight:700, color:C.gray500, textTransform:"uppercase" as const, letterSpacing:"0.06em", margin:"0 0 10px", textAlign:"left" as const }}>Suggested Actions</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                    {sel.suggestedActions.map((a,i) => (
                      <button key={i}
                        style={{ width:"100%", padding:"8px 14px", background:i===0?C.dark:C.white, color:i===0?C.white:C.gray700, border:`1px solid ${i===0?C.dark:C.gray200}`, borderRadius:8, fontSize:11, fontWeight:i===0?700:400, cursor:"pointer", textAlign:"left" as const }}>
                        {a}
                      </button>
                    ))}
                  </div>

                  <div style={{ height:1, background:C.gray200, marginBottom:14 }} />

                  {/* Why these actions */}
                  <div style={{ background:"#fffbeb", border:`1px solid #fde68a`, borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                      <span>💡</span>
                      <span style={{ fontSize:11, fontWeight:700, color:C.dark }}>Why these actions?</span>
                    </div>
                    {/* paragraph — left aligned */}
                    <p style={{ fontSize:10, color:C.gray700, lineHeight:1.6, margin:0, textAlign:"left" as const }}>{sel.whyActions}</p>
                  </div>

                  <div style={{ height:1, background:C.gray200, marginBottom:14 }} />

                  {/* Estimated impact — left aligned, divider above */}
                  <p style={{ fontSize:10, fontWeight:700, color:C.gray500, textTransform:"uppercase" as const, letterSpacing:"0.06em", margin:"0 0 10px", textAlign:"left" as const }}>Estimated Impact</p>
                  {[
                    { l:"Resolution time", v:sel.impact.time,  g:false },
                    { l:"Affected calls",  v:sel.impact.calls, g:false },
                    { l:"Confidence boost",v:sel.impact.boost, g:true  },
                  ].map(item => (
                    <div key={item.l} style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontSize:11, color:C.gray500 }}>{item.l}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:item.g?C.green:C.dark }}>{item.v}</span>
                    </div>
                  ))}

                  <div style={{ height:1, background:C.gray200, margin:"6px 0 14px" }} />

                  {/* Ask about this failure — chat inside */}
                  <div style={{ background:C.blueBg, border:`1px solid ${C.blue}`, borderRadius:10, overflow:"hidden" }}>
                    <div style={{ padding:"12px 14px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:14, color:C.blue }}>◎</span>
                        <span style={{ fontSize:12, fontWeight:700, color:C.dark }}>Ask about this failure</span>
                      </div>
                    </div>

                    {msgs.length > 0 && (
                      <div style={{ maxHeight:160, overflowY:"auto", padding:"8px 12px", background:C.white, display:"flex", flexDirection:"column", gap:8 }}>
                        {msgs.map((m,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:m.r==="u"?"flex-end":"flex-start" }}>
                            <div style={{ maxWidth:"88%", padding:"7px 10px", borderRadius:m.r==="u"?"10px 10px 2px 10px":"10px 10px 10px 2px", background:m.r==="u"?C.blue:C.gray100, color:m.r==="u"?C.white:C.gray700, fontSize:11, lineHeight:1.5 }}>
                              {m.t}
                            </div>
                          </div>
                        ))}
                        <div ref={endRef} />
                      </div>
                    )}

                    <div style={{ padding:"8px 10px", background:msgs.length>0?C.white:"transparent", borderTop:msgs.length>0?`1px solid ${C.gray200}`:"none" }}>
                      <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:20, display:"flex", alignItems:"center", padding:"3px 3px 3px 12px" }}>
                        <input
                          value={chat}
                          onChange={e => setChat(e.target.value)}
                          onKeyDown={e => e.key==="Enter" && sendChat()}
                          placeholder="Why is intent detection failing?"
                          style={{ flex:1, border:"none", outline:"none", fontSize:11, color:C.dark, background:"transparent", minWidth:0 }}
                        />
                        <button onClick={sendChat} style={{ width:28, height:28, borderRadius:14, background:C.blue, border:"none", color:C.white, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>↑</button>
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
