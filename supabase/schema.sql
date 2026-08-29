-- ============================================================================
-- Indigo Forge Investor Portal — Database Schema & Row-Level Security (RLS)
-- Target Platform: Supabase (PostgreSQL 15+)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'investor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. POOLS TABLE (Fund / Strategy Master Record)
CREATE TABLE IF NOT EXISTS public.pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    total_units NUMERIC(18, 6) NOT NULL DEFAULT 0,
    unit_price NUMERIC(18, 6) NOT NULL DEFAULT 1.000000,
    total_nav NUMERIC(18, 2) GENERATED ALWAYS AS (total_units * unit_price) STORED,
    high_water_mark NUMERIC(18, 6) NOT NULL DEFAULT 1.000000,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INVESTORS TABLE (Investor Profile)
CREATE TABLE IF NOT EXISTS public.investors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INVESTOR ALLOCATIONS TABLE (Private Ownership & Participation %)
CREATE TABLE IF NOT EXISTS public.investor_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
    units_held NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (units_held >= 0),
    invested_capital NUMERIC(18, 2) NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (investor_id, pool_id)
);

-- 6. POOL SNAPSHOTS TABLE (Historical NAV & Performance Tracking)
CREATE TABLE IF NOT EXISTS public.pool_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_equity NUMERIC(18, 2) NOT NULL,
    nav_per_unit NUMERIC(18, 6) NOT NULL,
    max_drawdown_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pool_id, snapshot_date)
);

-- ============================================================================
-- HELPER FUNCTIONS FOR SECURITY RULES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS 47018
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    );
47018;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Strict enforcement: No public reads; users only read their own data.
-- ============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_snapshots ENABLE ROW LEVEL SECURITY;

-- 1. user_roles policies
CREATE POLICY "Users can view own role"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 2. pools policies
CREATE POLICY "Authenticated investors can view pool summaries"
    ON public.pools FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage pools"
    ON public.pools FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 3. investors policies
CREATE POLICY "Investors can view own profile"
    ON public.investors FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage investors"
    ON public.investors FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 4. investor_allocations policies (CRITICAL: Zero leak of participation %)
CREATE POLICY "Investors can ONLY view their own allocation"
    ON public.investor_allocations FOR SELECT
    TO authenticated
    USING (
        investor_id IN (SELECT id FROM public.investors WHERE user_id = auth.uid())
        OR public.is_admin()
    );

CREATE POLICY "Admins can manage allocations"
    ON public.investor_allocations FOR ALL
    TO authenticated
    USING (public.is_admin());

-- 5. pool_snapshots policies
CREATE POLICY "Authenticated investors can view historical snapshots"
    ON public.pool_snapshots FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage snapshots"
    ON public.pool_snapshots FOR ALL
    TO authenticated
    USING (public.is_admin());
