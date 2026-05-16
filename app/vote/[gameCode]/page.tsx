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

export default function VotePage({ params }: { params: { gameCode: string } }) {
  const gameCode = params.gameCode.toUpperCase();
  const [state, setState] = useState<any>(null);
  const [immunity, setImmunity] = useState<any>({ player_ids: [], players: [] });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadState() {
    setError("");
    const { data, error } = await supabase.rpc("get_survivor_game_state", {
      p_game_code: gameCode,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const { data: immunityData, error: immunityError } = await supabase.rpc("get_survivor_active_immunities", {
      p_game_code: gameCode,
    });

    if (immunityError) setError(immunityError.message);

    setState(data);
    setImmunity(immunityData || { player_ids: [], players: [] });
    setSelectedPlayerIds([]);
    setLoading(false);
  }

  useEffect(() => { loadState(); }, [gameCode]);

  function isImmune(playerId: string) {
    return (immunity?.player_ids || []).includes(playerId);
  }

  function togglePlayer(playerId: string) {
    if (isImmune(playerId)) return;

    const maxPicks = Number(state?.active_round?.eliminated_count || 1);
    setSelectedPlayerIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      if (current.length >= maxPicks) return current;
      return [...current, playerId];
    });
  }

  async function submitVote() {
    setError("");
    setMessage("");

    const activeRound = state?.active_round;
    const maxPicks = Number(activeRound?.eliminated_count || 1);

    if (!activeRound?.id) {
      setError("No open voting round right now.");
      return;
    }

    if (selectedPlayerIds.some((id) => isImmune(id))) {
      setError("A player with immunity cannot be voted for this round.");
      return;
    }

    if (selectedPlayerIds.length !== maxPicks) {
      setError(`Pick exactly ${maxPicks} player${maxPicks === 1 ? "" : "s"} before submitting.`);
      return;
    }

    setSubmitting(true);
    const voterSecret = getOrCreateVoterToken(gameCode);

    const { data, error } = await supabase.rpc("submit_survivor_votes", {
      p_game_code: gameCode,
      p_round_id: activeRound.id,
      p_player_ids: selectedPlayerIds,
      p_voter_secret: voterSecret,
    });

    if (error) setError(error.message);
    else setMessage(data || "Votes submitted.");

    setSubmitting(false);
  }

  if (loading) return <main className="page"><div className="container hero">Loading...</div></main>;

  const activeRound = state?.active_round;
  const players = state?.players || [];
  const maxPicks = Number(activeRound?.eliminated_count || 1);
  const immunePlayers = immunity?.players || [];

  return (
    <main className="page">
      <div className="container hero">
        <h1>{state?.game?.title || "Survivor Voting"}</h1>
        <p>Game code: <strong>{gameCode}</strong></p>

        <div className="row">
          <Link className="button secondary" href={`/betting/${gameCode}`}>Betting Favorites</Link>
        </div>

        {!activeRound && <div className="notice">Voting is not open right now. Wait for the host to start the next round.</div>}

        {activeRound && (
          <>
            <p><span className="status">Round {activeRound.round_number}</span> Pick exactly {maxPicks} player{maxPicks === 1 ? "" : "s"} to eliminate.</p>
            <p className="small">Selected {selectedPlayerIds.length} of {maxPicks}.</p>

            {immunePlayers.length > 0 && (
              <div className="notice">
                <strong>⭐ Immunity:</strong> {immunePlayers.map((p: any) => p.name).join(", ")} cannot be voted for this round.
              </div>
            )}

            <div className="grid">
              {players.map((player: any) => {
                const immune = isImmune(player.id);
                return (
                  <button
                    key={player.id}
                    className={selectedPlayerIds.includes(player.id) ? "playerButton selected" : "playerButton"}
                    onClick={() => togglePlayer(player.id)}
                    disabled={immune}
                    style={immune ? { opacity: 0.72, cursor: "not-allowed" } : undefined}
                  >
                    {player.name} {immune && <span>⭐ Immunity</span>}
                  </button>
                );
              })}
            </div>

            <div className="card">
              <button onClick={submitVote} disabled={submitting}>{submitting ? "Submitting..." : "Submit Vote"}</button>
              <button className="secondary" onClick={loadState} style={{ marginLeft: 10 }}>Refresh</button>
            </div>
          </>
        )}

        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}

        <p className="small">Voting is anonymous to the group, but each phone/browser can only vote once per round.</p>
      </div>
    </main>
  );
}
