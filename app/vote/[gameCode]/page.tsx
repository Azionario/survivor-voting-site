"use client";

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
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
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
    } else {
      setState(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadState();
  }, [gameCode]);

  async function submitVote() {
    setError("");
    setMessage("");

    if (!selectedPlayerId) {
      setError("Pick someone before submitting.");
      return;
    }

    const activeRound = state?.active_round;
    if (!activeRound?.id) {
      setError("No open voting round right now.");
      return;
    }

    setSubmitting(true);
    const voterSecret = getOrCreateVoterToken(gameCode);

    const { data, error } = await supabase.rpc("submit_survivor_vote", {
      p_game_code: gameCode,
      p_round_id: activeRound.id,
      p_player_id: selectedPlayerId,
      p_voter_secret: voterSecret,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(data || "Vote submitted.");
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="page">
        <div className="container hero">Loading...</div>
      </main>
    );
  }

  const activeRound = state?.active_round;
  const players = state?.players || [];

  return (
    <main className="page">
      <div className="container hero">
        <h1>{state?.game?.title || "Survivor Voting"}</h1>
        <p>
          Game code: <strong>{gameCode}</strong>
        </p>

        {!activeRound && (
          <div className="notice">
            Voting is not open right now. Wait for the host to start the next round.
          </div>
        )}

        {activeRound && (
          <>
            <p>
              <span className="status">Round {activeRound.round_number}</span>{" "}
              Vote for one person to eliminate.
            </p>
            <p className="small">
              This round eliminates {activeRound.eliminated_count} player
              {activeRound.eliminated_count === 1 ? "" : "s"}.
            </p>

            <div className="grid">
              {players.map((player: any) => (
                <button
                  key={player.id}
                  className={
                    selectedPlayerId === player.id
                      ? "playerButton selected"
                      : "playerButton"
                  }
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  {player.name}
                </button>
              ))}
            </div>

            <div className="card">
              <button onClick={submitVote} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Vote"}
              </button>
              <button className="secondary" onClick={loadState} style={{ marginLeft: 10 }}>
                Refresh
              </button>
            </div>
          </>
        )}

        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}

        <p className="small">
          Voting is anonymous to the group, but each phone/browser can only vote once per round.
        </p>
      </div>
    </main>
  );
}
