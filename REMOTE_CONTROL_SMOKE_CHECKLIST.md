# Remote Control Smoke Checklist (2 Clients)

## Goal
Validate the call remote-control lifecycle in the main app call UI with two independent clients and strict state restrictions.

## Preflight
- Ensure dependencies are installed: `npm install`
- Optional cleanup before each run: `npm run clean:tmp -- --profiles`
- Confirm Firestore rules are up to date if you are testing against live Firebase:
  - `npm run firebase:rules:firestore`

## Start Two Isolated Clients
Open two terminals from workspace root:

- Terminal A:
  - `npm run start:client -- --profile userA`
- Terminal B:
  - `npm run start:client -- --profile userB`

Notes:
- Each profile gets its own `userData` folder (`.userA`, `.userB`).
- Dev launcher enables multi-instance mode via `COVERSE_ALLOW_MULTI_INSTANCE=1`.

## Test Setup
- Sign in as different users in each client.
- Join the same session and the same voice channel.
- Ensure both users are active voice participants.

## Smoke Scenarios

### 1) No Screen Share, No Request
- Steps:
  - Keep both users in voice, no one sharing screen.
- Expected:
  - `Request Ctrl` button is disabled for requester.
  - Tooltip indicates no remote screen share available.

### 2) Pending Request + Cancel
- Steps:
  - User B starts screen share.
  - User A clicks `Request Ctrl`.
  - Before B responds, A clicks `Cancel Req`.
- Expected:
  - A sees pending state then request clears.
  - B does not get an active grant.

### 3) Request Denied by Target
- Steps:
  - User B shares screen.
  - User A requests control.
  - User B denies confirmation prompt.
- Expected:
  - A receives denial feedback.
  - Button returns to `Request Ctrl`.
  - No control grant appears.

### 4) Request Approved by Target
- Steps:
  - User B shares screen.
  - User A requests control.
  - User B approves prompt.
- Expected:
  - A sees controller state (`Stop Ctrl`) and success status.
  - B sees target state (`Revoke Ctrl`) and warning status.
  - Only one active controller is allowed for B.

### 5) Revoke by Target
- Steps:
  - While approved session is active, User B clicks `Revoke Ctrl`.
- Expected:
  - Both clients receive session-ended feedback.
  - A returns to `Request Ctrl`.
  - B returns to normal state.

### 6) Stop by Controller
- Steps:
  - Recreate approved session.
  - User A clicks `Stop Ctrl`.
- Expected:
  - Control session ends immediately for both sides.
  - No stale active grant remains.

### 7) Auto End on Share Stop
- Steps:
  - Recreate approved session.
  - User B stops screen share.
- Expected:
  - Grant auto-revokes.
  - Both clients exit control state.

### 8) Auto End on Disconnect
- Steps:
  - Recreate approved session.
  - Disconnect either user from voice.
- Expected:
  - Grant ends and UI resets.
  - Rejoin requires a new request flow.

### 9) Request Timeout (TTL)
- Steps:
  - User A requests control.
  - User B does not respond.
  - Wait at least 30 seconds.
- Expected:
  - Request expires.
  - A leaves pending state and can request again.

### 10) Inactivity Cleanup (Controller Gone)
- Steps:
  - Recreate approved session.
  - Force-close controller client (User A).
  - Wait ~30 seconds.
- Expected:
  - Target side no longer shows active control.
  - Stale grant is cleared by inactivity path.

## Pass/Fail Log Template
Use this table while testing:

| Scenario | Pass/Fail | Observed | Screenshot/Log |
|---|---|---|---|
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |
| 4 |  |  |  |
| 5 |  |  |  |
| 6 |  |  |  |
| 7 |  |  |  |
| 8 |  |  |  |
| 9 |  |  |  |
| 10 |  |  |  |

## Quick Reset Between Runs
- Close both clients.
- Run: `npm run clean:tmp -- --profiles`
- Relaunch both profiles.
