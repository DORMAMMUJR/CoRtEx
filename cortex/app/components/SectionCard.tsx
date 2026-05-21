type SectionCardProps = {
  title: string;
  subtitle: string;
};

export default function SectionCard({ title, subtitle }: SectionCardProps) {
  return (
    <article className="panel-glass rounded-2xl p-5">
      <h3 className="text-sm uppercase tracking-[0.16em] text-zinc-400">{title}</h3>
      <p className="mt-3 text-sm text-zinc-200">{subtitle}</p>
    </article>
  );
}
