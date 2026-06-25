import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDashboardData, STATUT_LABEL, type Statut } from "@/lib/dashboard/kpis";

export const dynamic = "force-dynamic"; // toujours des données fraîches

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

export default async function Dashboard() {
  const d = await getDashboardData(supabaseAdmin);
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count));
  const maxLeads = Math.max(1, ...d.commerciaux.map((c) => c.leads));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">NeoTravel · pilotage</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Dashboard de pilotage</h1>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-emerald-700">
          <a href="/commercial" className="underline underline-offset-2">Espace commercial</a>
          <a href="/simulateur" className="underline underline-offset-2">Simulateur</a>
          <a href="/" className="underline underline-offset-2">Chat</a>
        </nav>
      </header>

      {/* ── Cartes KPI ───────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Pris en charge < 48 h"
          value={d.pct_pris_en_charge_48h == null ? "—" : `${d.pct_pris_en_charge_48h} %`}
          sub={d.nb_qualifies > 0 ? `sur ${d.nb_qualifies} leads qualifiés` : "objectif : 100 %"}
          accent="emerald"
        />
        <Kpi
          label="Délai moyen de prise en charge"
          value={d.delai_moyen_h == null ? "—" : `${d.delai_moyen_h} h`}
          sub="création → qualification"
        />
        <Kpi
          label="Pipeline actif (estimé)"
          value={eur(d.pipeline_actif)}
          sub="paniers hors gagné/perdu"
        />
        <Kpi
          label="Taux de conversion"
          value={d.taux_conversion == null ? "—" : `${d.taux_conversion} %`}
          sub={`${eur(d.ca_gagne)} gagnés`}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* ── Funnel ─────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Funnel commercial · {d.total} demandes
          </h2>
          <div className="space-y-2.5">
            {d.funnel.map((f) => (
              <div key={f.statut} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-slate-600">{STATUT_LABEL[f.statut]}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                  <div
                    className="flex h-full items-center justify-end rounded-md bg-emerald-500 px-2 text-xs font-medium text-white"
                    style={{ width: `${Math.max((f.count / maxFunnel) * 100, f.count > 0 ? 8 : 0)}%` }}
                  >
                    {f.count > 0 ? f.count : ""}
                  </div>
                </div>
                {f.count === 0 && <span className="w-4 text-xs text-slate-300">0</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Équité commerciaux ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Répartition par commercial · équité des commissions
          </h2>
          <div className="space-y-3">
            {d.commerciaux.length === 0 && <p className="text-sm text-slate-400">Aucun commercial.</p>}
            {d.commerciaux.map((c) => (
              <div key={c.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-slate-700">{c.nom}</span>
                  <span className="text-slate-500">
                    {c.leads} lead{c.leads > 1 ? "s" : ""} · {eur(c.commissions_cumulees)} commissions
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(c.leads / maxLeads) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Leads récents ─────────────────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Leads récents</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Client</th>
                <th className="py-2 pr-4 font-medium">Trajet</th>
                <th className="py-2 pr-4 font-medium">Pax</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
                <th className="py-2 pr-4 font-medium">Panier est.</th>
                <th className="py-2 pr-4 font-medium">Commercial</th>
              </tr>
            </thead>
            <tbody>
              {d.leads_recents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Aucune demande pour l&apos;instant — lancez une conversation sur le chat.
                  </td>
                </tr>
              )}
              {d.leads_recents.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-slate-700">{l.client}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{l.trajet}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{l.nb_voyageurs}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_COLOR[l.statut]}`}>
                      {STATUT_LABEL[l.statut]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-slate-600">{l.valeur != null ? eur(l.valeur) : "—"}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{l.commercial ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-center text-xs text-slate-400">
        Délais & conversion calculés depuis <code>statut_historique</code> (1 ligne par transition).
      </p>
    </main>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${accent === "emerald" ? "text-emerald-600" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
