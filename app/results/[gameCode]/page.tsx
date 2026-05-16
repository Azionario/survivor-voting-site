"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResultsPage({
  params,
  searchParams,
}: {
  params: { gameCode: string };
  searchParams: { round?: string };
}) {
  const gameCode = params.gameCode.toUpperCase();
  const roundId = searchParams.round || "";
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadResults() {
    setLoading(true);
    setError("");

    if (!roundId) {
      setError("Missing round ID.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("get_survivor_public_results", {
      p_game_code: gameCode,
      p_round_id: roundId,
    });

    if (error) setError(error.message);
    else setResults(data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadResults();
  }, [roundId, gameCode]);

  return (
    <main className="page">
      <div className="container hero">
        <h1>Survivor Results</h1>
        <p>Game code: <strong>{gameCode}</strong></p>

        {loading && <p>Loading...</p>}
        {error && <div className="error">{error}</div>}

        {results.length > 0 && (
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
        )}

        <button className="secondary" onClick={loadResults} style={{ marginTop: 16 }}>
          Refresh
        </button>
      </div>
    </main>
  );
}
