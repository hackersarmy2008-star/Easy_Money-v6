# Investment System Guide

## Overview
Your website now has a fully functional investment and wallet system with automatic daily growth, admin-controlled withdrawals, and comprehensive transaction logging.

## Key Features

### 1. Investment System
- **Users can invest directly from their wallet balance**
- **Daily ₹100 automatic growth** added to wallet for each active investment
- **24-hour interval tracking** ensures growth happens exactly once per day per investment
- **Multiple investments support** - users with multiple investments get ₹100 for each
- **Comprehensive transaction logging** for all investment activities

### 2. Withdrawal Approval System
- **Admin approval required** before any withdrawal is processed
- **No immediate deduction** - money stays in wallet until admin approves
- **Approve or Deny** with optional reason for denial
- **User-friendly status messages** throughout the process

### 3. Daily Growth Automation

#### Manual Trigger
You can manually trigger the daily growth process by calling:
```bash
curl -X POST http://localhost:5000/api/cron/daily-growth
```

Or from your Replit console:
```bash
node cron-daily-growth.js
```

#### Automated Schedule (Recommended)
To run daily growth automatically every 24 hours, you have several options:

**Option 1: External Cron Service (Recommended)**
Use a free service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

1. Sign up for the service
2. Create a new cron job
3. Set the URL to: `https://YOUR-REPLIT-DOMAIN/api/cron/daily-growth`
4. Set the schedule to run once daily (e.g., 12:00 AM)
5. Set method to POST
6. Save and activate

**Option 2: GitHub Actions (Free)**
Create a GitHub Actions workflow that runs daily and calls your endpoint.

**Option 3: Internal Scheduler**
If you want to run it within your Replit, you could add a simple scheduler to your backend-server.js:

```javascript
// Add to backend-server.js
const DAILY_GROWTH_HOUR = 0; // Run at midnight

setInterval(() => {
  const now = new Date();
  if (now.getHours() === DAILY_GROWTH_HOUR && now.getMinutes() === 0) {
    fetch('http://localhost:5000/api/cron/daily-growth', { method: 'POST' })
      .then(res => res.json())
      .then(data => console.log('Daily growth:', data))
      .catch(err => console.error('Daily growth failed:', err));
  }
}, 60000); // Check every minute
```

## API Endpoints

### Investment Endpoints
- `POST /api/invest` - Create new investment (requires wallet balance)
- `GET /api/investments` - Get user's investments and summary
- `POST /api/cron/daily-growth` - Process daily ₹100 growth for all active investors

### Withdrawal Endpoints
- `POST /api/payment/withdraw` - Submit withdrawal request
- `GET /api/withdrawals` - Get user's withdrawal history
- `POST /api/admin/withdraw/:id/approve` - Admin: Approve withdrawal
- `POST /api/admin/withdraw/:id/deny` - Admin: Deny withdrawal
- `GET /api/admin/pending-withdrawals` - Admin: Get pending withdrawals

## User Flow

### Investing
1. User goes to "Invest" from home page quick actions
2. Enters investment amount
3. System validates wallet balance
4. Investment created, amount deducted from wallet
5. Daily ₹100 growth starts after 24 hours

### Withdrawing
1. User requests withdrawal from withdraw page
2. Request goes to admin panel as "pending"
3. Admin reviews and approves or denies
4. If approved: money deducted from wallet, user notified
5. If denied: money stays in wallet, user sees reason

## Admin Panel

Access the admin panel at `/admin.html` (requires admin login credentials set in environment variables).

### Withdrawal Approvals Tab
- Shows all pending withdrawal requests
- Displays user phone, amount, UPI ID, and request date
- Click "Approve" to process withdrawal (deducts from wallet)
- Click "Deny" to reject (optional reason can be provided)

## Security Features

1. **Wallet validation** - Users cannot invest more than their balance
2. **Admin-only approvals** - Only authenticated admins can approve withdrawals
3. **Transaction logging** - Every wallet operation logged with old/new balance
4. **Atomic operations** - Database transactions prevent concurrent issues
5. **24-hour enforcement** - Daily growth only happens once per 24-hour period

## Database Schema

### Investments Table
- `id` - Investment ID
- `user_id` - User who made investment
- `amount` - Investment amount
- `daily_profit` - Amount added daily (₹100)
- `total_profit` - Cumulative profit earned
- `status` - active/inactive
- `last_growth_time` - Timestamp of last growth payout
- `created_at` - Investment creation time

### Withdrawals Table
- `id` - Withdrawal request ID
- `user_id` - User requesting withdrawal
- `requested_amount` - Amount requested
- `status` - pending/approved/denied
- `admin_id` - Admin who processed request
- `reason` - Denial reason (if denied)
- `upi_id` - User's UPI ID for payout
- `created_at` - Request timestamp
- `updated_at` - Last update timestamp

### Transactions Table (Enhanced)
- `old_balance` - Balance before transaction
- `new_balance` - Balance after transaction
- `admin_id` - Admin who approved (if applicable)
- `remarks` - Transaction notes

## User Messages

The system provides clear, user-friendly messages at every step:

### Investment
- ✅ **Success**: "Investment successful. ₹100 will be added to your wallet every 24 hours."
- ❌ **Insufficient funds**: "Insufficient wallet balance. Please add funds before investing."

### Withdrawal
- ⏳ **Pending**: "Processing — please wait up to 24 hours for admin approval."
- ✅ **Approved**: "Withdrawal approved successfully."
- ❌ **Denied**: "Withdrawal denied by admin. Funds remain in your wallet."

## Testing

To test the system:

1. **Create an investment**:
   - Add balance to a test user
   - Create investment through the UI
   - Verify balance deducted correctly

2. **Test daily growth**:
   - Manually call: `POST /api/cron/daily-growth`
   - Check that ₹100 was added to investor's wallet
   - Verify transaction log created

3. **Test multiple investments**:
   - Create 2-3 investments for same user
   - Run daily growth
   - Confirm user received ₹100 × number of investments

4. **Test withdrawal approval**:
   - Submit withdrawal request
   - Check admin panel for pending request
   - Approve or deny
   - Verify wallet balance updated correctly

## Troubleshooting

**Daily growth not working?**
- Check that investments have `last_growth_time` set
- Ensure 24 hours have passed since last growth
- Check server logs for any errors

**Withdrawal not deducting from wallet?**
- Verify admin actually clicked "Approve"
- Check if user had sufficient balance at approval time
- Review transaction logs for the withdrawal

**Investment failing?**
- Confirm user has sufficient wallet balance
- Check API logs for validation errors
- Ensure database is accessible

## Next Steps

1. **Set up automated daily growth** using one of the cron options above
2. **Configure admin credentials** in environment variables (ADMIN_USERNAME, ADMIN_PASSWORD)
3. **Test the complete flow** with real user scenarios
4. **Monitor transaction logs** to ensure everything works as expected
5. **Consider adding email/SMS notifications** for withdrawal approvals/denials

## Support

All investment and withdrawal operations are logged in the transactions table with comprehensive details. You can query this table to audit any issues or generate reports.
