# TexonPOS — CloudPanel Deployment Guide

এই গাইডে CloudPanel (Ubuntu VPS) এ TexonPOS প্রথমবার চালু করা, পরে আপডেট দেওয়া, database migration চালানো, backup ও rollback — সব ধাপে ধাপে দেওয়া আছে। Command গুলো হুবহু কপি করে চালানো যাবে; `< >` চিহ্নের ভেতরের অংশ নিজের মান দিয়ে বদলাবেন।

---

## ০. যা যা লাগবে

| জিনিস | মন্তব্য |
|---|---|
| VPS | Ubuntu 22.04/24.04, কমপক্ষে **2 vCPU, 4 GB RAM** (build এর সময় ~2 GB লাগে; 2 GB RAM হলে swap যোগ করুন — নিচে আছে) |
| CloudPanel | v2 (MySQL 8.0 engine সহ ইনস্টল করা) |
| Domain | যেমন `app.example.com` — DNS এ সার্ভারের IP দিয়ে **A record** |
| Git repo | GitHub/GitLab এ private repo (এখন local `dev` branch এ আছে — আগে push করতে হবে) |
| SMTP | সাইনআপ OTP ও পাসওয়ার্ড রিসেট ইমেইলের জন্য **বাধ্যতামূলক** (Gmail Workspace, Zoho, Amazon SES, Brevo ইত্যাদি) |

> ⚠️ SMTP না দিলে OTP ইমেইল যাবে না — শুধু server log এ প্রিন্ট হবে। Production এ অবশ্যই SMTP দিন।

### Repo remote এ push (একবার, নিজের PC থেকে)

```bash
git remote add origin git@github.com:<your-user>/texonpos.git
git push -u origin dev
```

Production এর জন্য একটি stable branch রাখা ভালো (যেমন `main`): কাজ `dev` এ, পরীক্ষা শেষে `main` এ merge করে deploy।

---

## ১. CloudPanel ইনস্টল (নতুন সার্ভার হলে)

CloudPanel এর অফিসিয়াল ডকুমেন্টেশন (cloudpanel.io/docs → Getting Started → Other / Your provider) থেকে **checksum সহ install command** চালান, এবং DB engine হিসেবে **MySQL 8.0** বেছে নিন (`DB_ENGINE=MYSQL_8.0`)। ইনস্টল শেষে `https://<server-ip>:8443` এ গিয়ে admin user তৈরি করুন।

নিরাপত্তা:
- CloudPanel → **Security** → Firewall: শুধু 22, 80, 443 খোলা রাখুন; 8443 (panel) শুধু নিজের IP থেকে allow করুন।
- MySQL port (3306) বাইরে খোলা রাখবেন না।

### (ঐচ্ছিক) 2 GB RAM সার্ভারে swap যোগ

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## ২. Node.js Site তৈরি (CloudPanel UI)

1. **Sites → Add Site → Create a Node.js Site**
2. Domain Name: `app.example.com`
3. Node.js Version: **22 LTS** (বা 24) — Next.js 16 এর জন্য Node ≥ 20.9 লাগে
4. App Port: **3000**
5. Site User ও Password দিন (যেমন `texon`) — এটাই SSH user হবে

CloudPanel নিজে Nginx reverse proxy বানিয়ে দেয় (`https://domain` → `127.0.0.1:3000`)।

### SSL
Site → **SSL/TLS → Actions → New Let's Encrypt Certificate** → Create and Install।

---

## ৩. Database তৈরি (CloudPanel UI)

Site → **Databases → Add Database**
- Database Name: `texonpos`
- User Name: `texonpos`
- Password: শক্ত password (generate করুন)

> Password এ `& @ : / # ? %` এর মত চিহ্ন থাকলে `DATABASE_URL` এ **URL-encode** করতে হবে (যেমন `&` → `%26`, `@` → `%40`, `#` → `%23`)।

---

## ৪. কোড সার্ভারে আনা

SSH দিয়ে site user হিসেবে লগইন:

```bash
ssh texon@<server-ip>
cd ~/htdocs/app.example.com
```

ফোল্ডারে CloudPanel এর ডিফল্ট কিছু ফাইল থাকলে মুছে ফেলুন, তারপর clone:

```bash
rm -rf ~/htdocs/app.example.com/* ~/htdocs/app.example.com/.[!.]* 2>/dev/null || true
git clone -b main git@github.com:<your-user>/texonpos.git ~/htdocs/app.example.com
cd ~/htdocs/app.example.com
```

(Private repo হলে সার্ভারে `ssh-keygen -t ed25519` চালিয়ে `~/.ssh/id_ed25519.pub` কে GitHub repo → Settings → **Deploy keys** এ read-only হিসেবে যোগ করুন।)

### Yarn ও PM2 (site user এর Node এ একবার)

```bash
node -v                       # 22.x / 24.x দেখাবে
npm install -g yarn pm2
```

---

## ৫. `.env` তৈরি (production)

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

`.env` এ যা দিতে হবে:

```dotenv
DATABASE_URL="mysql://texonpos:<url-encoded-password>@127.0.0.1:3306/texonpos"
APP_URL="https://app.example.com"

# প্রতিটির জন্য আলাদা লম্বা random মান:  openssl rand -base64 48
JWT_ACCESS_SECRET="<random-1>"
JWT_REFRESH_SECRET="<random-2>"
CRON_SECRET="<random-3>"

SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="no-reply@example.com"
SMTP_PASS="<smtp-password>"
MAIL_FROM="TexonPOS <no-reply@example.com>"

# প্রথম seed এ platform super admin তৈরি হবে
SUPER_ADMIN_EMAIL="you@example.com"
SUPER_ADMIN_PASSWORD="<strong-password>"

# ঐচ্ছিক
# BILLING_PROVIDER="manual"
# DISABLE_JOBS="1"      # একাধিক instance চালালে, তখন cron দিয়ে job চালান (ধাপ ৯)
```

> ⚠️ `JWT_*` secret পরে বদলালে সব user logout হয়ে যাবে — একবার সেট করে রেখে দিন।
> ⚠️ `.env` কখনো git এ commit করবেন না।

---

## ৬. প্রথমবার Install, Migrate, Seed, Build

```bash
cd ~/htdocs/app.example.com
yarn install --frozen-lockfile      # postinstall এ prisma client generate হয় (.env আগে থাকতে হবে)
yarn db:deploy                      # সব migration প্রয়োগ (prisma migrate deploy)
NODE_ENV=production yarn db:seed    # plans, permissions, super admin (demo tenant production এ তৈরি হয় না)
yarn build
```

Demo data (GK Interior) production এ দরকার হলে শুধু তখন: `SEED_DEMO=1 NODE_ENV=production yarn db:seed`

---

## ৭. PM2 দিয়ে চালু রাখা

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
curl -s http://127.0.0.1:3000/api/health      # {"status":"ok",...}
```

সার্ভার reboot হলে নিজে চালু হওয়ার জন্য CloudPanel → Site → **Cron Jobs → Add Cron Job**:
- Schedule: `@reboot`
- Command: `cd /home/texon/htdocs/app.example.com && /home/texon/.nvm/versions/node/$(node -v)/bin/pm2 resurrect`

(সঠিক path পেতে `which pm2` চালিয়ে দেখুন এবং সেটাই বসান — যেমন `/home/texon/.nvm/versions/node/v22.11.0/bin/pm2 resurrect`।)

এখন `https://app.example.com` খুলুন। Super admin প্যানেল: `https://app.example.com/admin/login`।

---

## ৮. প্রথম লগইনের পর করণীয় (Super Admin)

1. `/admin/settings` → **Billing instructions** এ আসল bank account / bKash নম্বর বসান (ডিফল্ট টেক্সট placeholder)। Trial days ও grace days ঠিক করুন।
2. `/admin/plans` → প্ল্যানের দাম ও লিমিট যাচাই করুন।
3. নিজে একটি টেস্ট কোম্পানি signup করে OTP ইমেইল আসছে কিনা দেখুন।
4. Uptime monitor (UptimeRobot/Better Stack) এ `https://app.example.com/api/health` যোগ করুন।

---

## ৯. Background jobs (subscription ও notification)

ডিফল্টভাবে অ্যাপ নিজেই প্রতি ঘণ্টায় job চালায় (`src/instrumentation.ts`) — PM2 এ **১টি instance** থাকলে আর কিছু লাগবে না।

