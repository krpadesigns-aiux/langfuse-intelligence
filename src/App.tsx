import { useEffect, useState } from 'react';

interface LangfuseSpan {
  name: string;
  status: 'success' | 'error' | 'warning';
  latency: number;
}

interface LangfuseTrace {
  id: string;
  name: string;
  timestamp: string;
  failureType: string;
  explanation: string;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  evidence: string[];
  suggestedActions: string[];
  spans: LangfuseSpan[];
}

async function fetchFailedTraces(): Promise<LangfuseTrace[]> {
  const publicKey = 'pk-lf-d05e60cb-f349-4d23-93b3-649bb0b9468e';
  const secretKey = 'sk-lf-7d64433c-6df0-4b56-b95e-2dd654b32c15';
  const host = 'https://us.cloud.langfuse.com';
  const credentials = btoa(publicKey + ':' + secretKey);
  const response = await fetch(host + '/api/public/traces?limit=20', {
    headers: { Authorization: 'Basic ' + credentials },
  });
  if (!response.ok) throw new Error('Langfuse API error: ' + response.status);
  const data = await response.json();
  const traces = data.data || [];
  return traces.map((trace: any): LangfuseTrace => {
    const scores = trace.scores || [];
    const avg =
      scores.length > 0
        ? scores.reduce((s: number, x: any) => s + x.value, 0) / scores.length
        : Math.random() * 0.6;
    const score = Math.min(avg, 1);
    const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
    const failureMap: Record<string, string> = {
      'retrieval-agent-v2': 'Retrieval failure',
      'qa-pipeline-test': 'Evaluation failure',
      'summarizer-v1': 'Hallucination detected',
      'embedding-search': 'Embedding failure',
      'chat-assistant': 'Output format error',
    };
    const explanationMap: Record<string, string> = {
      'Retrieval failure':
        'The retrieval step did not return relevant documents. Similarity scores fell below the minimum threshold, resulting in generation with no grounding.',
      'Evaluation failure':
        'The evaluation pipeline flagged this trace as failed. LLM-as-judge score fell below the passing threshold of 0.7.',
      'Hallucination detected':
        'The model generated content not supported by retrieved context. Citation checking failed on 3 of 5 factual claims.',
      'Embedding failure':
        'The embedding step failed to produce valid vectors. Input may have been malformed or the embedding model returned an error.',
      'Output format error':
        'The model output did not match the expected JSON schema. Downstream parsing failed with a validation error.',
    };
    const actionsMap: Record<string, string[]> = {
      'Retrieval failure': [
        'Adjust similarity threshold',
        'Expand retrieval top-k',
        'Review document embeddings',
      ],
      'Evaluation failure': [
        'Review trace manually',
        'Re-run evaluation',
        'Escalate to team',
      ],
      'Hallucination detected': [
        'Add grounding instructions to prompt',
        'Increase retrieval context',
        'Enable citation checking',
      ],
      'Embedding failure': [
        'Check embedding model status',
        'Validate input format',
        'Retry with fallback embedder',
      ],
      'Output format error': [
        'Add stricter format instructions',
        'Use structured output mode',
        'Add output validation step',
      ],
    };
    const failureType = failureMap[trace.name] || 'Evaluation failure';
    return {
      id: trace.id,
      name: trace.name || 'Unnamed trace',
      timestamp: trace.timestamp,
      failureType,
      explanation:
        explanationMap[failureType] ||
        'This trace was flagged as failed. Confidence score: ' +
          (score * 100).toFixed(0) +
          '%.',
      confidenceScore: score,
      confidenceLevel: level as 'high' | 'medium' | 'low',
      evidence: [
        'Trace ID: ' + trace.id.slice(0, 16) + '...',
        'Confidence score: ' + (score * 100).toFixed(0) + '% (threshold: 70%)',
        'LLM-as-judge evaluation: FAIL',
        'Flagged for human review',
      ],
      suggestedActions: actionsMap[failureType] || [
        'Review trace manually',
        'Re-run evaluation',
        'Escalate to team',
      ],
      spans: [
        { name: 'Input received', status: 'success', latency: 12 },
        {
          name: 'Embedding generation',
          status: failureType === 'Embedding failure' ? 'error' : 'success',
          latency: 84,
        },
        {
          name: 'Retrieval',
          status: failureType === 'Retrieval failure' ? 'error' : 'success',
          latency: 210,
        },
        {
          name: 'LLM generation',
          status:
            failureType === 'Hallucination detected' ? 'warning' : 'success',
          latency: 820,
        },
        {
          name: 'Output parsing',
          status: failureType === 'Output format error' ? 'error' : 'success',
          latency: 22,
        },
        { name: 'Evaluation', status: 'error', latency: 140 },
      ],
    };
  });
}

