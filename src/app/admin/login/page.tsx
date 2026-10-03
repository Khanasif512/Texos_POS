import type { Metadata } from "next"
import { Suspense } from "react"
import { ShieldCheck } from "lucide-react"
import { LogoMark } from "@/components/brand/logo"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Platform admin" }

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="font-semibold leading-tight">TexonPOS Platform</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3" /> Super admin access
            </p>
          </div>
        </div>
        <div className="mt-8">
          <Suspense>
            <LoginForm admin />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
