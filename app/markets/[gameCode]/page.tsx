"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const COLORS = [
  "#facc15", "#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#fb923c",
  "#22d3ee", "#ef4444", "#84cc16", "#e879f9", "#38bdf8", "#fde68a",
];

function formatOdds(value: number | null) {
  if (value === null || value === undefined) return "N/A";
  return value > 0 ? `+${value}` : `${value}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function MarketsPage({ params }: { params: { gameCode: string } }) {
  const gameCode = params.gameCode.toUpperCase();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  async function loadHistory() {
    setError("");
    setLoading(true);
    const { data, error } = await supabase.rpc("get_survivor_odds_history", {
      p_game_code: gameCode,
    });
    if (error) setError(error.message);
    else setData(data);
    setLoading(false);
  }

  useEffect(() => { loadHistory(); }, [gameCode]);

  const players = data?.players || [];
  const rounds = data?.rounds || [];

  const latestRows = useMemo(() => {
    return players
      .map((p: any, index: number) => {
        const last = p.points?.[p.points.length - 1] || null;
        const prev = p.points?.[p.points.length - 2] || null;
        const change = last && prev ? Number(last.implied_probability || 0) - Number(prev.implied_probability || 0) : 0;
        return { ...p, color: COLORS[index % COLORS.length], last, change };
      })
      .sort((a: any, b: any) => Number(b.last?.implied_probability || 0) - Number(a.last?.implied_probability || 0));
  }, [players]);

  const width = 980;
  const height = 430;
  const padLeft = 56;
  const padRight = 36;
  const padTop = 28;
  const padBottom = 54;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const denom = Math.max(1, rounds.length - 1);

  function xFor(i: number) {
    return padLeft + (i / denom) * innerW;
  }

  function yFor(probability: number) {
    return padTop + (1 - clamp(probability, 0, 100) / 100) * innerH;
  }

  if (loading) return <main className="page"><div className="container hero">Loading odds chart...</div></main>;

  return (
    <main className="page">
      <div className="container hero">
        <h1>Survivor Odds Chart</h1>
        <p>Game code: <strong>{gameCode}</strong></p>

        <div className="row">
          <Link className="button secondary" href={`/betting/${gameCode}`}>Betting Favorites</Link>
          <Link className="button secondary" href={`/vote/${gameCode}`}>Voting Page</Link>
          <button className="secondary" onClick={loadHistory}>Refresh Chart</button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="card marketChartCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2>Win Probability Over Time</h2>
              <p className="small">Lines move each round based on cumulative negative votes, eliminations, immunity, and built-in boosts. Eliminated players drop to 0%.</p>
            </div>
            <div className="status">Prediction-style view</div>
          </div>

          <div className="chartScroller">
            <svg viewBox={`0 0 ${width} ${height}`} className="marketSvg" role="img" aria-label="Survivor odds chart">
              {[0, 25, 50, 75, 100].map((y) => (
                <g key={y}>
                  <line x1={padLeft} x2={width - padRight} y1={yFor(y)} y2={yFor(y)} className="gridLine" />
                  <text x={12} y={yFor(y) + 5} className="axisText">{y}%</text>
                </g>
              ))}

              {rounds.map((r: any, i: number) => (
                <g key={`${r.label}-${i}`}>
                  <line x1={xFor(i)} x2={xFor(i)} y1={padTop} y2={height - padBottom} className="roundLine" />
                  <text x={xFor(i)} y={height - 18} textAnchor="middle" className="axisText">{r.label}</text>
                </g>
              ))}

              {players.map((p: any, index: number) => {
                const color = COLORS[index % COLORS.length];
                const points = (p.points || []).map((pt: any, i: number) => `${xFor(i)},${yFor(Number(pt.implied_probability || 0))}`).join(" ");
                const faded = highlighted && highlighted !== p.id;
                return (
                  <polyline
                    key={p.id}
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth={highlighted === p.id ? 5 : 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={faded ? 0.18 : 0.95}
                  />
                );
              })}

              {players.map((p: any, index: number) => {
                const color = COLORS[index % COLORS.length];
                const lastIndex = Math.max(0, (p.points || []).length - 1);
                const last = p.points?.[lastIndex];
                if (!last) return null;
                const faded = highlighted && highlighted !== p.id;
                return (
                  <circle
                    key={`${p.id}-dot`}
                    cx={xFor(lastIndex)}
                    cy={yFor(Number(last.implied_probability || 0))}
                    r={highlighted === p.id ? 6 : 4}
                    fill={color}
                    opacity={faded ? 0.18 : 1}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        <div className="grid legendGrid">
          {latestRows.map((p: any) => {
            const prob = Number(p.last?.implied_probability || 0);
            const change = Number(p.change || 0);
            return (
              <button
                key={p.id}
                className={`legendCard ${highlighted === p.id ? "legendCardActive" : ""}`}
                onClick={() => setHighlighted(highlighted === p.id ? null : p.id)}
              >
                <span className="legendColor" style={{ background: p.color }} />
                <span className="legendName">{p.name}</span>
                <span className="legendOdds">{prob.toFixed(2)}%</span>
                <span className={`legendChange ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%</span>
                <span className="small">{formatOdds(p.last?.american_odds)}</span>
              </button>
            );
          })}
        </div>

        {players.length === 0 && <div className="notice">No player odds are available yet.</div>}
      </div>
    </main>
  );
}
