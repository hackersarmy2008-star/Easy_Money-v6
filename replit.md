# Easy Money

## Overview
Easy Money Premium is a mobile-responsive web application simulating an agricultural investment platform. It enables users to register, log in, view investment products, manage their balance, and participate in a referral program. The application features a complete backend API with a SQLite database and an automated UPI payment rotation system. The project aims to provide a professional and premium user experience with a golden-themed interface and robust security features.

## User Preferences
I prefer detailed explanations. Do not make changes to the folder Z. Do not make changes to the file Y.

## System Architecture

### UI/UX Decisions
The application features a premium golden theme (`#FFD700`) applied across all pages, including the admin panel, with golden gradient backgrounds. The design prioritizes mobile responsiveness, with optimizations for various screen sizes (768px, 480px, 420px, 360px breakpoints) to ensure a touch-friendly interface. Professional stock images are used for products and investment plans to enhance visual presentation.

### Technical Implementations
The project uses a standard web application architecture:
- **Frontend**: Built with HTML5, CSS3, and Vanilla JavaScript for a lightweight and responsive user interface.
- **Backend**: Implemented with Express.js and Node.js, providing a RESTful API.
- **Database**: SQLite (using `better-sqlite3`) for persistent storage, enabling efficient data management with synchronous operations and WAL mode for performance. Database schema includes:
  - Users table with wallet balance tracking
  - Investments table with daily growth timestamps
  - Withdrawals table for approval workflow
  - Transactions table with comprehensive audit fields (old_balance, new_balance, admin_id, remarks)
  - Check-ins table for daily bonus tracking
  - QR codes table for UPI rotation system
- **Authentication**: JWT (JSON Web Tokens) for secure user and admin authentication with bcrypt for password hashing. JWTs have a 30-day expiration for users and 24-hour expiration for admins.
- **Payment System**: Features a custom UPI payment system with 7 UPI IDs configured for automatic rotation after every 10 successful payments to distribute the load. Recharge requires UTR number confirmation, and withdrawals are processed to the user's UPI ID.
- **Admin Panel**: A comprehensive dashboard for managing users, transactions, UPI configurations, and withdrawal approvals. Features include:
  - User management and statistics
  - Transaction history and status tracking
  - Pending payment approvals for recharges
  - Withdrawal approval system with approve/deny actions
  - Investment statistics tracking
  - UPI rotation system management
  - Secured with dedicated login and environment variable-based credentials
- **Dynamic Invitation Links**: Unique invitation links are generated for each user based on their referral code, automatically refreshing from user profile data.

### Feature Specifications
- **Authentication**: User registration with phone and password, JWT-based login, automatic referral code generation.
- **Dashboard**: Displays banners, quick actions (Check-in, Invest, Recharge, Withdraw), special investment plans, and recent transactions.
- **Investment System**: 
  - Users can create investments from the home page and products page by clicking "Invest" buttons on product cards
  - Investments are deducted from wallet balance with real-time validation
  - Daily ₹100 automatic growth added to wallet for each active investment
  - Investment tracking with last growth time to ensure 24-hour intervals
  - Comprehensive transaction logging for all investment activities
  - Investment history page (investments.html) displays only past investments and earnings summary
  - Users can access investment history via "My Investments" link in profile page
- **Products**: Lists investment products with daily/total income calculations and one-click investment.
- **Promotion**: Shows referral statistics, unique invitation links, and supports a multi-level commission structure.
- **Profile**: Displays user profile, real-time balance, statistics (total recharge, withdraw, welfare), and quick links.
- **Payment Gateway**: 
  - Dedicated deposit and withdrawal pages with quick amount buttons
  - UPI payment method selection and UTR submission
  - Withdrawal approval system requiring admin review
  - Admin can approve or deny withdrawal requests with reasons
  - Withdrawals only deducted from wallet after admin approval
  - Transaction history with detailed status tracking
  - Minimum withdrawal amount is ₹300
- **Security**: Password hashing, JWT authentication, protected API routes, SQL injection prevention via parameterized queries, transaction integrity with database locks, and comprehensive audit logging.

### System Design Choices
- **API-driven**: Frontend entirely consumes data from the backend API, replacing previous `localStorage` usage.
- **Scalability**: Designed with a clear separation of concerns between frontend and backend.
- **Database Migration**: Transitioned from PostgreSQL to SQLite for simplified deployment and synchronous operations.
- **Environment Variables**: Sensitive information like JWT secrets and admin credentials are managed through environment variables for security.

## External Dependencies
- **Database**: SQLite (`better-sqlite3` npm package)
- **Authentication**: `jsonwebtoken` (for JWTs), `bcrypt` (for password hashing)
- **Frontend Icons**: Bootstrap Icons (via CDN)
- **Payment Integration**: Custom UPI payment processing (requires manual UTR confirmation from users)