import SectionCard from '../components/SectionCard';

export default function BookshelvesPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Libreros</h1>
      </header>
      <SectionCard
        title="Base CRUD"
        subtitle="Entidad Bookshelf con slug unico por owner, posicion e indice de archivado en Prisma."
      />
    </section>
  );
}
