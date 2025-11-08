# Admin Panel Access Guide

## Overview
The Easy Money platform now includes a comprehensive admin panel for managing users, transactions, and payments.

## Admin Panel URL
Access the admin panel at: `/admin.html`

## Making a User an Admin

### Method 1: Using Node.js Script
Run the provided script to make any user an admin:
```bash
node make-admin.js <phone_number>
```

Example:
```bash
node make-admin.js 9876543210
```

### Method 2: Direct Database Update
You can also manually update the database:
```bash
sqlite3 database.sqlite "UPDATE users SET is_admin = 1 WHERE phone = '9876543210';"
```

## Admin Panel Features

### 1. Dashboard Statistics
- Total Users
- Total Balance
- Total Recharge Amount
- Total Withdraw Amount

### 2. Users Management
View all registered users with:
- User ID
- Phone Number
- Balance
- Total Recharge
- Total Withdraw
- Referral Code
- Registration Date

### 3. Transactions
View all transactions in the system:
- Transaction ID
- User ID
- Type (recharge/withdraw)
- Amount
- Status
- UPI ID
- UTR Number
- Created Date

### 4. Pending Payments
Manage pending payments with options to:
- Approve recharge requests (credits user balance)
- Reject payments (reverses balance deductions for withdrawals)

## Security Notes

### JWT Secret
⚠️ **Important**: Set the `JWT_SECRET` environment variable for production deployments.

The system currently uses a default JWT secret. For production:
1. Generate a strong random secret
2. Set it as an environment variable
3. Never commit secrets to version control

### Admin Access Control
- Admin routes are protected with JWT authentication
- Only users with `is_admin = 1` can access admin endpoints
- Admin panel checks for admin privileges on login

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  balance REAL DEFAULT 0.00,
  total_recharge REAL DEFAULT 0.00,
  total_withdraw REAL DEFAULT 0.00,
  total_welfare REAL DEFAULT 0.00,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  is_admin INTEGER DEFAULT 0,  -- Admin flag
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Admin Endpoints
- `GET /api/admin/stats` - Get platform statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/transactions` - Get all transactions
- `GET /api/admin/pending` - Get pending payments
- `POST /api/admin/approve` - Approve a payment
- `POST /api/admin/reject` - Reject a payment

All admin endpoints require:
1. Valid JWT token in Authorization header
2. User must have `is_admin = 1` flag

## Troubleshooting

### Can't Access Admin Panel
1. Ensure you're logged in
2. Check that your user has `is_admin = 1` in the database
3. Clear browser cache and re-login

### Missing Columns Error
If you see "no such column: is_admin":
1. Restart the server - it will auto-migrate the database
2. The migration adds the column automatically

## Product Images
Product images have been updated to use stock images from the `attached_assets/stock_images/` directory for better visual presentation.
