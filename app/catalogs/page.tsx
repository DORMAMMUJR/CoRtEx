import SectionCard from '../components/SectionCard';

export default function CatalogsPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Catalogos</h1>
      </header>
      <SectionCard
        title="Core"
        subtitle="Catalogos, items, assets y versionado base listos para conectar repositorio Prisma."
      />
    </section>
  );
}
