// api/payment.js
const { db } = require('./db');

// Choose active UPI: first with today_count < rotate_after; if none, reset all counts
function getActiveUPI() {
  try {
    const upi = db.prepare(
      'SELECT id, upi_id, daily_limit, today_count, rotate_after FROM upi_ids WHERE today_count < rotate_after ORDER BY id ASC LIMIT 1'
    ).get();
    if (upi) return upi;

    // reset all and pick first
    db.exec('UPDATE upi_ids SET today_count = 0');
    return db.prepare('SELECT id, upi_id, daily_limit, today_count, rotate_after FROM upi_ids ORDER BY id ASC LIMIT 1').get();
  } catch (e) {
    console.error('getActiveUPI error:', e);
    return null;
  }
}

/* ========== RECHARGE ========== */
async function initiateRecharge(req, res) {
  try {
    const { amount } = req.body;
    const userId = req.user.userId;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const upi = getActiveUPI();
    if (!upi) return res.status(500).json({ error: 'No UPI configured' });

    const trx = db.prepare(
      `INSERT INTO transactions (user_id, type, amount, upi_id, status)
       VALUES (?, 'recharge', ?, ?, 'pending')`
    ).run(userId, amount, upi.id);

    // return UPI for UI to show
    return res.json({
      message: 'Recharge initiated',
      transactionId: trx.lastInsertRowid,
      upi: upi.upi_id,
      amount,
    });
  } catch (err) {
    console.error('initiateRecharge error:', err);
    return res.status(500).json({ error: 'Failed to initiate recharge' });
  }
}

async function confirmRecharge(req, res) {
  try {
    const { transactionId } = req.body;
    const userId = req.user.userId;

    let trx;
    if (transactionId) {
      trx = db.prepare('SELECT id, amount, status, upi_id FROM transactions WHERE id=? AND user_id=? AND type="recharge"').get(transactionId, userId);
    } else {
      trx = db.prepare('SELECT id, amount, status, upi_id FROM transactions WHERE user_id=? AND type="recharge" AND status="pending" ORDER BY created_at DESC LIMIT 1').get(userId);
    }

    if (!trx) return res.status(404).json({ error: 'Recharge not found' });
    if (trx.status === 'approved') {
      const u = db.prepare('SELECT balance FROM users WHERE id=?').get(userId);
      return res.json({ message: 'Recharge already approved', balance: u.balance });
    }

    const apply = db.transaction(() => {
      db.prepare('UPDATE transactions SET status="approved", updated_at=CURRENT_TIMESTAMP WHERE id=?').run(trx.id);
      db.prepare('UPDATE users SET balance = balance + ?, total_recharge = total_recharge + ? WHERE id=?').run(trx.amount, trx.amount, userId);
      if (trx.upi_id) {
        db.prepare('UPDATE upi_ids SET today_count = today_count + 1 WHERE id = ?').run(trx.upi_id);
      }
    });
    apply();

    // optional: log if rotated
    try {
      if (trx.upi_id) {
        const up = db.prepare('SELECT today_count, rotate_after, upi_id FROM upi_ids WHERE id = ?').get(trx.upi_id);
        if (up && up.today_count >= (up.rotate_after || 10)) {
          console.log(`UPI ${up.upi_id} reached rotate_after (${up.today_count}/${up.rotate_after})`);
        }
      }
    } catch (_) {}

    const user = db.prepare('SELECT balance FROM users WHERE id=?').get(userId);
    return res.json({ message: 'Recharge confirmed', balance: user.balance });
  } catch (err) {
    console.error('confirmRecharge error:', err);
    return res.status(500).json({ error: 'Failed to confirm recharge' });
  }
}

/* ========== WITHDRAW ========== */
async function initiateWithdraw(req, res) {
  try {
    const userId = req.user.userId;
    const { amount, upiId } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (amount < 300) return res.status(400).json({ error: 'Minimum withdrawal amount is ₹300' });
    if (!upiId || typeof upiId !== 'string' || upiId.length < 3) return res.status(400).json({ error: 'UPI ID is required' });

    const user = db.prepare('SELECT id, balance FROM users WHERE id=?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    const action = db.transaction(() => {
      db.prepare('INSERT INTO withdrawals (user_id, requested_amount, status, upi_id) VALUES (?, ?, "pending", ?)').run(userId, amount, upiId);

      // deduct immediately
      db.prepare('UPDATE users SET balance = balance - ?, total_withdraw = total_withdraw + ? WHERE id = ?').run(amount, amount, userId);

      db.prepare('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, "withdraw", ?, "pending")').run(userId, amount);
    });
    action();

    const updated = db.prepare('SELECT balance FROM users WHERE id=?').get(userId);
    return res.json({ message: 'Withdrawal request submitted', balance: updated.balance });
  } catch (err) {
    console.error('initiateWithdraw error:', err);
    return res.status(500).json({ error: 'Failed to process withdrawal' });
  }
}

