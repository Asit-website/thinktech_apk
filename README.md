# Godown Management - Mobile App (Expo React Native)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Update API URL in `src/config/api.js`:
```javascript
const API_BASE_URL = 'http://your-backend-url/api';
```

3. Start the development server:
```bash
npm start
```

4. Run on device/emulator:
- Press `a` for Android
- Press `i` for iOS
- Scan QR code with Expo Go app

## Features

### Screens

1. **Login Screen**
   - Phone number input
   - OTP verification
   - Auto-login on success

2. **Dashboard**
   - Today's summary (Stock IN/OUT, Transactions)
   - Quick actions for Stock IN/OUT
   - Pull to refresh

3. **Audio Entry**
   - Record audio for stock entry
   - AI-powered transcription
   - Product suggestions
   - Confirm and save entry

4. **Manual Entry**
   - Search products
   - Enter quantity and unit
   - Attach slip image (camera/gallery)
   - Submit Stock IN/OUT

5. **History**
   - View today's transactions
   - Pull to refresh
   - Infinite scroll

## Configuration

Update the API base URL in `src/config/api.js` to point to your Laravel backend.

## Permissions

The app requires:
- Microphone (for audio entry)
- Camera (for slip images)
- Photo library (for slip images)

These are configured in `app.json`.

