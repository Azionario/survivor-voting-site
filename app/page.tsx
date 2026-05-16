import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <div className="container hero">
        <h1>Survivor Party Voting</h1>
        <p>Use the voting page for guests, the betting page for favorites, and the admin page for the host.</p>
        <div className="row">
          <Link className="button" href="/vote/SURVIVOR">Open Voting Page</Link>
          <Link className="button secondary" href="/betting/SURVIVOR">Open Betting Favorites</Link>
          <Link className="button secondary" href="/admin">Open Admin Page</Link>
        </div>
        <p className="small">Default test game code: SURVIVOR. You can change this later in Supabase/admin.</p>
      </div>
    </main>
  );
}
