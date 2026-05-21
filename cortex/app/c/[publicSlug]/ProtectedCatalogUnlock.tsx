'use client';

import { Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type ProtectedCatalogUnlockProps = {
  publicSlug: string;
};

export default function ProtectedCatalogUnlock({ publicSlug }: ProtectedCatalogUnlockProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) {
      setError('Ingresa la contrasena de acceso.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/public/catalogs/${publicSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError('Contrasena incorrecta.');
        return;
      }

      setPassword('');
      router.refresh();
    } catch {
      setError('No se pudo validar el acceso.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md px-4 py-8">
      <article className="panel-glass rounded-3xl border border-white/15 bg-white/[0.04] p-6 shadow-[0_25px_50px_-20px_rgba(0,0,0,0.6)]">
        <div className="mb-5 flex items-center gap-2 text-zinc-100">
          <Lock className="h-4 w-4 text-amber-200" />
          <h1 className="text-sm font-semibold uppercase tracking-[0.14em]">Catalogo protegido</h1>
        </div>
        <p className="mb-4 text-sm text-zinc-300">Este catalogo requiere contrasena para continuar.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contrasena"
            className="w-full rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300/50 focus:ring-1 focus:ring-cyan-300/45"
            autoComplete="current-password"
          />
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Desbloquear catalogo
          </button>
        </form>
      </article>
    </section>
  );
}
