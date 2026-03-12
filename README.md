# ArshBoost - Professional Game Boosting Platform

A comprehensive game boosting platform built with Next.js 16, Supabase, and TypeScript.

## Features

- 🎮 Multi-game boosting services (Valorant, League of Legends, TFT, Apex Legends)
- 👥 Role-based access control (Client, Booster, Support, Admin, Accountant)
- 💬 Real-time chat system with order management
- 💰 Financial management with withdrawal processing
- 🛡️ Security features with behavioral anomaly detection
- 📱 Responsive design with modern UI components

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Email**: Resend
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Resend account for email services

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd arshboost
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Supabase anon public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `NEXT_PUBLIC_SITE_URL` - Your domain (localhost:3000 for dev)
- `RESEND_API_KEY` - Resend API key for emails
- `RESEND_FROM_EMAIL` - From email address

4. Run database migrations
Set up your Supabase database using the migrations in `supabase/migrations/`.

5. Start the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## Deployment on Vercel

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual Deployment

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.example`
3. Deploy automatically on git push

### Environment Variables for Production

Ensure these are set in your Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_production_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=YourApp <noreply@yourdomain.com>
```

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── (main)/         # Public routes
│   ├── admin/          # Admin panel
│   ├── auth/           # Authentication
│   ├── dashboard/      # User dashboards
│   └── globals.css
├── components/         # Reusable components
│   ├── features/       # Feature-specific components
│   ├── shared/         # Shared UI components
│   └── ui/             # Base UI components
├── lib/                # Utilities and configurations
│   ├── actions/        # Server actions
│   ├── data/           # Data fetching functions
│   ├── supabase/       # Supabase clients
│   └── utils/          # Utility functions
└── types/              # TypeScript type definitions

supabase/
├── migrations/         # Database migrations
└── seed.sql           # Initial data
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.
