import { pool } from './pool';

const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create extensions
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    
    // ============================================
    // ENUM TYPES
    // ============================================
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE gender_type AS ENUM ('male', 'female');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE family_member_type AS ENUM ('self', 'spouse', 'child', 'planned_child');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE employment_type AS ENUM ('self_employed', 'employee', 'company_owner', 'unemployed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE asset_type AS ENUM (
          'savings',           -- חיסכון רגיל
          'investment',        -- תיק השקעות
          'pension',           -- פנסיה
          'study_fund',        -- קרן השתלמות
          'child_savings',     -- חיסכון לילד
          'provident',         -- קופת גמל
          'real_estate',       -- נדל"ן
          'other'              -- אחר
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'interest', 'fee', 'adjustment');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE frequency_type AS ENUM ('once', 'monthly', 'quarterly', 'yearly');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE goal_type AS ENUM (
          'retirement',        -- פרישה
          'child_event',       -- אירוע ילד (בר מצווה, חתונה)
          'purchase',          -- רכישה (רכב, דירה)
          'education',         -- לימודים
          'travel',            -- טיול
          'emergency',         -- קרן חירום
          'custom'             -- מותאם אישית
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE expense_trigger_type AS ENUM (
          'age_months',        -- גיל בחודשים (0-24)
          'age_years',         -- גיל בשנים
          'event'              -- אירוע (בר מצווה, חתונה וכו')
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE notification_target_type AS ENUM ('phone', 'group');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ============================================
    // USERS TABLE
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        role user_role DEFAULT 'viewer',
        google_id VARCHAR(255) UNIQUE,
        avatar VARCHAR(500),
        must_change_password BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // FAMILY PROFILE - הגדרות משפחה
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        family_name VARCHAR(255),
        default_currency VARCHAR(3) DEFAULT 'ILS',
        inflation_rate DECIMAL(5,2) DEFAULT 2.5,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // FAMILY MEMBERS - בני משפחה
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        member_type family_member_type NOT NULL,
        name VARCHAR(255) NOT NULL,
        gender gender_type,
        birth_date DATE,
        expected_birth_date DATE,
        employment_type employment_type DEFAULT 'employee',
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Add employment_type column if not exists (for existing databases)
    await client.query(`
      ALTER TABLE family_members ADD COLUMN IF NOT EXISTS employment_type employment_type DEFAULT 'employee';
    `);

    // ============================================
    // INCOME HISTORY - היסטוריית הכנסות
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS income_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        effective_date DATE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_income_history_member_id ON income_history(member_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_income_history_effective_date ON income_history(effective_date);`);

    // ============================================
    // CHILD EXPENSE TEMPLATES - תבניות עלויות ילד
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS child_expense_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // CHILD EXPENSE ITEMS - פריטי עלות בתבנית
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS child_expense_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_id UUID REFERENCES child_expense_templates(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        trigger_type expense_trigger_type NOT NULL,
        trigger_value INTEGER NOT NULL,
        trigger_value_end INTEGER,
        amount DECIMAL(15,2) NOT NULL,
        frequency frequency_type DEFAULT 'once',
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // CHILD EXPENSE ASSIGNMENTS - שיוך תבנית לילד
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS child_expense_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        child_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
        template_id UUID REFERENCES child_expense_templates(id) ON DELETE CASCADE,
        custom_adjustments JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(child_id, template_id)
      );
    `);

    // ============================================
    // ASSETS - נכסים והשקעות
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
        linked_child_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        asset_type asset_type NOT NULL,
        institution VARCHAR(255),
        account_number VARCHAR(100),
        current_balance DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'ILS',
        
        -- תשואות ודמי ניהול
        expected_annual_return DECIMAL(5,2) DEFAULT 5.0,
        management_fee_percent DECIMAL(5,3) DEFAULT 0,
        management_fee_deposit_percent DECIMAL(5,3) DEFAULT 0,
        
        -- הפקדות קבועות
        monthly_deposit DECIMAL(15,2) DEFAULT 0,
        employer_deposit DECIMAL(15,2) DEFAULT 0,
        
        icon VARCHAR(50) DEFAULT '💰',
        color VARCHAR(7) DEFAULT '#3B82F6',
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // ASSET TRANSACTIONS - תנועות בנכסים
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        type transaction_type NOT NULL,
        description TEXT,
        transaction_date DATE DEFAULT CURRENT_DATE,
        balance_after DECIMAL(15,2),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // RECURRING TRANSACTIONS - הפקדות חוזרות
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        type transaction_type NOT NULL,
        frequency frequency_type NOT NULL,
        day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        next_run DATE NOT NULL,
        last_run DATE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // FINANCIAL GOALS - יעדים פיננסיים
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_goals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        linked_member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
        linked_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        
        name VARCHAR(255) NOT NULL,
        goal_type goal_type NOT NULL,
        target_amount DECIMAL(15,2) NOT NULL,
        current_amount DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'ILS',
        
        target_date DATE,
        target_age INTEGER,
        
        monthly_contribution DECIMAL(15,2) DEFAULT 0,
        priority INTEGER DEFAULT 5,
        
        icon VARCHAR(50) DEFAULT '🎯',
        color VARCHAR(7) DEFAULT '#10B981',
        notes TEXT,
        is_achieved BOOLEAN DEFAULT false,
        achieved_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // SIMULATION SCENARIOS - תרחישי סימולציה
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulation_scenarios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        
        -- פרמטרים לסימולציה
        params JSONB NOT NULL DEFAULT '{}',
        
        -- תוצאות מחושבות (cached)
        results JSONB,
        calculated_at TIMESTAMPTZ,
        
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // MILESTONES - אבני דרך
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS milestones (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE,
        
        name VARCHAR(255) NOT NULL,
        target_amount DECIMAL(15,2) NOT NULL,
        target_date DATE,
        
        is_reached BOOLEAN DEFAULT false,
        reached_at TIMESTAMPTZ,
        notified BOOLEAN DEFAULT false,
        
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // REFRESH TOKENS
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // PASSWORD RESET TOKENS
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // INVITATION TOKENS
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitation_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL,
        role user_role DEFAULT 'viewer',
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false,
        invited_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // WHATSAPP SETTINGS
    // ============================================
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        api_key VARCHAR(255),
        session VARCHAR(100),
        notification_target VARCHAR(255),
        notification_type notification_target_type,
        is_active BOOLEAN DEFAULT false,
        notify_on_milestone BOOLEAN DEFAULT true,
        notify_on_goal_reached BOOLEAN DEFAULT true,
        notify_monthly_summary BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ============================================
    // INDEXES
    // ============================================
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON assets(owner_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_asset_transactions_asset_id ON asset_transactions(asset_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_asset_transactions_date ON asset_transactions(transaction_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON financial_goals(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_run ON recurring_transactions(next_run);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);`);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

initDatabase();
