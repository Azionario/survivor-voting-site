"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function getOrCreateVoterToken(gameCode: string) {
  const key = `survivor-voter-token-${gameCode}`;
  let token = window.localStorage.getItem(key);
  if (!token) {
    token = `${Date.now()}-${crypto.randomUUID()}`;
    window.localStorage.setItem(key, token);
  }
  return token;
}

function getStoredName(gameCode: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(`survivor-voter-name-${gameCode}`) || "";
}

function storeName(gameCode: string, name: string) {
  window.localStorage.setItem(`survivor-voter-name-${gameCode}`, name);
}

function formatOdds(value: number | null) {
  if (value === null || value === undefined) return "N/A";
  return value > 0 ? `+${value}` : `${value}`;
}

export default function BettingPage({ params }: { params: { gameCode: string } }) {
  const gameCode = params.gameCode.toUpperCase();
  const [board, setBoard] = useState<any>(null);
  const [voterName, setVoterName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPicks, setSavingPicks] = useState(false);
  const [winnerPickId, setWinnerPickId] = useState<string>("");
  const [top4PickIds, setTop4PickIds] = useState<string[]>([]);

  const players = board?.players || [];

  const selectedWinnerName = useMemo(() => {
    return players.find((p: any) => p.id === winnerPickId)?.name || "";
  }, [winnerPickId, players]);

  const selectedTop4Names = useMemo(() => {
    return top4PickIds
      .map((id) => players.find((p: any) => p.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }, [top4PickIds, players]);

  async function loadBoard() {
    setError("");
    const voterSecret = getOrCreateVoterToken(gameCode);
    const { data, error } = await supabase.rpc("get_survivor_betting_board", {
      p_game_code: gameCode,
      p_voter_secret: voterSecret,
    });

    if (error) setError(error.message);
    else {
      setBoard(data);
      setWinnerPickId(data?.user_pick?.player_id || "");
      setTop4PickIds((data?.user_top4_picks || []).map((p: any) => p.player_id));

      const savedLocalName = getStoredName(gameCode);
      const savedServerName = data?.user_name || "";
      setVoterName(savedLocalName || savedServerName || "");
    }
    setLoading(false);
  }

  useEffect(() => { loadBoard(); }, [gameCode]);

  function chooseWinner(playerId: string) {
    setError("");
    setMessage("");
    setWinnerPickId(playerId);
  }

  function toggleTop4Pick(playerId: string) {
    setError("");
    setMessage("");

    setTop4PickIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      if (current.length >= 4) {
        setError("You already picked 4 people for Top 4. Remove one first.");
        return current;
      }
      return [...current, playerId];
    });
  }

  async function saveAllPicks() {
    setError("");
    setMessage("");

    if (!voterName.trim()) {
      setError("Enter your name first so the host can track prize results.");
      return;
    }

    if (!winnerPickId) {
      setError("Pick one winner before saving.");
      return;
    }

    if (top4PickIds.length !== 4) {
      setError("Pick exactly 4 people to make Top 4 before saving.");
      return;
    }

    if (!top4PickIds.includes(winnerPickId)) {
      setError("Your winner pick has to be included in your Top 4 picks.");
      return;
    }

    setSavingPicks(true);
    const voterSecret = getOrCreateVoterToken(gameCode);
    storeName(gameCode, voterName.trim());

    const result = await supabase.rpc("save_survivor_betting_picks", {
      p_game_code: gameCode,
      p_voter_secret: voterSecret,
      p_voter_name: voterName.trim(),
      p_winner_player_id: winnerPickId,
      p_top4_player_ids: top4PickIds,
    });

    if (result.error) {
      setError(result.error.message);
      setSavingPicks(false);
      return;
    }

    setMessage(`Saved picks for ${voterName.trim()}: ${selectedWinnerName || "winner"} to win, plus your Top 4.`);
    await loadBoard();
    setSavingPicks(false);
  }

  if (loading) return <main className="page"><div className="container hero">Loading betting board...</div></main>;

  return (
    <main className="page">
      <div className="container hero">
        <h1>Betting Favorites</h1>
        <p>Game code: <strong>{gameCode}</strong></p>

        <div className="row">
          <Link className="button secondary" href={`/vote/${gameCode}`}>Back to Voting</Link>
          <button className="secondary" onClick={loadBoard}>Refresh Odds</button>
        </div>

        <div className="card">
          <h2>Make Your Picks</h2>

          <label>
            <span className="small">Your name for prize tracking</span>
            <input
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
              placeholder="Enter your name"
              maxLength={60}
            />
          </label>

          <p>Winner pick: <strong>{selectedWinnerName || "None selected"}</strong></p>
          <p>Top 4 picks: <strong>{top4PickIds.length}/4 selected</strong>{selectedTop4Names ? ` — ${selectedTop4Names}` : ""}</p>

          <div className="row">
            <button onClick={saveAllPicks} disabled={savingPicks}>{savingPicks ? "Saving..." : "Save Winner + Top 4 Picks"}</button>
            <button className="secondary" onClick={() => { setWinnerPickId(""); setTop4PickIds([]); }}>Clear Unsaved Picks</button>
          </div>
        </div>

        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}

        <div className="grid">
          {players.map((p: any) => {
            const isTop4Pick = top4PickIds.includes(p.id);
            const isWinnerPick = winnerPickId === p.id;
            return (
              <div className="card favoriteCard" key={p.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0 }}>{p.name}</h2>
                  <div className="row">
                    {p.has_immunity && <span className="status">⭐ Immunity</span>}
                    {isWinnerPick && <span className="status">Winner Pick</span>}
                    {isTop4Pick && <span className="status">Top 4 Pick</span>}
                  </div>
                </div>

                <div className="oddsSplit">
                  <div>
                    <div className="small">To Win</div>
                    <div className="oddsNumber">{formatOdds(p.american_odds)}</div>
                    <div className="barTrack">
                      <div className="barFill" style={{ width: `${Math.max(0, Math.min(100, Number(p.implied_probability || 0)))}%` }} />
                    </div>
                    <p className="small"><strong>{Number(p.implied_probability || 0).toFixed(2)}%</strong> implied</p>
                  </div>

                  <div>
                    <div className="small">Make Top 4</div>
                    <div className="oddsNumber">{formatOdds(p.top4_american_odds)}</div>
                    <div className="barTrack">
                      <div className="barFill" style={{ width: `${Math.max(0, Math.min(100, Number(p.top4_implied_probability || 0)))}%` }} />
                    </div>
                    <p className="small"><strong>{Number(p.top4_implied_probability || 0).toFixed(2)}%</strong> implied</p>
                  </div>
                </div>

                <p className="small">
                  Cumulative elimination votes: <strong>{p.total_votes_received}</strong><br />
                  Winner bets: <strong>{p.winner_bet_count || 0}</strong> ({Number(p.winner_bet_share || 0).toFixed(2)}%)<br />
                  Top 4 picks: <strong>{p.top4_bet_count || 0}</strong> ({Number(p.top4_bet_share || 0).toFixed(2)}% pick rate)
                </p>

                <div className="row">
                  <button onClick={() => chooseWinner(p.id)} disabled={p.is_eliminated} className={isWinnerPick ? "secondary" : ""}>
                    {isWinnerPick ? "Winner Selected" : "Pick to Win"}
                  </button>
                  <button className={isTop4Pick ? "secondary" : ""} onClick={() => toggleTop4Pick(p.id)} disabled={p.is_eliminated}>
                    {isTop4Pick ? "Remove Top 4" : "Pick Top 4"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {players.length === 0 && <div className="notice">No active players are available for betting.</div>}
      </div>
    </main>
  );
}
