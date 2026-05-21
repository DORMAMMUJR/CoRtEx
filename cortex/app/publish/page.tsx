import SectionCard from '../components/SectionCard';

export default function PublishPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Publicacion</h1>
      </header>
      <SectionCard
        title="Distribucion"
        subtitle="Visibilidad publica, unlisted o protected y metadata social modeladas en Publication."
      />
    </section>
  );
}
