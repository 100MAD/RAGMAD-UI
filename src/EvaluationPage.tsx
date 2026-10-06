import { ArrowLeftOutlined, BarChartOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Select, Spin, Table, Tag, Tooltip } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  evaluationGetOptions,
  evaluationLatestOptions,
  evaluationListOptions,
} from './client/@tanstack/react-query.gen.ts'
import type { EvaluationQuestionOut, EvaluationRunOut, MetricStatsOut } from './client/types.gen.ts'

const METRIC_COLORS = ['#1f4d45', '#3d7a6e', '#c4783a', '#8b5e3c', '#4a6670', '#9a3b32']

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  if (error instanceof Error) return error.message
  return 'Could not load evaluation results'
}

function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function scoreTone(value: number | null | undefined): string {
  if (value == null) return 'muted'
  if (value >= 0.85) return 'high'
  if (value >= 0.65) return 'mid'
  return 'low'
}

function metricEntries(metrics: Record<string, MetricStatsOut>) {
  return Object.entries(metrics).map(([key, stats]) => ({
    key,
    label: stats.label,
    mean: stats.mean,
    min: stats.min,
    max: stats.max,
  }))
}

function RadarChart({
  metrics,
}: {
  metrics: Array<{ key: string; label: string; mean: number }>
}) {
  const size = 280
  const center = size / 2
  const radius = 96
  const count = metrics.length
  if (count < 3) return null

  const points = metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
    const r = radius * Math.max(0, Math.min(1, metric.mean))
    return {
      ...metric,
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      labelX: center + Math.cos(angle) * (radius + 28),
      labelY: center + Math.sin(angle) * (radius + 28),
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
    }
  })

  const rings = [0.25, 0.5, 0.75, 1]
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <svg className="eval-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Metric radar chart">
      {rings.map((ring) => (
        <circle
          key={ring}
          cx={center}
          cy={center}
          r={radius * ring}
          fill="none"
          stroke="#e4ddd2"
          strokeWidth="1"
        />
      ))}
      {points.map((point) => (
        <line
          key={`axis-${point.key}`}
          x1={center}
          y1={center}
          x2={point.axisX}
          y2={point.axisY}
          stroke="#ddd4c8"
          strokeWidth="1"
        />
      ))}
      <polygon points={polygon} fill="rgba(31, 77, 69, 0.18)" stroke="#1f4d45" strokeWidth="2" />
      {points.map((point) => (
        <g key={point.key}>
          <circle cx={point.x} cy={point.y} r="4" fill="#1f4d45" />
          <text
            x={point.labelX}
            y={point.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="eval-radar-label"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function MetricBars({
  metrics,
}: {
  metrics: Array<{ key: string; label: string; mean: number; min: number; max: number }>
}) {
  return (
    <div className="eval-bars">
      {metrics.map((metric, index) => (
        <div key={metric.key} className="eval-bar-row">
          <div className="eval-bar-meta">
            <span>{metric.label}</span>
            <strong>{formatScore(metric.mean)}</strong>
          </div>
          <div className="eval-bar-track">
            <div
              className="eval-bar-fill"
              style={{
                width: `${Math.max(0, Math.min(1, metric.mean)) * 100}%`,
                background: METRIC_COLORS[index % METRIC_COLORS.length],
              }}
            />
            <span
              className="eval-bar-range"
              style={{ left: `${metric.min * 100}%`, width: `${Math.max(0, metric.max - metric.min) * 100}%` }}
              title={`min ${formatScore(metric.min)} · max ${formatScore(metric.max)}`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function QuestionScoreBars({ question }: { question: EvaluationQuestionOut }) {
  const scores = Object.entries(question.scores ?? {})
  if (!scores.length) return <span className="eval-muted">No scores</span>
  return (
    <div className="eval-mini-bars">
      {scores.map(([key, value], index) => (
        <Tooltip key={key} title={`${key}: ${formatScore(value)}`}>
          <div className="eval-mini-bar">
            <span className="eval-mini-label">{key.replace(/_/g, ' ').split(' ').slice(-1)[0]}</span>
            <div className="eval-mini-track">
              <div
                className="eval-mini-fill"
                style={{
                  width: `${Math.max(0, Math.min(1, value)) * 100}%`,
                  background: METRIC_COLORS[index % METRIC_COLORS.length],
                }}
              />
            </div>
            <span className={`eval-score-chip is-${scoreTone(value)}`}>{formatScore(value)}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  )
}

function RunView({ run }: { run: EvaluationRunOut }) {
  const metrics = useMemo(() => metricEntries(run.summary.metrics ?? {}), [run.summary.metrics])
  const overall = run.summary.overall_score
  const configBits = [
    run.config?.eval_model ? `Judge: ${String(run.config.eval_model)}` : null,
    run.config?.answer_model ? `Answer: ${String(run.config.answer_model)}` : null,
    run.config?.top_k != null ? `top-k ${String(run.config.top_k)}` : null,
    run.config?.chunk_tokens != null ? `chunk ${String(run.config.chunk_tokens)}` : null,
  ].filter(Boolean)

  return (
    <>
      <section className="eval-hero">
        <div className={`eval-overall is-${scoreTone(overall)}`}>
          <div className="eval-overall-label">Overall score</div>
          <div className="eval-overall-value">{formatScore(overall)}</div>
          <div className="eval-overall-sub">
            {run.summary.scored_count}/{run.summary.question_count} questions scored
          </div>
        </div>
        <div className="eval-hero-copy">
          <h2>RAG pipeline quality</h2>
          <p>
            Ragas metrics for faithfulness, answer relevancy, context precision, and context recall —
            judged by the evaluation LLM against the golden dataset.
          </p>
          <div className="eval-tags">
            {configBits.map((bit) => (
              <Tag key={String(bit)}>{bit}</Tag>
            ))}
            <Tag>{new Date(run.created_at).toLocaleString()}</Tag>
          </div>
        </div>
      </section>

      <section className="eval-charts">
        <div className="eval-panel">
          <h3>Metric averages</h3>
          <MetricBars metrics={metrics} />
        </div>
        <div className="eval-panel eval-panel-radar">
          <h3>Score profile</h3>
          {metrics.length >= 3 ? (
            <RadarChart metrics={metrics} />
          ) : (
            <Empty description="Need at least three scored metrics for the radar" />
          )}
        </div>
      </section>

      <section className="eval-panel">
        <div className="eval-panel-head">
          <h3>Per-question results</h3>
          <span className="eval-muted">Expand a row to compare the answer with the reference</span>
        </div>
        <Table
          rowKey={(_, index) => String(index)}
          pagination={false}
          dataSource={run.questions}
          expandable={{
            expandedRowRender: (row) => (
              <div className="eval-expand">
                <div>
                  <h4>Model answer</h4>
                  <p>{row.response}</p>
                </div>
                <div>
                  <h4>Reference</h4>
                  <p>{row.reference}</p>
                </div>
              </div>
            ),
          }}
          columns={[
            {
              title: '#',
              width: 56,
              render: (_value, _row, index) => index + 1,
            },
            {
              title: 'Question',
              dataIndex: 'question',
              render: (value: string) => <span className="eval-question">{value}</span>,
            },
            {
              title: 'Scores',
              width: 360,
              render: (_value, row) => <QuestionScoreBars question={row} />,
            },
            {
              title: 'Avg',
              width: 72,
              render: (_value, row) => {
                const values = Object.values(row.scores ?? {})
                const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
                return <span className={`eval-score-chip is-${scoreTone(avg)}`}>{formatScore(avg)}</span>
              },
            },
          ]}
        />
      </section>
    </>
  )
}

export default function EvaluationPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const runs = useQuery(evaluationListOptions())
  const latest = useQuery({
    ...evaluationLatestOptions(),
    enabled: !selectedId,
  })
  const selected = useQuery({
    ...evaluationGetOptions({ path: { run_id: selectedId ?? '' } }),
    enabled: Boolean(selectedId),
  })

  const active = selectedId ? selected : latest
  const run = active.data
  const loading = runs.isLoading || active.isLoading
  const error = runs.error ?? active.error

  return (
    <div className="workspace eval-workspace">
      <aside className="sidebar" style={{ width: 260 }}>
        <Link to="/" className="sidebar-brand eval-brand-link">
          <span className="brand-mark">R</span>
          <div>
            <div className="brand-name">RAGMAD</div>
            <div className="brand-sub">System evaluation</div>
          </div>
        </Link>
        <Link to="/" className="eval-nav-link">
          <ArrowLeftOutlined /> Back to chats
        </Link>
        <div className="eval-nav-active">
          <BarChartOutlined /> Evaluation
        </div>
        <div className="eval-run-picker">
          <div className="eval-run-label">Runs</div>
          <Select
            className="eval-run-select"
            placeholder="Latest run"
            allowClear
            value={selectedId}
            onChange={(value) => setSelectedId(value)}
            options={(runs.data ?? []).map((item) => ({
              value: item.id,
              label: `${new Date(item.created_at).toLocaleString()} · ${formatScore(item.summary.overall_score)}`,
            }))}
          />
        </div>
      </aside>

      <section className="stage eval-stage">
        <header className="topbar">
          <h1 className="chat-title">Evaluation</h1>
          <div className="topbar-actions">
            <Button
              className="quiet-button"
              icon={<ReloadOutlined />}
              onClick={() => {
                void runs.refetch()
                void active.refetch()
              }}
            >
              Refresh
            </Button>
          </div>
        </header>

        <div className="eval-content">
          {loading ? (
            <div className="eval-center">
              <Spin size="large" />
            </div>
          ) : error ? (
            <Alert
              type="warning"
              showIcon
              message="No evaluation results yet"
              description={errorText(error)}
            />
          ) : run ? (
            <RunView run={run} />
          ) : (
            <Empty description="Run scripts/evaluate.py to generate results" />
          )}
        </div>
      </section>
    </div>
  )
}
