import { pool } from './pool';
import bcrypt from 'bcryptjs';
import { config } from '../config/index';
import { v4 as uuidv4 } from 'uuid';

const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create extensions
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    
    // Create enum types
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'interest', 'adjustment');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE frequency_type AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE notification_target_type AS ENUM ('phone', 'group');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE alert_type AS ENUM ('target_reached', 'milestone', 'reminder', 'weekly_summary', 'monthly_summary');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Users table
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

    // Funds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS funds (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50) DEFAULT '💰',
        color VARCHAR(7) DEFAULT '#3B82F6',
        target_amount DECIMAL(15, 2) DEFAULT 0,
        target_date DATE,
        currency VARCHAR(3) DEFAULT 'ILS',
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        fund_id UUID REFERENCES funds(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL,
        type transaction_type NOT NULL,
        description TEXT,
        transaction_date DATE DEFAULT CURRENT_DATE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Recurring deposits table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_deposits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        fund_id UUID REFERENCES funds(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL,
        frequency frequency_type NOT NULL,
        day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
        day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
        is_active BOOLEAN DEFAULT true,
        next_run DATE NOT NULL,
        last_run DATE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // WhatsApp settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        api_key VARCHAR(255) NOT NULL,
        session VARCHAR(100) NOT NULL,
        notification_target VARCHAR(255) NOT NULL,
        notification_type notification_target_type NOT NULL,
        is_active BOOLEAN DEFAULT true,
        notify_on_deposit BOOLEAN DEFAULT true,
        notify_on_withdrawal BOOLEAN DEFAULT true,
        notify_on_target_reached BOOLEAN DEFAULT true,
        notify_on_milestone BOOLEAN DEFAULT true,
        notify_weekly_summary BOOLEAN DEFAULT false,
        notify_monthly_summary BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        fund_id UUID REFERENCES funds(id) ON DELETE CASCADE,
        type alert_type NOT NULL,
        threshold_percent INTEGER CHECK (threshold_percent >= 0 AND threshold_percent <= 100),
        message TEXT,
        is_triggered BOOLEAN DEFAULT false,
        triggered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Password reset tokens table
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

    // Invitation tokens table
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

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_fund_id ON transactions(fund_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recurring_deposits_next_run ON recurring_deposits(next_run);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_fund_id ON alerts(fund_id);`);

    // Create admin user if not exists
    const adminExists = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [config.app.adminEmail]
    );

    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await client.query(
        `INSERT INTO users (id, email, password, name, role, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), config.app.adminEmail, hashedPassword, 'מנהל', 'admin', true]
      );
      console.log(`Admin user created: ${config.app.adminEmail} (password: admin123)`);
    }

    await client.query('COMMIT');
    console.log('Database initialized successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

initDatabase();
