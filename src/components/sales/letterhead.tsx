/* eslint-disable @next/next/no-img-element */
import { LogoMark } from "@/components/brand/logo"

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
export function Letterhead({
  company,
  title,
  meta,
  appLogo = false,
  variant = "default",
}: {
  company: Company
  title: string
  meta: [string, React.ReactNode][]
  appLogo?: boolean
  variant?: "default" | "invoice"
}) {
  return (
    <header
      className={
        variant === "invoice"
          ? "grid grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] items-stretch gap-6 border-b-2 border-indigo-700 pb-4"
          : "flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-3"
      }
    >
      <div className="flex min-w-0 items-start gap-3">
        {company.logoUrl && (
          <img
            src={company.logoUrl}
            alt=""
            className={variant === "invoice" ? "size-16 shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 object-contain" : "size-14 shrink-0 object-contain"}
          />
        )}
        <div className="min-w-0">
          {variant === "invoice" && <p className="mb-1 text-[9px] font-semibold tracking-[0.18em] text-indigo-700 uppercase">Invoice from</p>}
          <h1 className={variant === "invoice" ? "text-2xl leading-tight font-bold tracking-tight text-slate-900" : "text-xl leading-tight font-bold"}>{company.name}</h1>
          {company.address && <p className={variant === "invoice" ? "mt-1 text-[11px] leading-relaxed text-slate-600" : "text-xs text-neutral-600"}>{company.address}</p>}
          <p className={variant === "invoice" ? "mt-1 text-[11px] text-slate-600" : "text-xs text-neutral-600"}>{[company.phone, company.email].filter(Boolean).join(" · ")}</p>
          {(company.binNumber || company.tradeLicense) && (
            <p className={variant === "invoice" ? "mt-1 text-[10px] text-slate-500" : "text-xs text-neutral-600"}>
              {[company.binNumber && `BIN: ${company.binNumber}`, company.tradeLicense && `Trade licence: ${company.tradeLicense}`].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
      <div className={variant === "invoice" ? "rounded-xl border border-slate-200 border-t-2 border-t-indigo-700 bg-slate-50 px-4 py-3 text-right" : "shrink-0 text-right"}>
        {appLogo && (
          <div className="mb-1 flex items-center justify-end gap-1.5">
            <LogoMark className="size-5" />
            <span className={variant === "invoice" ? "text-[9px] font-semibold tracking-wide text-slate-500 uppercase" : "text-[10px] font-semibold tracking-tight"}>TexonPOS</span>
          </div>
        )}
        {variant === "invoice" && <p className="text-[9px] font-semibold tracking-[0.16em] text-indigo-700 uppercase">Sales document</p>}
        <p className={variant === "invoice" ? "mt-0.5 text-xl font-bold tracking-wide text-slate-900" : "text-lg font-bold tracking-wide"}>{title}</p>
        <table className={variant === "invoice" ? "mt-2 ml-auto text-[10px]" : "mt-1 ml-auto text-xs"}>
          <tbody>
            {meta.map(([k, v]) => (
              <tr key={k} className={variant === "invoice" ? "border-t border-slate-200" : undefined}>
                <td className={variant === "invoice" ? "py-1 pr-3 text-left text-slate-500" : "pr-2 text-neutral-500"}>{k}</td>
                <td className={variant === "invoice" ? "num py-1 text-right font-semibold text-slate-800" : "num text-right font-medium"}>{v}</td>
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
