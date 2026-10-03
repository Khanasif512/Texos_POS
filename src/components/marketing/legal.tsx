export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { h: string; p: string[] }[] }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="text-sm font-semibold text-primary">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="mt-12 space-y-10">
        {sections.map((s, i) => (
          <section key={s.h}>
            <h2 className="text-lg font-semibold">
              {i + 1}. {s.h}
            </h2>
            {s.p.map((t, j) => (
              <p key={j} className="mt-3 leading-relaxed text-muted-foreground">
                {t}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  )
}
