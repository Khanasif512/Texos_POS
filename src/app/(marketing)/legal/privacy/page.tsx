import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal"

export const metadata: Metadata = { title: "Privacy policy" }

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="3 October 2026"
      sections={[
        { h: "What we collect", p: ["Account details (name, email, phone), company details you provide, the business records you enter into your workspace, and technical logs such as IP address and browser type used to secure the service."] },
        { h: "How we use it", p: ["To provide and secure the service, to send account and billing notices, to give support when you ask for it, and to improve the product using aggregated, non-identifying statistics."] },
        { h: "Isolation and security", p: ["Each company's data is logically isolated and every request is authorised on the server. Passwords are hashed, traffic is encrypted in transit, and changes to sensitive financial records are audit-logged."] },
        { h: "Sharing", p: ["We do not sell your data. We share it only with infrastructure providers that host the service under confidentiality obligations, or when required by law."] },
        { h: "Retention", p: ["Financial records are retained while your subscription is active. After cancellation, data stays available read-only for 90 days for export and is then deleted."] },
        { h: "Your rights", p: ["You can access, correct or export your data from within the app, or contact us to request deletion of your account."] },
      ]}
    />
  )
}
