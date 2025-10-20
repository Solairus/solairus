# Dynamic Countdown Timer Requirements

## Introduction

Enhance the agent withdrawal countdown timer to display a live, real-time countdown in `hh:mm:ss` format that updates every second, providing users with precise timing information for when their next ROI withdrawal becomes available.

## Glossary

- **Agent**: A trading bot activated by users to generate ROI
- **Withdrawal Timer**: UI component showing time remaining until next ROI withdrawal
- **Cooldown Period**: Time between ROI withdrawals (24 hours in production, 5 minutes in debug mode)
- **Live Countdown**: Real-time timer that updates every second

## Requirements

### Requirement 1

**User Story:** As a user with active agents, I want to see a live countdown timer showing exactly when my next ROI withdrawal becomes available, so that I can plan my withdrawals precisely.

#### Acceptance Criteria

1. WHEN an agent is in cooldown period, THE Withdrawal_Timer SHALL display time remaining in `hh:mm:ss` format
2. THE Withdrawal_Timer SHALL update every second to show live countdown
3. WHEN countdown reaches zero, THE Withdrawal_Timer SHALL disappear and withdrawal button SHALL become enabled
4. THE Withdrawal_Timer SHALL show hours, minutes, and seconds with zero-padding (e.g., "23:59:58")
5. WHEN hours are zero, THE Withdrawal_Timer SHALL display `mm:ss` format

### Requirement 2

**User Story:** As a user, I want the countdown timer to be visually prominent and easy to read, so that I can quickly see the remaining time at a glance.

#### Acceptance Criteria

1. THE Withdrawal_Timer SHALL use monospace font for consistent digit alignment
2. THE Withdrawal_Timer SHALL be displayed in a highlighted container with amber styling
3. THE Withdrawal_Timer SHALL show appropriate status message below the countdown
4. THE Withdrawal_Timer SHALL use appropriate icons to indicate timer type (activation vs withdrawal cooldown)
5. THE Withdrawal_Timer SHALL be responsive and work in both compact and full display modes

### Requirement 3

**User Story:** As a user, I want the countdown timer to work correctly in both debug mode (5-minute intervals) and production mode (24-hour intervals), so that I can test the system and use it in production.

#### Acceptance Criteria

1. THE Withdrawal_Timer SHALL automatically detect contract timing mode (debug vs production)
2. WHEN in debug mode, THE Withdrawal_Timer SHALL count down from 5 minutes
3. WHEN in production mode, THE Withdrawal_Timer SHALL count down from 24 hours
4. THE Withdrawal_Timer SHALL display debug mode indicator when applicable
5. THE Withdrawal_Timer SHALL handle timing transitions correctly when switching between modes