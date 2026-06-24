import { Conversation } from "@/components/chat/conversation";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <header className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">NeoTravel</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Dites-nous où vous allez — on s’occupe du reste
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-600">
          Décrivez votre trajet en quelques mots. On vous donne une estimation, et un commercial vous
          rappelle dans la journée pour finaliser.
        </p>
      </header>

      <Conversation />

      <p className="mt-4 text-center text-sm text-slate-500">
        Vous préférez un devis par téléphone&nbsp;?{" "}
        <a className="font-medium text-emerald-700 underline underline-offset-2" href="tel:+33000000000">
          Être rappelé
        </a>
      </p>
    </main>
  );
}
