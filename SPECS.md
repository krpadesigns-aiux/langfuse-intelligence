# Trace Intel — Intelligence Legibility System
## Design Specs

**Project:** Langfuse redesign experiment  
**Thesis:** "A non-technical user should be able to open a trace, understand what the AI did, and decide whether to trust it — without reading JSON."  
**Live:** https://langfuse-intelligence.vercel.app  
**GitHub:** https://github.com/krpadesigns-aiux/langfuse-intelligence  
**Figma:** https://www.figma.com/design/0JvQvijxEfYlc3s3wg7bPU

---

## 1. Problem

From Langfuse GitHub Discussion #11391 (2026 roadmap thread), a real user with a 20-person non-technical annotation team wrote:

> "Langfuse started as a tool by techies for techies — the UI still shows this."

**Specific pain points (real user research):**
- Non-technical domain experts annotating AI traces consistently get lost
- No dedicated failure summary view — users must hunt through raw JSON
- Context resets when navigating from a saved view into a trace and back
- Eval scores shown as numbers only (0.31, 0.44) with no explanation
- Annotation queue only shows configured scores — annotators lack context

**Design gap:** When an AI agent fails, Langfuse shows raw JSON spans and flat eval scores. A domain expert — annotator, PM, QA — cannot understand what went wrong or whether to trust the system.

---

## 2. Users

### Jason — AI Investigator / Domain Expert
- Opens Trace Intel to investigate failed evaluations
- Needs to understand failure patterns across multiple traces
- Takes action: adjusts thresholds, escalates issues, validates root cause diagnosis
- **Success metric:** Can identify failure cause in under 30 seconds without reading JSON

### Priya — Call Supervisor
- Receives escalations from Jason
- Reviews specific affected calls and fixes agent behavior
- Not a Langfuse user — works in a separate system (Retell Supervise)
- **Connection point:** "Send to call supervisor" action bridges the two systems

---

## 3. Component Specs

These specs were written in Figma component description fields and read by Claude via MCP to generate React code.

### `root_cause_card`
```
Purpose: Displays AI-detected failure cause in plain language
Props:
  - failureType: string        — e.g. "Intent misclassification"
  - explanation: string        — 1-2 sentence plain language explanation
  - confidenceScore: float     — 0.0 to 1.0
Variants:
  - severity: CRITICAL | HIGH | MEDIUM
  - state: error | warning | success
Visual rules:
  - Background color matches severity token
  - Left border accent = 4px, color = severity token
  - CRITICAL → red/50 bg, color/risk/low border
  - HIGH     → orange/50 bg, orange border
  - MEDIUM   → amber/50 bg, amber/200 border
Behavior:
  - Thumbs up/down writes human_feedback score to Langfuse API
  - 👍 = value: 1, 👎 = value: -1, score name: "human_feedback"
Use when: evaluation result is flagged as failed
Do not use when: trace has no evaluation scores
Maps to: failure_type, root_cause (Langfuse trace schema)
```

### `confidence_badge`
```
Purpose: Shows AI confidence level with visual risk signal
Props:
  - level: "high" | "medium" | "low"
  - score: float — real percentage from Langfuse scores API
Display:
  - "Low confidence · 28%"   — amber/600 text, no background
  - "High confidence · 84%"  — green/600 text, no background
Rules:
  - No background color, no border — plain text only
  - Low confidence = amber (#d97706) — warning, not alarm
  - High confidence = green (#16a34a)
  - Score is real data from Langfuse, not hardcoded
Use when: any trace result needs confidence surfaced
Maps to: scores[] array (Langfuse eval schema)
```

### `evidence_panel`
```
Purpose: Surfaces evidence behind AI failure detection
Props:
  - evidence: string[]    — list of evidence items
  - count: number         — shown in header badge
States:
  - expanded (default)
  - collapsed — toggleable via ▲/▼ button
Visual rules:
  - Gray/50 header background
  - Bullet dots = gray/400
  - Evidence text = gray/700, 11px
Behavior:
  - Collapsed by default on new trace selection
  - Expands on click
Use when: root_cause_card is visible
Do not use when: evidence array is empty
Maps to: evidence[] (Langfuse span metadata)
```

### `action_list`
```
Purpose: Presents recommended next actions after failure detection
Props:
  - suggestedActions: string[]   — ordered list, first = primary
  - onAction: function           — callback on button click
Visual rules:
  - All buttons identical style: white bg, gray/200 border, gray/700 text
  - No color hierarchy between actions
  - No primary/dark button distinction
  - Font-weight 400 for all
Behavior:
  - "Send to call supervisor" triggers alert with trace context
  - All other actions trigger generic confirmation
Use when: after root_cause_card renders
Maps to: suggested_actions (Langfuse eval output)
```

---

## 4. Design Tokens

Defined as Figma variable collection `Langfuse Tokens`. Read by Claude via MCP.

### Risk colors (semantic)
```
color/risk/low    = #e2483d   — CRITICAL severity, high risk
color/risk/medium = #f59e0b   — MEDIUM severity
color/risk/high   = #10b981   — Low risk / success
```

