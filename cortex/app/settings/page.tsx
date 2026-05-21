import SectionCard from '../components/SectionCard';

export default function SettingsPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Configuracion</h1>
      </header>
      <SectionCard
        title="Seguridad"
        subtitle="RBAC, API keys hash, auditoria y rate limit definidos como base para hardening."
      />
    </section>
  );
}
