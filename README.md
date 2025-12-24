# Breastmilk Pump Tracker

A full-stack web application for tracking breastmilk pumping sessions with timer functionality, session history, and statistics.

## Features

- **Session Timer** - Track pump and rest intervals with countdown timer
- **Two Session Types**
  - Regular pumping sessions
  - Power pumping sessions (alternating pump/rest cycles)
- **Audio Alerts** - Persistent alarm sounds when intervals change
- **Session History** - View and manage past pumping sessions
- **Statistics Dashboard** - Charts and insights on pumping patterns
- **User Preferences** - Customize session durations and settings
- **Onboarding Wizard** - Guided setup for first-time users

## Tech Stack

- **Frontend**: React 19, Vite, TanStack Router
- **Backend**: Convex (serverless database + functions)
- **Auth**: @convex-dev/auth with Password provider
- **UI**: shadcn/ui, Tailwind CSS 4
- **Charts**: Recharts
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Convex](https://convex.dev/) account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/rahmanaul/breastmilk-pump-tracker.git
   cd breastmilk-pump-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   This will start both the Vite frontend and Convex backend concurrently.

## Development Commands

```bash
# Start development (frontend + backend)
npm run dev

# Run frontend only
npm run dev:frontend

# Run Convex backend only
npm run dev:backend

# Build for production
npm run build

# Lint TypeScript and ESLint
npm run lint

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   └── layout/          # Layout, Navigation
├── routes/              # TanStack Router file-based routes
│   ├── __root.tsx       # Root layout with auth
│   ├── index.tsx        # Dashboard
│   ├── onboarding.tsx   # First-time setup wizard
│   ├── session.tsx      # Timer with pump/rest intervals
│   ├── history.tsx      # Past sessions
│   ├── stats.tsx        # Charts and statistics
│   └── settings.tsx     # User preferences
├── hooks/
│   ├── useTimer.ts      # Timer logic with interval tracking
│   └── useAudioAlert.ts # Persistent alarm sound
└── lib/
    └── utils.ts         # Utility functions

convex/
├── schema.ts            # Database schema
├── sessions.ts          # Pumping session CRUD
├── preferences.ts       # User preferences
├── stats.ts             # Statistics queries
├── auth.ts              # Auth configuration
└── http.ts              # HTTP routes for auth
```

## License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details.
