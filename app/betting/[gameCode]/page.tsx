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

function formatOdds(value: number | null) {
  if (value === null || value === undefined) return "N/A";
  return value > 0 ? `+${value}` : `${value}`;
}

export default function BettingPage({ params }: { params: { gameCode: string } }) {
  const gameCode = params.gameCode.toUpperCase();
  const [board, setBoard] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingWinner, setPlacingWinner] = useState("");
  const [savingTop4, setSavingTop4] = useState(false);
  const [top4PickIds, setTop4PickIds] = useState<string[]>([]);

  const players = board?.players || [];
  const userPickId = board?.user_pick?.player_id || null;

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
      setTop4PickIds((data?.user_top4_picks || []).map((p: any) => p.player_id));
    }
    setLoading(false);
  }

  useEffect(() => { loadBoard(); }, [gameCode]);

  async function placeWinnerBet(playerId: string, playerName: string) {
    setError("");
    setMessage("");
    setPlacingWinner(playerId);

    const voterSecret = getOrCreateVoterToken(gameCode);
    const { data, error } = await supabase.rpc("place_survivor_winner_bet", {
      p_game_code: gameCode,
      p_player_id: playerId,
      p_voter_secret: voterSecret,
    });

    if (error) setError(error.message);
    else {
      setMessage(data || `Your winner pick is now ${playerName}.`);
      await loadBoard();
    }
    setPlacingWinner("");
  }

  function toggleTop4Pick(playerId: string) {
    setError("");
    setMessage("");

    setTop4PickIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      if (current.length >= 4) {
        setError("You can only pick 4 people to make the Top 4. Remove one first.");
        return current;
      }
      return [...current, playerId];
    });
  }

  async function saveTop4Picks() {
    setError("");
    setMessage("");
    setSavingTop4(true);

    const voterSecret = getOrCreateVoterToken(gameCode);
    const { data, error } = await supabase.rpc("set_survivor_top4_bets", {
      p_game_code: gameCode,
      p_player_ids: top4PickIds,
      p_voter_secret: voterSecret,
    });

    if (error) setError(error.message);
    else {
      setMessage(data || "Top 4 picks saved.");
      await loadBoard();
    }

    setSavingTop4(false);
  }

  if (loading) return <main className="page"><div className="container hero">Loading betting board...</div></main>;

  return (
    <main className="page">
      <div className="container hero">
        <h1>Betting Favorites</h1>
        <p>Game code: <strong>{gameCode}</strong></p>

        <div className="row">
          <Link className="button secondary" href={`/vote/${gameCode}`}>Back to Voting</Link>
          <Link className="button secondary" href={`/markets/${gameCode}`}>Odds Chart</Link>
          <button className="secondary" onClick={loadBoard}>Refresh Odds</button>
        </div>

        <div className="card">
          <h2>How the odds work</h2>
          <p className="small">
            Win odds are fair American odds rounded to the nearest 10. They are normalized to roughly 100% total implied probability.
            Fewer cumulative elimination votes help, more elimination votes hurt, immunity gives a modest temporary boost, and winner picks create a small momentum bump.
            Justin, Anthony, Maura, Kyan, Kyle, John, Megan, and Cole also have built-in starting nudges. If Maura or Kyan reach the final 3/4, they get a stronger host/friend-group late-game boost, with Maura favored over Kyan if both are alive.
          </p>
          {board?.user_pick ? <p>Your current winner pick: <strong>{board.user_pick.player_name}</strong></p> : <p className="small">Click a player below to make your winner pick. You can change it later.</p>}
        </div>

        <div className="card">
          <h2>Top 4 Picks</h2>
          <p className="small">
            Pick up to 4 people you think will make the Top 4. These picks stay saved until you change them.
          </p>
          <p><strong>{top4PickIds.length}/4 selected</strong>{selectedTop4Names ? ` — ${selectedTop4Names}` : ""}</p>
          <div className="row">
            <button onClick={saveTop4Picks} disabled={savingTop4}>{savingTop4 ? "Saving..." : "Save Top 4 Picks"}</button>
            <button className="secondary" onClick={() => setTop4PickIds([])}>Clear Top 4 Picks</button>
          </div>
        </div>

        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}

        <div className="grid">
          {players.map((p: any) => {
            const isTop4Pick = top4PickIds.includes(p.id);
            return (
              <div className="card favoriteCard" key={p.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0 }}>{p.name}</h2>
                  <div className="row">
                    {p.has_immunity && <span className="status">⭐ Immunity</span>}
                    {userPickId === p.id && <span className="status">Winner Pick</span>}
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
                  Top 4 picks: <strong>{p.top4_bet_count || 0}</strong> ({Number(p.top4_bet_share || 0).toFixed(2)}% of picks)
                </p>

                <div className="row">
                  <button onClick={() => placeWinnerBet(p.id, p.name)} disabled={placingWinner === p.id || p.is_eliminated}>
                    {userPickId === p.id ? "Keep Winner Pick" : "Pick to Win"}
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
