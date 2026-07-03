# FOURNITY Landing Page

The launch landing page for `fournity.co.za` — funnels visitors into the free
preview or the R350 pre-order, backed by Supabase (leads + orders) and
deployed on Vercel.

## 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
   (or use the existing `kepsarmuhaofhnfrnprj` Z2B Digital project if you
   want everything under one roof — your call, Rev).
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste the contents of `supabase-schema.sql` (in this folder) and run it.
   This creates two tables:
   - `fournity_leads` — everyone who joins the free preview gate
   - `fournity_orders` — every pre-order, whether paid by Yoco or EFT
4. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The anon key is safe to expose in the browser — Row Level Security (RLS) is
already configured in the schema so the public key can only **insert** leads
and orders, never read, update or delete them. You (or whoever manages the
book) view and manage orders from the Supabase dashboard directly, or with a
service-role key in a private admin tool later.

## 2. Deploy to Vercel

1. Push this folder to a GitHub repository (e.g. `z2bpodcast/fournity-landing`).
2. Go to [vercel.com](https://vercel.com) -> **Add New Project** -> import that repo.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_YOCO_PUBLIC_KEY` (already live: `pk_live_6659251fdV6b2GJaeec4`)
   - `NEXT_PUBLIC_BOOK_URL` (the digital book/flipbook URL "Read Free Chapters" sends people to)
4. Click **Deploy**.

## 3. Connect fournity.co.za (bought via domains.co.za)

Once the Vercel project is live:

1. In Vercel -> your project -> **Settings -> Domains**, add `fournity.co.za`
   (and `www.fournity.co.za` if you want both).
2. Vercel will show you either:
   - **A records** to point the domain at (most common for domains.co.za), or
   - **Nameservers** to switch to Vercel's, if you want Vercel to manage DNS entirely.
3. Log in to **domains.co.za**, open the domain's DNS management, and either:
   - Add the **A record** Vercel gives you (usually `76.76.21.21`) for the
     root domain, and a **CNAME** for `www` pointing to `cname.vercel-dns.com`, or
   - Switch the domain's nameservers to Vercel's if you chose that route.
4. Wait for DNS to propagate (can take a few minutes to a few hours).
   Vercel will show "Valid Configuration" once it's connected, and will
   auto-issue an SSL certificate.

If you get stuck on this step, send me a screenshot of what domains.co.za
is asking for and I will tell you exactly what to type in.

## 4. Payment notes

- **Yoco** uses the older client-side popup checkout. It works, but there is
  no server confirming the charge actually succeeded before the page shows
  "paid" -- so treat Yoco orders as needing a quick manual check against your
  Yoco dashboard before dispatching anything, until this is upgraded to a
  proper server-verified checkout.
- **EFT** is fully reliable today: the order is saved to Supabase as
  `payment_status: verifying`, the buyer is asked to WhatsApp proof of
  payment, and you mark it `paid` manually in Supabase once confirmed.

## Local development

```
npm install
cp .env.example .env.local
npm run dev
```

Visit `http://localhost:3000`.