### Severity badge tokens
```
CRITICAL: bg=#fef2f2 (red/50)   border=#fecaca (red/200)   text=#e2483d
HIGH:     bg=#fff7ed (org/50)   border=#fed7aa (org/200)   text=#c2410c
MEDIUM:   bg=#fffbeb (amb/50)   border=#fde68a (amb/200)   text=#b45309
```

### Selected row backgrounds (severity-matched)
```
CRITICAL selected = #fff1f2   — lighter than red/50
HIGH selected     = #fff7ed   — orange/50
MEDIUM selected   = #fefce8   — lighter than amber/50
```

### Primary colors
```
blue primary  = #1d4ed8   — blue/700
blueBg        = #eef2ff   — indigo/50
blueBorder    = #c7d2fe   — indigo/200
```

### Grays
```
gray/50  = #f9fafb
gray/100 = #f3f4f6
gray/200 = #e5e7eb
gray/400 = #9ca3af
gray/500 = #6b7280
gray/700 = #374151
gray/900 = #111827
```

---

## 5. Layout Spec

### Desktop (1440px)
```
[Header 52px — full width]
[Left Nav 52px] [Sidebar 280px] [Title Bar — spans main+right] 
                               [Main Panel flex] [Right Panel 280px]
```

### Tablet (768–1100px)
```
[Header]
[Sidebar 280px] [Main Panel flex]
— left nav hidden, right panel hidden
```

### Mobile (<768px)
```
[Header]
[Trace list OR detail — not both]
— back button to switch views
```

---

## 6. Sidebar Row Spec

Each trace row in the sidebar renders in this exact order:

```
1. Trace name (bold)          + SEVERITY badge (right)
2. Failure type               (font-size 11, gray/700)
3. Low/High confidence · XX%  (amber/600 or green/600, no bg)
4. STATUS                     (plain ALL CAPS, gray/400, no badge)
```

**Selected row background = severity color (lighter tint)**

---

## 7. Right Panel Spec

```
SUGGESTED ACTIONS
  — 5 action buttons, all identical style (white, gray border)
  — No color hierarchy

[divider]

💡 Why these actions?
  — Amber/50 card with reasoning explanation
  — Left-aligned paragraph

[divider]

ESTIMATED IMPACT
  — Resolution time
  — Affected calls
  — Confidence boost (green text)

[divider]

◎ Ask about this failure
  — Blue card (indigo/50 bg)
  — Chat input inside the card
  — Messages render inside card
  — Send writes to Langfuse scores API (future: Claude API integration)
```

---

## 8. Data Spec

### Trace scenarios (mapped from Langfuse trace names)

| Trace name | Severity | Failure type |
|---|---|---|
| `intent-detection-v2` | CRITICAL | Intent misclassification |
| `sentiment-analysis` | HIGH | Sentiment detection failure |
| `appointment-scheduler` | CRITICAL | Scheduling conflict error |
| `call-summary-generator` | MEDIUM | Incomplete summary output |
| `escalation-detector` | CRITICAL | Missed escalation signal |
| `hallucination-detector` | HIGH | Hallucination in generated response |
| `rag-pipeline` | MEDIUM | Low retrieval relevance |
| `prompt-injection-guard` | CRITICAL | Prompt injection bypass |

### Langfuse API integration
```
Endpoint: GET /api/public/traces?limit=20
Auth:     Basic auth — btoa(publicKey + ":" + secretKey)
Host:     https://us.cloud.langfuse.com
Scores:   POST /api/public/scores
          { traceId, name: "human_feedback", value: 1 | -1 }
```

### Confidence score logic
```
score >= 0.7  → "High confidence"  → green (#16a34a)
score >= 0.4  → "Medium"           → amber
score < 0.4   → "Low confidence"   → amber (#d97706)

Confidence score = average of trace.scores[].value from Langfuse
Fallback = Math.random() * 0.5 if no scores exist
```

---

## 9. Human-in-the-Loop Spec

**Thumbs up/down on root_cause_card:**

```
Location: top-right of root_cause_card header row
Trigger:  user clicks 👍 or 👎
Action:   POST to Langfuse /api/public/scores
Payload:  { traceId: sel.id, name: "human_feedback", value: 1 or -1, 
            comment: "root_cause_accuracy" }
UI state: selected button gets severity-tinted background
Persistence: in-memory only (resets on trace change)
```

This closes the human-in-the-loop circle — Jason validates the AI diagnosis, feedback becomes a real Langfuse evaluation score.

---

## 10. What Good Looks Like

A successful trace investigation means Jason can:

1. Open the app and immediately see how many failures exist and their severity — without clicking anything
2. Select a trace and read the failure type in plain language — not a JSON key
3. Understand WHY the AI failed from the explanation — not infer it from spans
4. See supporting evidence without expanding raw logs
5. Know what to do next from suggested actions
6. Validate or reject the diagnosis with thumbs up/down
7. Escalate to a call supervisor without leaving the screen

**Definition of done:** A non-technical domain expert completes steps 1–7 in under 2 minutes without asking for help.
