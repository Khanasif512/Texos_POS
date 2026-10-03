import "server-only"
import nodemailer from "nodemailer"

type Mail = { to: string; subject: string; text: string; html?: string }

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null

/** Sends via SMTP when configured; otherwise prints to the server console (development). */
export async function sendMail(mail: Mail) {
  if (!transport) {
    console.info(`\n──── email (dev) ────\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n─────────────────────\n`)
    return
  }
  await transport.sendMail({ from: process.env.MAIL_FROM, ...mail })
}

export function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:Segoe UI,Arial,sans-serif;color:#1e2235">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e6e8f0">
<tr><td style="padding:28px 32px 8px;font-size:18px;font-weight:600">Texon<span style="color:#4f46e5">POS</span></td></tr>
<tr><td style="padding:8px 32px 28px;font-size:14px;line-height:1.6"><h2 style="font-size:18px;margin:0 0 12px">${title}</h2>${body}</td></tr>
</table><p style="font-size:12px;color:#8a8fa3">You received this email because of an action on TexonPOS.</p></td></tr></table></body></html>`
}
