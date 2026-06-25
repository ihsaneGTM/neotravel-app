import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUT_LABEL, type Statut } from "@/lib/dashboard/kpis";

export const dynamic = "force-dynamic";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const STATUT_COLOR: Record<Statut, string> = {
  new: "bg-slate-100 text-slate-600",
  qualified: "bg-sky-100 text-sky-700",
  contacted: "bg-indigo-100 text-indigo-700",
  quote_sent: "bg-amber-100 text-amber-700",
  negotiation: "bg-violet-100 text-violet-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-rose-100 text-rose-700",
};

type Row = {
  id: string;
  statut: Statut;
  ville_depart: string;
  ville_arrivee: string | null;
  nb_voyageurs: number;
  date_depart: string;
  complexite: string;
  valeur_panier_estimee: number | null;
  created_at: string;
  clients: { nom: string; telephone: string | null } | null;
  commerciaux: { nom: string } | null;
};

export default async function CommercialList() {
  const { data } = await supabaseAdmin
    .from("demandes")
    .select(
      "id, statut, ville_depart, ville_arrivee, nb_voyageurs, date_depart, complexite, valeur_panier_estimee, created_at, clients(nom, telephone), commerciaux(nom)"
    )
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">NeoTravel · espace commercial</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Leads attribués</h1>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-emerald-700">
          <a href="/dashboard" className="underline underline-offset-2">Dashboard</a>
          <a href="/" className="underline underline-offset-2">Chat</a>
        </nav>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Trajet</th>
              <th className="px-4 py-3 font-medium">Pax</th>
              <th className="px-4 py-3 font-medium">Départ</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Panier est.</th>
              <th className="px-4 py-3 font-medium">Commercial</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Aucun lead — lancez une conversation sur le chat pour en créer un.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{r.clients?.nom ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.ville_arrivee ? `${r.ville_depart} → ${r.ville_arrivee}` : r.ville_depart}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.nb_voyageurs}</td>
                <td className="px-4 py-3 text-slate-600">{r.date_depart}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_COLOR[r.statut]}`}>
                    {STATUT_LABEL[r.statut]}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600">
                  {r.valeur_panier_estimee != null ? eur(Number(r.valeur_panier_estimee)) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.commerciaux?.nom ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/commercial/${r.id}`} className="font-medium text-emerald-700 underline underline-offset-2">
                    Ouvrir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
