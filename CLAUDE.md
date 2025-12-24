# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development (frontend + backend concurrently)
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

## Architecture

Breastmilk Pump Tracker - a React + Convex full-stack application for tracking breastmilk pumping sessions.

### Tech Stack
- **Frontend**: React 19, Vite, TanStack Router, shadcn/ui, Tailwind CSS 4
- **Backend**: Convex (serverless database + functions)
- **Auth**: @convex-dev/auth with Password provider
- **Charts**: recharts
- **Date handling**: date-fns

### Project Structure
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
│   ├── stats.tsx        # Charts
│   └── settings.tsx     # Preferences
├── hooks/
│   ├── useTimer.ts      # Timer logic with interval tracking
│   └── useAudioAlert.ts # Persistent alarm sound
└── lib/
    └── utils.ts         # shadcn/ui utilities

convex/
├── schema.ts            # Database schema
├── sessions.ts          # Pumping session CRUD
├── preferences.ts       # User preferences
├── auth.ts              # Auth configuration
└── http.ts              # HTTP routes for auth
```

### Key Features
- Two session types: Regular and Power pumping (different durations)
- Timer with pump/rest intervals and countdown
- Persistent audio alarm until user dismisses
- Onboarding wizard for first-time setup
- Dashboard with daily stats

### Path Aliases
- `@/` resolves to `./src/` (configured in vite.config.ts)

## Convex Guidelines

See `.cursor/rules/convex_rules.mdc` for comprehensive Convex development patterns.

Key points:
- Always use the new function syntax with `args` and `returns` validators
- Use `v.null()` for functions that return null
- Use `internalQuery`/`internalMutation`/`internalAction` for private functions
- Reference functions via `api.module.function` (public) or `internal.module.function` (private)
- Don't use `filter` in queries - use `withIndex` instead
- Schema is defined in `convex/schema.ts`
