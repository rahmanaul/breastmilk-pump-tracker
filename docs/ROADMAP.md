# Breastmilk Pump Tracker - Roadmap

This document outlines the planned improvements and future features for the Breastmilk Pump Tracker application.

## Current Status

The application is a functional MVP with the following features:
- User authentication (sign up/sign in)
- Onboarding wizard with default schedule setup
- Session timer with pump/rest intervals
- Regular and Power pumping session types
- Session history with filtering
- Statistics with charts
- Configurable settings and schedules
- Audio alerts with persistent alarm

---

## Phase 1: Foundation & Quality

Priority improvements to ensure stability and maintainability.

### Testing Infrastructure

- [x] Set up Vitest for unit testing
- [x] Add unit tests for `useTimer` hook (21 tests)
- [x] Add unit tests for `useAudioAlert` hook (13 tests)
- [x] Add integration tests for Convex functions (`sessions.ts`, `preferences.ts`, `stats.ts`) (60 tests)
- [x] Set up Playwright for E2E testing
- [x] Add E2E tests for critical user flows:
  - [x] Authentication flow tests
  - [x] Application loading tests
  - [x] Onboarding flow (with auth fixtures)
  - [x] Session creation and completion (with auth fixtures)
  - [x] History viewing and filtering (with auth fixtures)
  - [x] Settings modification (with auth fixtures)

### Error Handling & User Feedback

- [x] Implement toast notification system (sonner)
- [x] Add success notifications for:
  - [x] Session completion
  - [x] Settings saved
  - [x] Onboarding completion
- [x] Add error notifications with actionable messages
- [x] Improve loading states with skeleton components
- [x] Add retry mechanisms for failed operations

### Bug Fixes & Edge Cases

- [x] Prevent concurrent sessions (only one `in_progress` at a time)
- [x] Handle timezone properly for schedule matching
- [x] Handle schedules crossing midnight (N/A - current "today" view shows calendar day, not 24-hour rolling window)
- [x] Clean up incomplete sessions (stale `in_progress` sessions via cron job)
- [x] Validate time format input in schedule settings

---

## Phase 2: Performance & Reliability

Optimizations for better user experience.

### Backend Optimizations

- [x] Move date grouping/aggregation to Convex backend
- [x] Optimize `getDailyStats` query to aggregate server-side
- [x] Add pagination for history queries
- [x] Implement cursor-based pagination for large datasets
- [x] Add database indexes for common query patterns

### Frontend Optimizations

- [x] Implement `React.memo` for schedule cards
- [x] Add `useMemo` for expensive calculations
- [ ] Implement virtual scrolling for history (100+ sessions) - Deferred due to React re-render issues
- [x] Lazy load charts only when visible
- [x] Optimize bundle size with tree shaking analysis

### Offline Support

- [ ] Implement service worker for offline capability
- [ ] Cache static assets
- [ ] Queue mutations when offline
- [ ] Sync when connection restored
- [ ] Show offline indicator in UI

---

## Phase 3: Enhanced Features

New functionality to improve user experience.

### Data Export & Sharing

- [ ] Export session data to CSV
- [ ] Export session data to PDF report
- [ ] Weekly/monthly summary reports
- [ ] Share reports with healthcare providers
- [ ] Print-friendly history view

### Push Notifications

- [ ] Implement web push notifications
- [ ] Schedule reminder notifications
- [ ] "Time to pump" reminders based on schedule
- [ ] Configurable notification preferences
- [ ] Notification sound options

### UI/UX Improvements

- [ ] Dark mode toggle in settings
- [ ] Theme customization (color schemes)
- [ ] Improved mobile gestures (swipe to delete)
- [ ] Session card carousel for long schedules
- [ ] Haptic feedback on mobile
- [ ] Confetti animation on session completion

### Timer Enhancements

- [ ] Pause/resume functionality
- [ ] Background timer with notifications
- [ ] Picture-in-picture mode for timer
- [ ] Custom interval patterns
- [ ] Quick start from dashboard

---

## Phase 4: Advanced Features

Features for power users and long-term value.

### Analytics & Insights

- [ ] Trend analysis (volume over time)
- [ ] Best pumping times recommendations
- [ ] Goal setting and tracking
- [ ] Streak tracking (consecutive days)
- [ ] Weekly/monthly comparison charts
- [ ] Predictive analytics for supply patterns

### Multi-Device Support

- [ ] Real-time sync across devices
- [ ] Session handoff between devices
- [ ] Desktop app (Electron/Tauri)
- [ ] Native mobile app (React Native)

### Social & Community

- [ ] Anonymous benchmarking (compare with averages)
- [ ] Achievement badges
- [ ] Milestones celebration
- [ ] Tips and educational content

### Healthcare Integration

- [ ] Integration with health apps (Apple Health, Google Fit)
- [ ] Baby feeding tracker connection
- [ ] Doctor/lactation consultant sharing
- [ ] Medical notes per session

---

## Phase 5: Security & Compliance

Enterprise-grade security and compliance.

### Security Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Password strength requirements
- [ ] Account recovery via email
- [ ] Session timeout settings
- [ ] Login activity log
- [ ] Rate limiting on mutations

### Audit & Compliance

- [ ] Audit logging for data changes
- [ ] Data retention policies
- [ ] GDPR compliance (data export/deletion)
- [ ] Privacy policy implementation
- [ ] Terms of service

### Data Protection

- [ ] Automatic data backup
- [ ] Data encryption at rest
- [ ] Secure data export
- [ ] Account deletion with data purge

---

## Technical Debt

Ongoing improvements to code quality.

### Documentation

- [ ] Add JSDoc comments to complex functions
- [ ] Document timer algorithm in `useTimer.ts`
- [ ] Document schedule matching logic in `sessions.ts`
- [ ] Create component documentation/Storybook
- [ ] API documentation for Convex functions
- [ ] Contributing guide

### Code Quality

- [ ] Increase TypeScript strictness
- [ ] Add ESLint rules for accessibility
- [ ] Implement Prettier for consistent formatting
- [ ] Add pre-commit hooks (husky + lint-staged)
- [ ] Regular dependency updates
- [ ] Bundle size monitoring

### Accessibility

- [ ] Add ARIA labels to all interactive elements
- [ ] Keyboard navigation improvements
- [ ] Screen reader testing
- [ ] Color contrast verification
- [ ] Focus management for modals

---

## Versioning Plan

| Version | Focus | Key Deliverables |
|---------|-------|------------------|
| 1.1 | Quality | Testing infrastructure, error handling |
| 1.2 | Performance | Backend optimizations, pagination |
| 1.3 | Offline | Service worker, offline support |
| 2.0 | Export | Data export, push notifications |
| 2.1 | UI/UX | Dark mode, mobile improvements |
| 3.0 | Analytics | Insights, trends, recommendations |
| 3.1 | Multi-device | Real-time sync, desktop app |
| 4.0 | Healthcare | Health app integration |

---

## Contributing

If you'd like to contribute to any of these features:

1. Check if there's an existing issue for the feature
2. Create an issue if one doesn't exist
3. Fork the repository
4. Create a feature branch
5. Submit a pull request

---

## Feedback

Have suggestions for the roadmap? Please open an issue with the `enhancement` label.

---

*Last updated: December 2025*
