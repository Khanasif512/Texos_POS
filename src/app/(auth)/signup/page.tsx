import type { Metadata } from "next"
import { Suspense } from "react"
import { SignupFlow } from "@/components/auth/signup-flow"

export const metadata: Metadata = { title: "Create your workspace" }

export default function SignupPage() {
  return (
    <Suspense>
      <SignupFlow />
    </Suspense>
  )
}
