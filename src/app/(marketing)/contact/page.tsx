import type { Metadata } from "next"
import { Clock, Mail, MapPin, Phone } from "lucide-react"
import { PageHero } from "@/components/marketing/section"
import { ContactForm } from "@/components/marketing/contact-form"

export const metadata: Metadata = { title: "Contact" }

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let's talk about your business"
        text="Book a guided demo, ask about migrating your data, or get help choosing a plan. We usually reply within one business day."
      />
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:px-8">
        <div className="space-y-6">
          {[
            { icon: Mail, title: "Email", text: "hello@texonpos.com" },
            { icon: Phone, title: "Phone", text: "+880 1700-000000" },
            { icon: MapPin, title: "Office", text: "Dhaka, Bangladesh" },
            { icon: Clock, title: "Hours", text: "Saturday – Thursday, 10am – 7pm" },
          ].map((c) => (
            <div key={c.title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <c.icon className="size-5" />
              </span>
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <ContactForm />
        </div>
      </section>
    </>
  )
}