একাধিক instance/সার্ভার চালালে `.env` এ `DISABLE_JOBS="1"` দিন এবং CloudPanel Cron Jobs এ যোগ করুন:
- Schedule: `0 * * * *`
- Command: `curl -fsS -X POST -H "x-cron-secret: <CRON_SECRET>" https://app.example.com/api/v1/admin/jobs/run > /dev/null`

---

## ১০. আপডেট দেওয়ার নিয়ম (প্রতিবার)

### নিজের PC তে
1. `dev` এ কাজ → `yarn typecheck && yarn lint && yarn test && yarn build` সব পাস করান।
2. Schema বদলালে migration তৈরি করুন (ধাপ ১১) এবং `prisma/migrations/` ফোল্ডার **commit করুন**।
3. `main` এ merge করে push:
   ```bash
   git checkout main && git merge --ff-only dev && git push origin main && git checkout dev
   ```

### সার্ভারে (এক command)

```bash
cd ~/htdocs/app.example.com
bash scripts/deploy.sh main
```

`scripts/deploy.sh` নিজে থেকে যা করে:
1. Database backup → `~/backups/texonpos-<time>.sql.gz` (সর্বশেষ ১৪টি রাখে)
2. `git pull` (শুধু fast-forward)
3. `yarn install --frozen-lockfile`
4. `prisma migrate status` দেখায়, তারপর `yarn db:deploy` দিয়ে নতুন migration প্রয়োগ
5. `yarn build`
6. `pm2 reload` → `/api/health` চেক করে; ব্যর্থ হলে rollback command দেখায়

> Build এর সময় (১–৩ মিনিট) সাইট ক্ষণিকের জন্য ধীর/অপ্রাপ্য হতে পারে — ভিড় কম সময়ে (যেমন রাতে) deploy করুন।

---

## ১১. Migration — কী করতে হবে

### নতুন migration তৈরি (শুধু নিজের PC তে)

```bash
# prisma/schema.prisma বদলানোর পর
yarn db:migrate --name <short_description>     # যেমন add_customer_tin
git add prisma/schema.prisma prisma/migrations
git commit -m "..."
```

### Production এ প্রয়োগ
`bash scripts/deploy.sh` চালালেই `prisma migrate deploy` সব **pending** migration ক্রমানুসারে প্রয়োগ করে। আলাদা করে চালাতে:

```bash
npx prisma migrate status     # কোনগুলো বাকি দেখুন
yarn db:deploy                # প্রয়োগ করুন
```

### নিয়ম (খুব জরুরি)
- ❌ সার্ভারে কখনো `prisma migrate dev`, `prisma db push` বা `migrate reset` চালাবেন না — এগুলো data মুছে দিতে পারে।
- ❌ একবার প্রয়োগ হওয়া migration ফাইল কখনো edit/delete করবেন না; নতুন migration দিয়ে সংশোধন করুন।
- ✅ Migration এর আগে সবসময় backup (deploy.sh নিজেই করে)।
- ✅ Column rename/drop এর মত ঝুঁকিপূর্ণ বদল দুই ধাপে করুন: (১) নতুন column যোগ + data কপি (backfill migration), কোড নতুন column ব্যবহার করে deploy; (২) পরের release এ পুরনো column সরান।
- ✅ বিদ্যমান data ঠিক করতে **data/backfill migration** লিখুন (`yarn db:migrate --create-only --name backfill_x`, তারপর SQL লিখে `yarn db:migrate`) — যেমন `prisma/migrations/*_backfill_receipt_order_and_billing_meta`।

### Migration ব্যর্থ হলে
```bash
npx prisma migrate status                       # কোনটা failed দেখুন
# কারণ ঠিক করুন (log দেখুন), তারপর:
npx prisma migrate resolve --rolled-back <migration_folder_name>   # আংশিক বদল নিজে উল্টে দেওয়ার পর
yarn db:deploy                                                     # আবার চালান
# অথবা যদি SQL হাতে প্রয়োগ করে ফেলেছেন:
npx prisma migrate resolve --applied <migration_folder_name>
```
অবস্থা জটিল হলে backup থেকে restore (ধাপ ১৩) করে আগের কোডে ফিরে যান।

