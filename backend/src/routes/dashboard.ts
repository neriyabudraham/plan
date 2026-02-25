import { Router, Response } from 'express';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest, DashboardStats, FundProgress } from '../types/index.js';

const router = Router();

// Get dashboard stats
router.get('/stats', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    // Get funds with balances
    const fundsResult = await query(`
      SELECT 
        f.id, f.name, f.icon, f.color, f.currency, f.target_amount,
        COALESCE(SUM(CASE 
          WHEN t.type IN ('deposit', 'interest') THEN t.amount 
          WHEN t.type IN ('withdrawal', 'adjustment') THEN -t.amount 
          ELSE 0 
        END), 0) as current_balance
      FROM funds f
      LEFT JOIN transactions t ON f.id = t.fund_id
      WHERE f.is_active = true
      GROUP BY f.id
      ORDER BY current_balance DESC
    `);
    
    // Get monthly summary
    const monthlyResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type IN ('deposit', 'interest') THEN amount ELSE 0 END), 0) as deposits,
        COALESCE(SUM(CASE WHEN type IN ('withdrawal', 'adjustment') THEN amount ELSE 0 END), 0) as withdrawals
      FROM transactions
      WHERE transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    const funds = fundsResult.rows;
    const monthly = monthlyResult.rows[0];
    
    const totalBalance = funds.reduce((sum, f) => sum + Number(f.current_balance), 0);
    
    const fundsProgress: FundProgress[] = funds.map(f => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      color: f.color,
      currency: f.currency,
      currentBalance: Number(f.current_balance),
      targetAmount: Number(f.target_amount),
      progressPercent: f.target_amount > 0 
        ? Math.min(Math.round((Number(f.current_balance) / Number(f.target_amount)) * 100), 100)
        : 0,
    }));
    
    const stats: DashboardStats = {
      totalBalance,
      totalFunds: funds.length,
      monthlyDeposits: Number(monthly.deposits),
      monthlyWithdrawals: Number(monthly.withdrawals),
      fundsProgress,
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get balance history (all funds combined)
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = '12m' } = req.query;
    
    let interval: string;
    let groupBy: string;
    let dateFormat: string;
    
    switch (period) {
      case '7d':
        interval = '7 days';
        groupBy = 'day';
        dateFormat = 'DD/MM';
        break;
      case '30d':
        interval = '30 days';
        groupBy = 'day';
        dateFormat = 'DD/MM';
        break;
      case '6m':
        interval = '6 months';
        groupBy = 'week';
        dateFormat = 'DD/MM';
        break;
      case '12m':
      default:
        interval = '12 months';
        groupBy = 'month';
        dateFormat = 'MM/YYYY';
        break;
    }
    
    const result = await query(`
      WITH date_series AS (
        SELECT generate_series(
          DATE_TRUNC($1, NOW() - INTERVAL '${interval}'),
          DATE_TRUNC($1, NOW()),
          ('1 ' || $1)::interval
        )::date as date
      ),
      daily_transactions AS (
        SELECT 
          DATE_TRUNC($1, transaction_date)::date as date,
          SUM(CASE 
            WHEN type IN ('deposit', 'interest') THEN amount 
            WHEN type IN ('withdrawal', 'adjustment') THEN -amount 
            ELSE 0 
          END) as net_change
        FROM transactions t
        JOIN funds f ON t.fund_id = f.id
        WHERE f.is_active = true AND transaction_date >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC($1, transaction_date)
      )
      SELECT 
        ds.date,
        COALESCE(dt.net_change, 0) as net_change
      FROM date_series ds
      LEFT JOIN daily_transactions dt ON ds.date = dt.date
      ORDER BY ds.date
    `, [groupBy]);
    
    // Get initial balance (before the period)
    const initialResult = await query(`
      SELECT COALESCE(SUM(CASE 
        WHEN t.type IN ('deposit', 'interest') THEN t.amount 
        WHEN t.type IN ('withdrawal', 'adjustment') THEN -t.amount 
        ELSE 0 
      END), 0) as balance
      FROM transactions t
      JOIN funds f ON t.fund_id = f.id
      WHERE f.is_active = true AND t.transaction_date < NOW() - INTERVAL '${interval}'
    `);
    
    let runningBalance = Number(initialResult.rows[0].balance);
    
    const history = result.rows.map(row => {
      runningBalance += Number(row.net_change);
      return {
        date: row.date,
        balance: runningBalance,
      };
    });
    
    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get distribution by fund
router.get('/distribution', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        f.name,
        f.icon,
        f.color,
        f.currency,
        COALESCE(SUM(CASE 
          WHEN t.type IN ('deposit', 'interest') THEN t.amount 
          WHEN t.type IN ('withdrawal', 'adjustment') THEN -t.amount 
          ELSE 0 
        END), 0) as balance
      FROM funds f
      LEFT JOIN transactions t ON f.id = t.fund_id
      WHERE f.is_active = true
      GROUP BY f.id
      HAVING COALESCE(SUM(CASE 
        WHEN t.type IN ('deposit', 'interest') THEN t.amount 
        WHEN t.type IN ('withdrawal', 'adjustment') THEN -t.amount 
        ELSE 0 
      END), 0) > 0
      ORDER BY balance DESC
    `);
    
    res.json(result.rows.map(r => ({
      name: r.name,
      icon: r.icon,
      color: r.color,
      currency: r.currency,
      balance: Number(r.balance),
    })));
  } catch (error) {
    console.error('Get distribution error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get recent activity
router.get('/activity', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        t.*,
        f.name as fund_name,
        f.icon as fund_icon,
        f.color as fund_color,
        f.currency as fund_currency,
        u.name as user_name
      FROM transactions t
      JOIN funds f ON t.fund_id = f.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE f.is_active = true
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    
    res.json(result.rows.map(t => ({
      ...t,
      amount: Number(t.amount),
    })));
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
