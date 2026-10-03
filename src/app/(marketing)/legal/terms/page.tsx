import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal"

export const metadata: Metadata = { title: "Terms of service" }

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="3 October 2026"
      sections={[
        { h: "The service", p: ["TexonPOS is a subscription software service operated by Texon that lets businesses manage imports, inventory, sales and finance. By creating a workspace you agree to these terms on behalf of your company."] },
        { h: "Accounts", p: ["You are responsible for the people you invite to your workspace, for keeping passwords confidential, and for all activity under your account. Tell us immediately if you suspect unauthorised access."] },
        { h: "Trial, plans and billing", p: ["New workspaces start with a free trial. After the trial, continued use requires a paid plan. Fees are billed in advance for the chosen billing cycle and are non-refundable except where required by law.", "If a payment fails we will notify you and allow a grace period. After it ends, the workspace becomes read-only until the balance is settled."] },
        { h: "Your data", p: ["You own the data you enter. We process it only to provide the service. You can export your data at any time, and after cancellation we keep it in read-only form for 90 days before deletion."] },
        { h: "Acceptable use", p: ["Do not use the service to break the law, to attempt to access other customers' data, or to disrupt the platform. We may suspend workspaces that put the service or other customers at risk."] },
        { h: "Liability", p: ["The service is provided with reasonable skill and care. Calculations such as landed cost depend on the figures you enter; please review results before relying on them for pricing or tax decisions."] },
        { h: "Changes", p: ["We may update these terms. Material changes will be announced in the app or by email at least 14 days before they take effect."] },
      ]}
    />
  )
}
