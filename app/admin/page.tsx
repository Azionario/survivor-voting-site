"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const [gameCode, setGameCode] = useState("SURVIVOR");
  const [pin, setPin] = useState("1234");
  const [state, setState] = useState<any>(null);
  const [newPlayer, setNewPlayer] = useState("");
  const [eliminatedCount, setEliminatedCount] = useState(1);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const latestRound = useMemo(() => {
    return state?.rounds?.[0] || null;
  }, [state]);

  async function loadAdminState() {
    setError("");
    setMessage("");
    const { data, error } = await supabase.rpc("get_survivor_admin_state", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setState(data);
    const firstRound = data?.rounds?.[0]?.id || "";
    setSelectedRoundId((current) => current || firstRound);
  }

  async function addPlayer() {
    setError("");
    setMessage("");
    if (!newPlayer.trim()) return;

    const { error } = await supabase.rpc("add_survivor_player", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_player_name: newPlayer.trim(),
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNewPlayer("");
    setMessage("Player added.");
    await loadAdminState();
  }

  async function startRound() {
    setError("");
    setMessage("");

    const { data, error } = await supabase.rpc("start_survivor_round", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_eliminated_count: Number(eliminatedCount),
    });

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Round started.");
    setSelectedRoundId(data);
    await loadAdminState();
  }

  async function lockRound(roundId: string) {
    const { error } = await supabase.rpc("lock_survivor_round", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_round_id: roundId,
    });

    if (error) setError(error.message);
    else {
      setMessage("Voting locked.");
      await loadAdminState();
    }
  }

  async function revealRound(roundId: string) {
    const { error } = await supabase.rpc("reveal_survivor_round", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_round_id: roundId,
    });

    if (error) setError(error.message);
    else {
      setMessage("Results revealed.");
      await loadAdminState();
    }
  }

  async function reopenRound(roundId: string) {
    const { error } = await supabase.rpc("reopen_survivor_round", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_round_id: roundId,
    });

    if (error) setError(error.message);
    else {
      setMessage("Round reopened.");
      await loadAdminState();
    }
  }

  async function getResults(roundId = selectedRoundId) {
    setError("");
    setMessage("");

    if (!roundId) {
      setError("Pick a round first.");
      return;
    }

    const { data, error } = await supabase.rpc("get_survivor_admin_results", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_round_id: roundId,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setResults(data || []);
  }

  async function eliminateTopPlayers() {
    const round = state?.rounds?.find((r: any) => r.id === selectedRoundId);
    if (!round) {
      setError("Pick a round first.");
      return;
    }

    const top = [...results]
      .sort((a, b) => Number(b.vote_count) - Number(a.vote_count))
      .slice(0, round.eliminated_count)
      .map((r) => r.player_id);

    if (!top.length) {
      setError("Load results first.");
      return;
    }

    const { error } = await supabase.rpc("mark_survivor_players_eliminated", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_player_ids: top,
      p_round_id: selectedRoundId,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Top vote-getters marked eliminated.");
    await loadAdminState();
  }

  const voteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/vote/${gameCode.toUpperCase()}`
      : `/vote/${gameCode.toUpperCase()}`;

  const resultsUrl =
    typeof window !== "undefined" && selectedRoundId
      ? `${window.location.origin}/results/${gameCode.toUpperCase()}?round=${selectedRoundId}`
      : "";

  return (
    <main className="page">
      <div className="container hero">
        <h1>Host Admin</h1>
        <p>Manage the party, rounds, votes, and eliminations.</p>

        <div className="grid">
          <label>
            <span className="small">Game code</span>
            <input value={gameCode} onChange={(e) => setGameCode(e.target.value)} />
          </label>
          <label>
            <span className="small">Admin PIN</span>
            <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" />
          </label>
        </div>

        <div className="card row">
          <button onClick={loadAdminState}>Load Game</button>
          <a className="button secondary" href={voteUrl} target="_blank">
            Open Voting Page
          </a>
        </div>

        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}

        {state && (
          <>
            <div className="card">
              <h2>{state.game.title}</h2>
              <p>
                Voting link: <strong>{voteUrl}</strong>
              </p>
              <p className="small">
                Send this link to guests or turn it into a QR code.
              </p>
            </div>

            <div className="card">
              <h2>Players</h2>
              <div className="row">
                <input
                  placeholder="Add player name"
                  value={newPlayer}
                  onChange={(e) => setNewPlayer(e.target.value)}
                  style={{ flex: 1, minWidth: 220 }}
                />
                <button onClick={addPlayer}>Add Player</button>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.players.map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.is_eliminated ? "Eliminated" : "Active"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>Rounds</h2>
              <div className="row">
                <label style={{ maxWidth: 220 }}>
                  <span className="small">People eliminated this round</span>
                  <input
                    type="number"
                    min="1"
                    value={eliminatedCount}
                    onChange={(e) => setEliminatedCount(Number(e.target.value))}
                  />
                </label>
                <button onClick={startRound}>Start New Round</button>
              </div>

              {latestRound && (
                <p>
                  Latest round: Round {latestRound.round_number} —{" "}
                  <span className="status">{latestRound.status}</span>
                </p>
              )}

              <select
                value={selectedRoundId}
                onChange={(e) => {
                  setSelectedRoundId(e.target.value);
                  setResults([]);
                }}
              >
                <option value="">Select round</option>
                {state.rounds.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    Round {r.round_number} — {r.status} — eliminates {r.eliminated_count}
                  </option>
                ))}
              </select>

              <div className="row" style={{ marginTop: 12 }}>
                <button className="secondary" onClick={() => getResults()}>
                  Load Results
                </button>
                <button className="secondary" onClick={() => lockRound(selectedRoundId)}>
                  Lock Voting
                </button>
                <button onClick={() => revealRound(selectedRoundId)}>
                  Reveal Results
                </button>
                <button className="secondary" onClick={() => reopenRound(selectedRoundId)}>
                  Reopen
                </button>
              </div>

              {resultsUrl && (
                <p className="small">
                  Public results link after reveal: <strong>{resultsUrl}</strong>
                </p>
              )}
            </div>

            {results.length > 0 && (
              <div className="card">
                <h2>Results</h2>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Votes</th>
                      <th>Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.player_id}>
                        <td>{r.player_name}</td>
                        <td>{r.vote_count}</td>
                        <td>{r.vote_rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr />
                <button className="danger" onClick={eliminateTopPlayers}>
                  Mark Top Vote-Getters Eliminated
                </button>
                <p className="small">
                  If there is a tie, handle it manually before using this button.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
