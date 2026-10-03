/* eslint-disable @next/next/no-img-element */

type Company = {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  binNumber: string | null
  tradeLicense: string | null
  logoUrl: string | null
}

/** Company header for printed sales documents. */
export function Letterhead({ company, title, meta }: { company: Company; title: string; meta: [string, React.ReactNode][] }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        {company.logoUrl && <img src={company.logoUrl} alt="" className="size-14 shrink-0 object-contain" />}
        <div className="min-w-0">
          <h1 className="text-xl leading-tight font-bold">{company.name}</h1>
          {company.address && <p className="text-xs text-neutral-600">{company.address}</p>}
          <p className="text-xs text-neutral-600">{[company.phone, company.email].filter(Boolean).join(" · ")}</p>
          {(company.binNumber || company.tradeLicense) && (
            <p className="text-xs text-neutral-600">
              {[company.binNumber && `BIN: ${company.binNumber}`, company.tradeLicense && `Trade licence: ${company.tradeLicense}`].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold tracking-wide">{title}</p>
        <table className="mt-1 ml-auto text-xs">
          <tbody>
            {meta.map(([k, v]) => (
              <tr key={k}>
                <td className="pr-2 text-neutral-500">{k}</td>
                <td className="num text-right font-medium">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </header>
  )
}

/** Faint diagonal stamp (REPRINT / CANCELLED) behind the document body. */
export function Watermark({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "danger" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <span
        className={`-rotate-30 text-[96px] font-black tracking-[0.2em] whitespace-nowrap select-none ${tone === "danger" ? "text-red-600/10" : "text-neutral-900/[0.06]"}`}
      >
        {text}
      </span>
    </div>
  )
}

export function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-16 grid grid-cols-2 gap-16 text-xs break-inside-avoid">
      <div className="border-t border-neutral-500 pt-1.5 text-center text-neutral-600">{left}</div>
      <div className="border-t border-neutral-500 pt-1.5 text-center text-neutral-600">{right}</div>
    </div>
  )
}
