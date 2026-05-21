import SectionCard from '../components/SectionCard';

export default function SubscriptionPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Suscripcion</h1>
      </header>
      <SectionCard
        title="Planes"
        subtitle="Tier, limites y estado de suscripcion listos para enforcement por feature flags."
      />
    </section>
  );
}
