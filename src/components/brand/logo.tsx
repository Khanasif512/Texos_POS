import Link from "next/link"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="tx-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.55 0.21 276)" />
          <stop offset="1" stopColor="oklch(0.42 0.19 266)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#tx-g)" />
      <rect x="7" y="8" width="18" height="4" rx="1.5" fill="white" />
      <rect x="13.5" y="12" width="5" height="12" rx="1.5" fill="white" fillOpacity="0.92" />
      <rect x="20.5" y="19" width="4.5" height="5" rx="1.25" fill="oklch(0.8 0.12 186)" />
    </svg>
  )
}

export function Logo({ href = "/", className, invert }: { href?: string; className?: string; invert?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className={cn("text-[1.05rem]", invert && "text-white")}>
        Texon<span className="text-primary">POS</span>
      </span>
    </Link>
  )
}
