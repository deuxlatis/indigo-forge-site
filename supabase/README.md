# Indigo Forge Investor Portal — Supabase Setup

This directory contains the database migration and Row-Level Security (RLS) policies for the **Indigo Forge Investor Portal**.

---

## Architecture & Security Model

GitHub Pages serves static frontend assets. To protect private investor identities, participation percentages, and equity holdings:
- **No private investor data is stored in the repository or static JSON.**
- All queries are executed by the browser against **Supabase (PostgreSQL 15+)**.
- PostgreSQL **Row-Level Security (RLS)** strictly ensures:
  1. An authenticated investor can **only** read their own allocated units and ownership percentage.
  2. Unauthenticated visitors receive zero data.
  3. Only users with the `admin` role can view the master investor roster.

---

## Quick Setup Instructions

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project named `indigo-forge`.
2. Note your **Project URL** (e.g., `https://xyzcompany.supabase.co`) and **anon public API key** from **Project Settings → API**.

### 2. Run Database Migrations
1. In the Supabase dashboard, open the **SQL Editor**.
2. Copy the entire contents of [`schema.sql`](schema.sql) into the editor.
3. Click **Run** to provision the tables, foreign keys, and RLS policies.

### 3. Connect the Frontend
Open `assets/investors.js` and configure your Supabase credentials:

```javascript
const SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_PUBLIC_KEY"
};
```

### 4. Create Users & Set Roles
1. In the Supabase dashboard, go to **Authentication → Users** and invite or create investor email accounts.
2. In the **SQL Editor**, assign their role and link them to the pool:

```sql
-- 1. Create initial pool
INSERT INTO public.pools (name, currency, total_units, unit_price)
VALUES ('Indigo Forge Alpha Pool', 'USD', 100000.000000, 1.345000);

-- 2. Link a user (replace with actual auth.users UUID)
INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'investor');

INSERT INTO public.investors (user_id, full_name, email)
VALUES ('00000000-0000-0000-0000-000000000000', 'Investor Name', 'investor@example.com');

-- 3. Assign 15,000 units (15% ownership)
INSERT INTO public.investor_allocations (investor_id, pool_id, units_held, invested_capital)
SELECT i.id, p.id, 15000.000000, 15000.00
FROM public.investors i, public.pools p
WHERE i.email = 'investor@example.com' AND p.name = 'Indigo Forge Alpha Pool';
```

---

## Security Verification

You can verify that RLS is working by attempting an unauthenticated API call:

```bash
curl 'https://YOUR_PROJECT_REF.supabase.co/rest/v1/investor_allocations' \
  -H 'apikey: YOUR_ANON_KEY'
# Returns empty array [] — zero data leaked!
```
