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
  const [immunityPlayerIds, setImmunityPlayerIds] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [betStats, setBetStats] = useState<any[]>([]);
  const [top4Stats, setTop4Stats] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const latestRound = useMemo(() => state?.rounds?.[0] || null, [state]);
  const activePlayers = useMemo(
    () => (state?.players || []).filter((p: any) => !p.is_eliminated),
    [state]
  );

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
    const roundToLoad = selectedRoundId || firstRound;
    setSelectedRoundId(roundToLoad);
    if (roundToLoad) await loadImmunities(roundToLoad);
  }

  async function loadImmunities(roundId = selectedRoundId) {
    if (!roundId) {
      setImmunityPlayerIds([]);
      return;
    }

    const { data, error } = await supabase.rpc("get_survivor_round_immunities", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_round_id: roundId,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setImmunityPlayerIds(data?.player_ids || []);
  }

  async function saveImmunities() {
    setError("");
    setMessage("");

    if (!selectedRoundId) {
      setError("Pick a round first.");
      return;
    }

    const { data, error } = await supabase.rpc("set_survivor_round_immunities", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_round_id: selectedRoundId,
      p_player_ids: immunityPlayerIds,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(data || "Immunity saved.");
    await loadImmunities(selectedRoundId);
  }

  function toggleImmunity(playerId: string) {
    setImmunityPlayerIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      return [...current, playerId];
    });
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

  async function deletePlayer(playerId: string, playerName: string) {
    setError("");
    setMessage("");

    const confirmed = window.confirm(`Remove ${playerName}? This also removes their votes, immunities, and winner bets.`);
    if (!confirmed) return;

    const { error } = await supabase.rpc("delete_survivor_player", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
      p_player_id: playerId,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setImmunityPlayerIds((current) => current.filter((id) => id !== playerId));
    setMessage(`${playerName} removed.`);
    await loadAdminState();
    if (selectedRoundId) await getResults(selectedRoundId);
    await getBetStats();
    await getTop4Stats();
  }

  async function resetGame() {
    setError("");
    setMessage("");

    const first = window.confirm(
      "Reset the game? This will clear all votes, rounds, immunities, eliminations, and winner bets, but it will KEEP the player list."
    );
    if (!first) return;

    const second = window.confirm(
      "Final confirmation: are you absolutely sure? This cannot be undone."
    );
    if (!second) return;

    const { data, error } = await supabase.rpc("reset_survivor_game", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setResults([]);
    setBetStats([]);
    setTop4Stats([]);
    setImmunityPlayerIds([]);
    setSelectedRoundId("");
    setMessage(data || "Game reset.");
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

    setMessage("Round started. Everyone can vote again for this new round. Set immunity below if needed.");
    setSelectedRoundId(data);
    setImmunityPlayerIds([]);
    setResults([]);
    await loadAdminState();
    await loadImmunities(data);
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

  async function getBetStats() {
    setError("");
    setMessage("");

    const { data, error } = await supabase.rpc("get_survivor_admin_bets", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setBetStats(data || []);
  }

  async function getTop4Stats() {
    setError("");
    setMessage("");

    const { data, error } = await supabase.rpc("get_survivor_admin_top4_bets", {
      p_game_code: gameCode.toUpperCase(),
      p_admin_pin: pin,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setTop4Stats(data || []);
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

  const voteUrl = typeof window !== "undefined" ? `${window.location.origin}/vote/${gameCode.toUpperCase()}` : `/vote/${gameCode.toUpperCase()}`;
  const bettingUrl = typeof window !== "undefined" ? `${window.location.origin}/betting/${gameCode.toUpperCase()}` : `/betting/${gameCode.toUpperCase()}`;
  const marketsUrl = typeof window !== "undefined" ? `${window.location.origin}/markets/${gameCode.toUpperCase()}` : `/markets/${gameCode.toUpperCase()}`;
  const resultsUrl = typeof window !== "undefined" && selectedRoundId ? `${window.location.origin}/results/${gameCode.toUpperCase()}?round=${selectedRoundId}` : "";

  return (
    <main className="page">
      <div className="container hero">
        <h1>Host Admin</h1>
        <p>Manage the party, rounds, immunity, votes, eliminations, and betting favorites.</p>

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
          <a className="button secondary" href={voteUrl} target="_blank">Open Voting Page</a>
          <a className="button secondary" href={bettingUrl} target="_blank">Open Betting Favorites</a>
          <a className="button secondary" href={marketsUrl} target="_blank">Open Odds Chart</a>
          <button className="danger" onClick={resetGame}>Reset Game</button>
        </div>

        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}

        {state && (
          <>
            <div className="card">
              <h2>{state.game.title}</h2>
              <p>Voting link: <strong>{voteUrl}</strong></p>
              <p>Betting favorites link: <strong>{bettingUrl}</strong></p>
              <p>Odds chart link: <strong>{marketsUrl}</strong></p>
              <p className="small">Reset keeps the player list but clears votes, rounds, immunities, eliminations, winner bets, and Top 4 bets.</p>
            </div>

            <div className="card">
              <h2>Players</h2>
              <div className="row">
                <input placeholder="Add player name" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                <button onClick={addPlayer}>Add Player</button>
              </div>

              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Status</th><th>Remove</th></tr>
                </thead>
                <tbody>
                  {state.players.map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.is_eliminated ? "Eliminated" : "Active"}</td>
                      <td><button className="xButton" onClick={() => deletePlayer(p.id, p.name)} title={`Remove ${p.name}`}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>Rounds</h2>
              <div className="row">
                <label style={{ maxWidth: 260 }}>
                  <span className="small">People eliminated this round</span>
                  <input type="number" min="1" value={eliminatedCount} onChange={(e) => setEliminatedCount(Number(e.target.value))} />
                </label>
                <button onClick={startRound}>Start New Round</button>
              </div>

              {latestRound && <p>Latest round: Round {latestRound.round_number} — <span className="status">{latestRound.status}</span></p>}

              <select
                value={selectedRoundId}
                onChange={async (e) => {
                  const roundId = e.target.value;
                  setSelectedRoundId(roundId);
                  setResults([]);
                  await loadImmunities(roundId);
                }}
              >
                <option value="">Select round</option>
                {state.rounds.map((r: any) => (
                  <option key={r.id} value={r.id}>Round {r.round_number} — {r.status} — eliminates {r.eliminated_count}</option>
                ))}
              </select>

              <div className="card">
                <h2>⭐ Immunity for Selected Round</h2>
                <p className="small">Anyone checked here cannot be voted for in this round. They also receive a small odds boost on Betting Favorites.</p>

                {!selectedRoundId && <div className="notice">Select or start a round first.</div>}

                {selectedRoundId && (
                  <>
                    <div className="grid">
                      {activePlayers.map((p: any) => (
                        <label key={p.id} className="card" style={{ marginTop: 0, cursor: "pointer" }}>
                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <strong>{p.name}</strong>
                            <input
                              type="checkbox"
                              checked={immunityPlayerIds.includes(p.id)}
                              onChange={() => toggleImmunity(p.id)}
                              style={{ width: 22, height: 22 }}
                            />
                          </div>
                          {immunityPlayerIds.includes(p.id) && <span className="status">⭐ Immune</span>}
                        </label>
                      ))}
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <button onClick={saveImmunities}>Save Immunity</button>
                      <button className="secondary" onClick={() => setImmunityPlayerIds([])}>Clear Checks</button>
                      <button className="secondary" onClick={() => loadImmunities(selectedRoundId)}>Reload Saved Immunity</button>
                    </div>
                  </>
                )}
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <button className="secondary" onClick={() => getResults()}>Load Results</button>
                <button className="secondary" onClick={() => lockRound(selectedRoundId)}>Lock Voting</button>
                <button onClick={() => revealRound(selectedRoundId)}>Reveal Results</button>
                <button className="secondary" onClick={() => reopenRound(selectedRoundId)}>Reopen</button>
              </div>

              {resultsUrl && <p className="small">Public results link after reveal: <strong>{resultsUrl}</strong></p>}
            </div>

            {results.length > 0 && (
              <div className="card">
                <h2>Results</h2>
                <table className="table">
                  <thead><tr><th>Player</th><th>Votes</th><th>Rank</th></tr></thead>
                  <tbody>
                    {results.map((r) => <tr key={r.player_id}><td>{r.player_name}</td><td>{r.vote_count}</td><td>{r.vote_rank}</td></tr>)}
                  </tbody>
                </table>
                <hr />
                <button className="danger" onClick={eliminateTopPlayers}>Mark Top Vote-Getters Eliminated</button>
                <p className="small">If there is a tie, handle it manually before using this button.</p>
              </div>
            )}



            <div className="card">
              <h2>Top 4 Bet Chart</h2>
              <p className="small">Shows who guests are picking to make the Top 4 on the Betting Favorites page.</p>
              <button className="secondary" onClick={getTop4Stats}>Load Top 4 Chart</button>

              {top4Stats.length > 0 && (
                <table className="table">
                  <thead><tr><th>Player</th><th>Top 4 Picks</th><th>Share of Picks</th><th>Chart</th></tr></thead>
                  <tbody>
                    {top4Stats.map((b) => (
                      <tr key={b.player_id}>
                        <td>{b.player_name}{b.is_eliminated ? " (Eliminated)" : ""}</td>
                        <td>{b.bet_count}</td>
                        <td>{Number(b.bet_share || 0).toFixed(2)}%</td>
                        <td><div className="barTrack"><div className="barFill" style={{ width: `${Math.max(0, Math.min(100, Number(b.bet_share || 0)))}%` }} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h2>Winner Bet Chart</h2>
              <p className="small">Shows who guests are picking to win on the Betting Favorites page.</p>
              <button className="secondary" onClick={getBetStats}>Load Betting Chart</button>

              {betStats.length > 0 && (
                <table className="table">
                  <thead><tr><th>Player</th><th>Bets</th><th>Share</th><th>Chart</th></tr></thead>
                  <tbody>
                    {betStats.map((b) => (
                      <tr key={b.player_id}>
                        <td>{b.player_name}{b.is_eliminated ? " (Eliminated)" : ""}</td>
                        <td>{b.bet_count}</td>
                        <td>{Number(b.bet_share || 0).toFixed(2)}%</td>
                        <td><div className="barTrack"><div className="barFill" style={{ width: `${Math.max(0, Math.min(100, Number(b.bet_share || 0)))}%` }} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
