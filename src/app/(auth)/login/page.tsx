import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { AuthHeading } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Welcome back" text="Sign in to your company workspace." />
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to TexonPOS?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create a workspace
        </Link>
      </p>
    </>
  )
}
