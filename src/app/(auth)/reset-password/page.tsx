import type { Metadata } from "next"
import { AuthHeading } from "@/components/auth/auth-shell"
import { ResetForm } from "@/components/auth/password-reset-forms"

export const metadata: Metadata = { title: "Reset password" }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams
  return (
    <>
      <AuthHeading title="Choose a new password" text="You will be signed out of all other devices." />
      <ResetForm token={token} />
    </>
  )
}