### বর্তমান migrations
| Migration | কী করে |
|---|---|
| `*_init` | সব টেবিল (প্রথম সংস্করণ) |
| `*_receipt_order_link_return_print_billing_plan` | `money_receipts.salesOrderId`, `billing_invoices.kind/planId/billingCycle`, `sales_returns.printCount/lastPrintedAt` |
| `*_backfill_receipt_order_and_billing_meta` | পুরনো রেকর্ডে উপরের নতুন column গুলো পূরণ (বারবার চালালেও নিরাপদ) |

---

## ১২. Backup

- `deploy.sh` প্রতি deploy এর আগে backup নেয়।
- দৈনিক স্বয়ংক্রিয় backup: CloudPanel Cron Jobs এ যোগ করুন —
  - Schedule: `30 2 * * *` (প্রতিদিন রাত ২:৩০)
  - Command:
    ```bash
    cd /home/texon/htdocs/app.example.com && set -a && . ./.env && set +a && MYSQL_PWD=$(node -e 'console.log(decodeURIComponent(new URL(process.env.DATABASE_URL).password))') mysqldump -u texonpos --single-transaction --no-tablespaces texonpos | gzip > /home/texon/backups/daily-$(date +\%F).sql.gz && find /home/texon/backups -name 'daily-*.sql.gz' -mtime +14 -delete
    ```
- CloudPanel এর **Admin Area → Backups / Remote Backup** দিয়ে S3/Wasabi/Backblaze এ off-site কপি রাখুন (NFR-SEC-06)। মাসে একবার restore টেস্ট করুন।

---

## ১৩. Rollback / Restore

**শুধু কোড ফেরত** (migration ছিল না):
```bash
cd ~/htdocs/app.example.com
git log --oneline -5
git checkout <previous_commit>
yarn install --frozen-lockfile && yarn build && pm2 reload texonpos
```

**Database restore** (migration এর পর সমস্যা হলে):
```bash
pm2 stop texonpos
set -a; . ./.env; set +a
gunzip -c ~/backups/texonpos-<time>.sql.gz | MYSQL_PWD='<db-password>' mysql -u texonpos texonpos
git checkout <commit_before_migration>
yarn install --frozen-lockfile && yarn build && pm2 start ecosystem.config.cjs
```
> Restore করলে backup এর পরের সব নতুন লেনদেন হারাবে — তাই restore শেষ উপায়।

---

## ১৪. Log ও সমস্যা সমাধান

| সমস্যা | কী দেখবেন / করবেন |
|---|---|
| সাইট 502 Bad Gateway | `pm2 status`, `pm2 logs texonpos --lines 100` — অ্যাপ বন্ধ থাকলে `pm2 start ecosystem.config.cjs` |
| Build এ "JavaScript heap out of memory" | swap যোগ করুন বা `NODE_OPTIONS=--max-old-space-size=3072 yarn build` |
| `P1001 Can't reach database` | `.env` এর `DATABASE_URL` (host `127.0.0.1`, password URL-encoded কিনা) |
| `prisma generate` / install এ env error | `.env` ফাইল আছে কিনা, `DATABASE_URL` সেট কিনা |
| OTP/রিসেট ইমেইল যাচ্ছে না | SMTP মান; `pm2 logs` এ "email (dev)" দেখালে SMTP_HOST খালি |
| লগইন হয়, কিন্তু সাথে সাথে logout | `APP_URL` https সহ সঠিক কিনা; SSL চালু কিনা (production এ cookie `secure`) |
| Nginx log | `/home/texon/logs/nginx/` |

দরকারি command:
```bash
pm2 status | pm2 logs texonpos | pm2 restart texonpos | pm2 monit
npx prisma migrate status
curl -s https://app.example.com/api/health
```

---

## ১৫. Production checklist

- [ ] DNS A record + Let's Encrypt SSL চালু
- [ ] `.env` এ শক্ত random `JWT_*`, `CRON_SECRET`; `chmod 600 .env`
- [ ] SMTP কাজ করছে (signup OTP টেস্ট)
- [ ] `yarn db:deploy` ও `NODE_ENV=production yarn db:seed` সম্পন্ন
- [ ] Super admin password শক্ত; `/admin/settings` এ আসল payment instructions
- [ ] PM2 `@reboot` cron + দৈনিক DB backup cron + off-site backup
- [ ] Firewall: 8443 শুধু নিজের IP; 3306 বন্ধ
- [ ] Uptime monitor `/api/health`
