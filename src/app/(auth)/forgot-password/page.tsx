import type { Metadata } from "next"
import Link from "next/link"
import { AuthHeading } from "@/components/auth/auth-shell"
import { ForgotForm } from "@/components/auth/password-reset-forms"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Forgot your password?" text="Enter your email and we will send you a link to reset it." />
      <ForgotForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  )
}