/* ========== QUERIES ========== */
async function getUserWithdrawals(req, res) {
  try {
    const rows = db.prepare('SELECT id, requested_amount, status, upi_id, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
    res.json({ withdrawals: rows });
  } catch (err) {
    console.error('getUserWithdrawals error:', err);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
}

async function getTransactions(req, res) {
  try {
    const rows = db.prepare('SELECT id, type, amount, status, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(req.user.userId);
    res.json({ transactions: rows });
  } catch (err) {
    console.error('getTransactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

/* ========== ADMIN ACTIONS ========== */
async function approveRecharge(req, res) {
  try {
    const { transactionId } = req.body;
    const trx = db.prepare("SELECT id, user_id, amount, status, upi_id FROM transactions WHERE id=? AND type='recharge'").get(transactionId);
    if (!trx) return res.status(404).json({ error: 'Recharge transaction not found' });

    if (trx.status !== 'approved') {
      const t = db.transaction(() => {
        db.prepare('UPDATE transactions SET status="approved", updated_at=CURRENT_TIMESTAMP WHERE id=?').run(trx.id);
        db.prepare('UPDATE users SET balance = balance + ?, total_recharge = total_recharge + ? WHERE id=?').run(trx.amount, trx.amount, trx.user_id);
        if (trx.upi_id) db.prepare('UPDATE upi_ids SET today_count = today_count + 1 WHERE id = ?').run(trx.upi_id);
      });
      t();
    }
    res.json({ message: 'Recharge approved' });
  } catch (err) {
    console.error('approveRecharge error:', err);
    res.status(500).json({ error: 'Failed to approve recharge' });
  }
}

async function approveWithdrawal(req, res) {
  try {
    const { withdrawalId } = req.body;
    const w = db.prepare('SELECT id, user_id, requested_amount, status FROM withdrawals WHERE id=?').get(withdrawalId);
    if (!w) return res.status(404).json({ error: 'Withdrawal not found' });
    if (w.status === 'approved') return res.json({ message: 'Already approved' });

    db.prepare('UPDATE withdrawals SET status="approved", updated_at=CURRENT_TIMESTAMP WHERE id=?').run(w.id);
    db.prepare('UPDATE transactions SET status="approved", updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND type="withdraw" AND amount=? AND status="pending" ORDER BY created_at DESC LIMIT 1').run(w.user_id, w.requested_amount);

    res.json({ message: 'Withdrawal approved' });
  } catch (err) {
    console.error('approveWithdrawal error:', err);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
}

async function denyWithdrawal(req, res) {
  try {
    const { withdrawalId, reason } = req.body;
    const w = db.prepare('SELECT id, user_id, requested_amount, status FROM withdrawals WHERE id=?').get(withdrawalId);
    if (!w) return res.status(404).json({ error: 'Withdrawal not found' });

    const undo = db.transaction(() => {
      db.prepare('UPDATE withdrawals SET status="denied", reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(reason || 'Denied', w.id);
      // refund
      db.prepare('UPDATE users SET balance = balance + ? WHERE id=?').run(w.requested_amount, w.user_id);
      db.prepare('UPDATE transactions SET status="failed", updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND type="withdraw" AND amount=? AND status="pending" ORDER BY created_at DESC LIMIT 1').run(w.user_id, w.requested_amount);
    });
    undo();

    res.json({ message: 'Withdrawal denied and amount refunded' });
  } catch (err) {
    console.error('denyWithdrawal error:', err);
    res.status(500).json({ error: 'Failed to deny withdrawal' });
  }
}

module.exports = {
  initiateRecharge,
  confirmRecharge,
  initiateWithdraw,
  getUserWithdrawals,
  getTransactions,
  approveRecharge,
  approveWithdrawal,
  denyWithdrawal,
};}

async function approveRecharge(req, res) {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: 'Transaction ID is required' });
  }

  try {
    const transaction = db.prepare(
      'SELECT id, user_id, amount, status FROM transactions WHERE id = ? AND type = ?'
    ).get(transactionId, 'recharge');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'completed') {
      return res.status(400).json({ error: 'Transaction already approved' });
    }

    const approveTransaction = db.transaction(() => {
      db.prepare(
        'UPDATE transactions SET status = ? WHERE id = ?'
      ).run('completed', transactionId);

      const amount = parseFloat(transaction.amount);
      db.prepare(
        'UPDATE users SET balance = balance + ?, total_recharge = total_recharge + ? WHERE id = ?'
      ).run(amount, amount, transaction.user_id);
    });

    approveTransaction();

    incrementPaymentAndRotate();

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(transaction.user_id);

    res.json({
      message: 'Recharge approved successfully',
      balance: user.balance
    });
  } catch (error) {
    console.error('Approve recharge error:', error);
    res.status(500).json({ error: 'Failed to approve recharge' });
  }
}

async function initiateWithdraw(req, res) {
  const { amount, upiId } = req.body;
  const userId = req.user.userId;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  if (amount < 300) {
    return res.status(400).json({ error: 'Minimum withdrawal amount is ₹300' });
  }

  if (!upiId) {
    return res.status(400).json({ error: 'UPI ID is required' });
  }

  try {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    const currentBalance = parseFloat(user.balance);

    if (currentBalance < amount) {
      return res.status(400).json({ 
        error: "You don't have enough balance to withdraw." 
      });
    }

    const result = db.prepare(
      `INSERT INTO withdrawals (user_id, requested_amount, status, upi_id) 
       VALUES (?, ?, ?, ?)`
    ).run(userId, amount, 'pending', upiId);

    const withdrawalId = result.lastInsertRowid;

    res.json({
      message: 'Processing — please wait up to 24 hours for admin approval.',
      withdrawalId: withdrawalId,
      amount: amount,
      status: 'pending'
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
}

async function approveWithdrawal(req, res) {
  const { withdrawalId } = req.body;
  const adminId = req.user.userId;

  if (!withdrawalId) {
    return res.status(400).json({ error: 'Withdrawal ID is required' });
  }

  try {
    const withdrawal = db.prepare(
      'SELECT id, user_id, requested_amount, status, upi_id FROM withdrawals WHERE id = ?'
    ).get(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: 'Withdrawal already processed' });
    }

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(withdrawal.user_id);
    
    if (user.balance < withdrawal.requested_amount) {
      return res.status(400).json({ error: 'User has insufficient balance' });
    }

    const oldBalance = user.balance;
    const newBalance = oldBalance - withdrawal.requested_amount;

    const approveTransaction = db.transaction(() => {
      db.prepare(
        'UPDATE withdrawals SET status = ?, admin_id = ?, updated_at = datetime(?) WHERE id = ?'
      ).run('approved', adminId, new Date().toISOString(), withdrawalId);

      db.prepare(
        'UPDATE users SET balance = ?, total_withdraw = total_withdraw + ? WHERE id = ?'
      ).run(newBalance, withdrawal.requested_amount, withdrawal.user_id);

      db.prepare(
        `INSERT INTO transactions (user_id, type, amount, status, old_balance, new_balance, admin_id, remarks, upi_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        withdrawal.user_id, 
        'withdraw', 
        withdrawal.requested_amount, 
        'completed',
        oldBalance,
        newBalance,
        adminId,
        `Withdrawal approved by admin - ID: ${withdrawalId}`,
        withdrawal.upi_id
      );
    });

    approveTransaction();

    res.json({
      message: 'Withdrawal approved successfully',
      withdrawalId: withdrawalId,
      amount: withdrawal.requested_amount,
      userNewBalance: newBalance.toFixed(2)
    });
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
}

async function denyWithdrawal(req, res) {
  const { withdrawalId, reason } = req.body;
  const adminId = req.user.userId;

  if (!withdrawalId) {
    return res.status(400).json({ error: 'Withdrawal ID is required' });
  }

  try {
    const withdrawal = db.prepare(
      'SELECT id, user_id, requested_amount, status FROM withdrawals WHERE id = ?'
    ).get(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: 'Withdrawal already processed' });
    }

    db.prepare(
      'UPDATE withdrawals SET status = ?, admin_id = ?, reason = ?, updated_at = datetime(?) WHERE id = ?'
    ).run('denied', adminId, reason || 'Denied by admin', new Date().toISOString(), withdrawalId);

    res.json({
      message: 'Withdrawal denied successfully',
      withdrawalId: withdrawalId
    });
  } catch (error) {
    console.error('Deny withdrawal error:', error);
    res.status(500).json({ error: 'Failed to deny withdrawal' });
  }
}

async function getUserWithdrawals(req, res) {
  const userId = req.user.userId;

  try {
    const withdrawals = db.prepare(
      `SELECT id, requested_amount, status, upi_id, reason, created_at, updated_at 
       FROM withdrawals 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`
    ).all(userId);

    res.json({ withdrawals });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
}

async function getTransactions(req, res) {
  const userId = req.user.userId;

  try {
    const result = db.prepare(
      `SELECT id, type, amount, status, upi_id, utr_number, created_at 
       FROM transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`
    ).all(userId);

    res.json({ transactions: result });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

module.exports = {
  initiateRecharge,
  confirmRecharge,
  approveRecharge,
  initiateWithdraw,
  approveWithdrawal,
  denyWithdrawal,
  getUserWithdrawals,
  getTransactions
};
