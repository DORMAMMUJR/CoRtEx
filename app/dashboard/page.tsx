import SectionCard from '../components/SectionCard';

const cards = [
  {
    title: 'Fase 1-3',
    subtitle: 'Fundacion, modelo de datos, autenticacion y seguridad base alineadas al PRD.',
  },
  {
    title: 'Fase 4-7',
    subtitle: 'Dashboard SaaS, flujo PDF, flujo IA con imagen y publicacion con visibilidad.',
  },
  {
    title: 'Fase 8-11',
    subtitle: 'Analiticas, hardening, operacion productiva y roadmap post-MVP.',
  },
];

export default function DashboardPage() {
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">Base del PRD fijada por modulos y contratos.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SectionCard key={card.title} title={card.title} subtitle={card.subtitle} />
        ))}
      </div>
    </section>
  );
}
