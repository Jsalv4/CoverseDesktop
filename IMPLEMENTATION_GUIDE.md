# Coverse Electron App - Implementation Guide

## Overview
This guide outlines the complete integration between the Coverse Electron desktop app and the Coverse web platform. Both share the same Firebase backend (coverse-390b0).

---

## Phase 1: Data Sync & Friends Integration (CURRENT)

### Problem
The Electron app created its own data structures (`users/{uid}/friends` subcollection) instead of using the web app's existing structures (`follows` collection).

### Solution
Update Electron app to read from the same collections the web app uses:

| Feature | Web App Collection | Electron App Should Use |
|---------|-------------------|------------------------|
| Connections/Friends | `follows` | `follows` ✅ |
| Direct Messages | `conversations` + `messages` | Same ✅ |
| User Profiles | `users` | Same ✅ |
| Friend Requests | `friendRequests` (new) | Same ✅ |

### Tasks
- [ ] Update `loadFriends()` to query `follows` collection where `follower` OR `following` equals current user
- [ ] Update friend display to show mutual follows as "Friends" and one-way as "Following/Followers"
- [ ] Ensure `sendFriendRequest` creates proper follow relationship
- [ ] Test bidirectional sync between web and Electron

---

## Phase 2: Voice Calls & WebRTC

### Current State
- UI complete (call view, controls, participant tiles)
- WebSocket server exists (`src/websocket-server.js`)
- Signaling logic exists (`src/signaling.js`)
- NOT connected together

### Tasks
- [ ] Connect call controls to WebRTC peer connection
- [ ] Implement signaling flow: offer → answer → ICE candidates
- [ ] Add TURN server for NAT traversal (use Twilio or self-host)
- [ ] Test P2P audio between two clients
- [ ] Add call state management (ringing, connected, ended)
- [ ] Implement call notifications

### Architecture
```
User A clicks "Join Voice"
    ↓
WebSocket → Signaling Server → WebSocket
    ↓                              ↓
User A creates offer          User B receives offer
    ↓                              ↓
ICE candidates exchanged      Creates answer
    ↓                              ↓
P2P Audio Stream Connected
```

---

## Phase 3: Firebase Storage for Library

### Current State
- Library UI complete
- Files stored locally (localStorage + blob URLs)
- Files lost on app restart/different device

### Tasks
- [ ] Add Firebase Storage SDK to app.html
- [ ] Create storage structure: `users/{uid}/library/{fileId}`
- [ ] Update `uploadFiles()` to upload to Firebase Storage
- [ ] Update `loadLibraryFromStorage()` to fetch from Firebase
- [ ] Add upload progress indicator
- [ ] Implement "Push to Site" feature (copy to public storage)
- [ ] Add file size limits and validation

### Storage Rules Needed
```javascript
match /users/{userId}/library/{fileId} {
  allow read, write: if request.auth.uid == userId;
}
```

---

## Phase 4: Real-Time Features

### Online/Offline Status
- [ ] Add `status` field to user document (online/offline/idle)
- [ ] Update status on app open/close/idle
- [ ] Listen to friends' status changes with `onSnapshot`
- [ ] Show status dots (green/yellow/gray)

### Real-Time Messages
- [ ] Replace `loadMessages()` polling with `onSnapshot` listener
- [ ] Show typing indicators
- [ ] Add message read receipts

### Real-Time Friend Updates
- [ ] Listen to `follows` collection changes
- [ ] Listen to `friendRequests` collection changes
- [ ] Update UI automatically when friend added/removed

---

## Phase 5: Settings & Polish

### Settings Panel
- [ ] Create settings modal/view
- [ ] Audio input device selection
- [ ] Audio output device selection
- [ ] Camera selection
- [ ] Notification preferences
- [ ] Account settings (display name, avatar)
- [ ] Logout button

### UI Polish
- [ ] Loading spinners/skeletons
- [ ] Error toast notifications
- [ ] Empty state improvements
- [ ] Animations and transitions
- [ ] Keyboard shortcuts

### Error Handling
- [ ] Network disconnection handling
- [ ] Firebase error messages
- [ ] Reconnection logic
- [ ] Offline mode (queue actions)

---

## Phase 6: Build & Distribution

### Packaging
- [ ] Configure electron-builder for Windows
- [ ] Configure electron-builder for macOS
- [ ] Create app icons (all sizes)
- [ ] Set up code signing (Windows/Mac)
- [ ] Create installer (NSIS for Windows, DMG for Mac)

### Auto-Update
- [ ] Set up GitHub Releases
- [ ] Configure electron-updater
- [ ] Add update notification UI
- [ ] Test update flow

### CI/CD
- [ ] GitHub Actions workflow for builds
- [ ] Automated testing
- [ ] Release automation

---

## Phase 7: Advanced Features (Post-Launch)

### Screen Sharing
- [ ] Capture screen with `desktopCapturer`
- [ ] Stream screen via WebRTC
- [ ] Add screen share controls
- [ ] Picture-in-picture mode

### Video Calls
- [ ] Enable camera stream
- [ ] Add video tiles to call view
- [ ] Bandwidth adaptation

### File Sharing in Chat
- [ ] Attach files to messages
- [ ] Image preview in chat
- [ ] File download from chat

### Session Recording
- [ ] Record audio streams
- [ ] Save recordings to library
- [ ] Export options

---

## Firebase Collections Reference

### Existing (Web App)
```
users/{userId}
  - displayName, email, avatarUrl, bio, etc.

follows/{followId}
  - follower: string (userId)
  - following: string (userId)
  - createdAt: timestamp

conversations/{conversationId}
  - participants: string[]
  - createdAt, lastMessage, lastMessageAt

messages/{messageId}
  - senderId, text, timestamp, conversationId
```

### New (Added for Desktop)
```
users/{userId}/friends/{friendId}
  - uid, displayName, avatarUrl, addedAt
  (Alternative: just use follows collection)

friendRequests/{requestId}
  - fromUid, toUid, status, createdAt
```

---

## Implementation Order

1. **Fix Friends Loading** (uses `follows` collection) ← START HERE
2. **Test Full Friends Flow** (add, accept, display)
3. **Voice Calls** (WebRTC integration)
4. **Firebase Storage** (library cloud sync)
5. **Real-Time Updates** (onSnapshot listeners)
6. **Settings Panel**
7. **Build & Package**
8. **Auto-Update**
9. **Advanced Features**

---

## Quick Commands

```bash
# Run app
npm start

# Build for Windows
npm run build:win

# Build for Mac
npm run build:mac

# Deploy Firebase rules (from web project)
cd ../CoverseDev/Coverse && firebase deploy --only firestore:rules
```
