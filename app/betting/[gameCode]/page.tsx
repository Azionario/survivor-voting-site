"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [placing, setPlacing] = useState("");

  async function loadBoard() {
    setError("");
    const voterSecret = getOrCreateVoterToken(gameCode);
    const { data, error } = await supabase.rpc("get_survivor_betting_board", {
      p_game_code: gameCode,
      p_voter_secret: voterSecret,
    });

    if (error) setError(error.message);
    else setBoard(data);
    setLoading(false);
  }

  useEffect(() => { loadBoard(); }, [gameCode]);

  async function placeBet(playerId: string, playerName: string) {
    setError("");
    setMessage("");
    setPlacing(playerId);

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
    setPlacing("");
  }

  if (loading) return <main className="page"><div className="container hero">Loading betting board...</div></main>;

  const players = board?.players || [];
  const userPickId = board?.user_pick?.player_id || null;

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
          <h2>How the odds work</h2>
          <p className="small">
            These are fair American odds with no vig. Every active player's implied probability is normalized to add up to 100%.
            Players with fewer cumulative elimination votes become stronger favorites. Players receiving more votes become longer shots.
          </p>
          {board?.user_pick ? <p>Your current winner pick: <strong>{board.user_pick.player_name}</strong></p> : <p className="small">Click a player below to make your winner pick. You can change it later.</p>}
        </div>

        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}

        <div className="grid">
          {players.map((p: any) => (
            <div className="card favoriteCard" key={p.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>{p.name}</h2>
                {userPickId === p.id && <span className="status">Your Pick</span>}
              </div>

              <div className="oddsNumber">{formatOdds(p.american_odds)}</div>

              <div className="barTrack">
                <div className="barFill" style={{ width: `${Math.max(0, Math.min(100, Number(p.implied_probability || 0)))}%` }} />
              </div>

              <p className="small">
                Implied win probability: <strong>{Number(p.implied_probability || 0).toFixed(2)}%</strong><br />
                Cumulative elimination votes: <strong>{p.total_votes_received}</strong>
              </p>

              <button onClick={() => placeBet(p.id, p.name)} disabled={placing === p.id || p.is_eliminated}>
                {userPickId === p.id ? "Keep as My Pick" : "Pick to Win"}
              </button>
            </div>
          ))}
        </div>

        {players.length === 0 && <div className="notice">No active players are available for betting.</div>}
      </div>
    </main>
  );
}