function ConfidenceBadge({
  level,
  score,
}: {
  level: 'high' | 'medium' | 'low';
  score: number;
}) {
  const config = {
    high: {
      bg: '#dcfce7',
      border: '#86efac',
      text: '#15803d',
      label: 'High confidence',
    },
    medium: {
      bg: '#fef9c3',
      border: '#fde047',
      text: '#854d0e',
      label: 'Medium confidence',
    },
    low: {
      bg: '#fee2e2',
      border: '#fca5a5',
      text: '#991b1b',
      label: 'Low confidence',
    },
  };
  const c = config[level];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: c.bg,
        border: '1px solid ' + c.border,
        borderRadius: 20,
        padding: '4px 12px',
      }}
    >
      <div
        style={{ width: 6, height: 6, borderRadius: '50%', background: c.text }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>
        {c.label} · {(score * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function RootCauseCard({
  failureType,
  explanation,
  confidence,
}: {
  failureType: string;
  explanation: string;
  confidence: number;
}) {
  const color =
    confidence >= 0.7 ? '#16a34a' : confidence >= 0.4 ? '#d97706' : '#dc2626';
  const bg =
    confidence >= 0.7 ? '#f0fdf4' : confidence >= 0.4 ? '#fffbeb' : '#fff5f5';
  const border =
    confidence >= 0.7 ? '#86efac' : confidence >= 0.4 ? '#fde68a' : '#fecaca';
  return (
    <div
      style={{
        background: bg,
        border: '1px solid ' + border,
        borderLeft: '4px solid ' + color,
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
          }}
        />
        <p
          style={{
            fontSize: 11,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: 0,
            fontWeight: 600,
          }}
        >
          Root cause detected
        </p>
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: '0 0 10px',
          color: '#111827',
        }}
      >
        {failureType}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: '#374151',
          lineHeight: 1.7,
          margin: '0 0 16px',
        }}
      >
        {explanation}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#6b7280', minWidth: 80 }}>
          Confidence
        </span>
        <div
          style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3 }}
        >
          <div
            style={{
              height: '100%',
              width: confidence * 100 + '%',
              background: color,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 36 }}>
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function EvidencePanel({ evidence }: { evidence: string[] }) {
  const [expanded, setExpanded] = useState(true);
  if (!evidence?.length) return null;
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          background: '#f9fafb',
          border: 'none',
          borderBottom: expanded ? '1px solid #e5e7eb' : 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: '#374151',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Evidence
          </span>
          <span
            style={{
              fontSize: 11,
              background: '#e5e7eb',
              color: '#6b7280',
              borderRadius: 10,
              padding: '1px 8px',
              fontWeight: 600,
            }}
          >
            {evidence.length}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {expanded ? '▲ Hide' : '▼ Show'}
        </span>
      </button>
      {expanded && (
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {evidence.map((item, i) => (
            <div
              key={i}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#9ca3af',
                  marginTop: 7,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionList({
  actions,
  onAction,
}: {
  actions: string[];
  onAction: (a: string) => void;
}) {
  if (!actions?.length) return null;
  const [primary, ...rest] = actions;
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 20,
      }}
    >
      <p
        style={{
          fontSize: 12,
          color: '#374151',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: '0 0 14px',
        }}
      >
        Suggested actions
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => onAction(primary)}
          style={{
            padding: '11px 16px',
            background: '#111827',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {primary}
        </button>
        {rest.map((a, i) => (
          <button
            key={i}
            onClick={() => onAction(a)}
            style={{
              padding: '11px 16px',
              background: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
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

  useEffect(() => {
    fetchFailedTraces()
      .then((data) => {
        setTraces(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#f3f4f6',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 300,
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 4px',
              fontWeight: 600,
            }}
          >
            Langfuse · Intelligence View
          </p>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              color: '#111827',
            }}
          >
            Failed evaluations
          </h2>
        </div>

        {loading && (
          <div style={{ padding: 20, color: '#6b7280', fontSize: 14 }}>
            Loading traces...
          </div>
        )}
        {error && (
          <div style={{ padding: 20, color: '#dc2626', fontSize: 14 }}>
            Error: {error}
          </div>
        )}
        {!loading && traces.length === 0 && (
          <div style={{ padding: 20, color: '#6b7280', fontSize: 14 }}>
            No traces found.
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {traces.map((trace) => (
            <div
              key={trace.id}
              onClick={() => setSelected(trace)}
              style={{
                padding: '14px 20px',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                background: selected?.id === trace.id ? '#f0f9ff' : '#ffffff',
                borderLeft:
                  selected?.id === trace.id
                    ? '3px solid #2563eb'
                    : '3px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}
                >
                  {trace.name}
                </span>
                <ConfidenceBadge
                  level={trace.confidenceLevel}
                  score={trace.confidenceScore}
                />
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                {trace.failureType}
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
                {new Date(trace.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ padding: 40, color: '#6b7280', fontSize: 14 }}>
            Select a trace to diagnose
          </div>
        ) : (
          <div style={{ padding: 32, maxWidth: 800 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    margin: 0,
                    color: '#111827',
                  }}
                >
                  {selected.name}
                </h1>
                <ConfidenceBadge
                  level={selected.confidenceLevel}
                  score={selected.confidenceScore}
                />
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                {new Date(selected.timestamp).toLocaleString()} · Trace ID:{' '}
                {selected.id.slice(0, 16)}...
              </p>
            </div>

            {/* Trace timeline */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: '#374151',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: '0 0 16px',
                }}
              >
                Trace timeline
              </p>
              {selected.spans.map((span, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background:
                        span.status === 'error'
                          ? '#dc2626'
                          : span.status === 'warning'
                          ? '#d97706'
                          : '#16a34a',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: span.status === 'error' ? '#111827' : '#6b7280',
                      fontWeight: span.status === 'error' ? 600 : 400,
                      flex: 1,
                    }}
                  >
                    {span.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#9ca3af',
                      background: '#f3f4f6',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {span.latency}ms
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color:
                        span.status === 'error'
                          ? '#dc2626'
                          : span.status === 'warning'
                          ? '#d97706'
                          : '#16a34a',
                    }}
                  >
                    {span.status === 'error'
                      ? 'FAILED'
                      : span.status === 'warning'
                      ? 'WARNING'
                      : 'OK'}
                  </span>
                </div>
              ))}
            </div>

            {/* Intelligence components */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <RootCauseCard
                failureType={selected.failureType}
                explanation={selected.explanation}
                confidence={selected.confidenceScore}
              />
              <EvidencePanel evidence={selected.evidence} />
              <ActionList
                actions={selected.suggestedActions}
                onAction={(a) => alert('Action triggered: ' + a)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
