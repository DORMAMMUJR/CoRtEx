import SectionCard from '../components/SectionCard';

export default function AnalyticsPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Analiticas</h1>
      </header>
      <SectionCard
        title="Tracking"
        subtitle="Eventos VIEW, CLICK, DOWNLOAD y SHARE con referer y geo aproximada en AnalyticsEvent."
      />
    </section>
  );
}
