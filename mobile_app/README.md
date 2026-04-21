# AidChain Mobile App

Field officer mobile app for offline-first distribution monitoring and fallback distribution capture.

## Features implemented

- Secure login with JWT token storage (`expo-secure-store`)
- Beneficiary list with search and status display
- Beneficiary detail screen with manual fallback distribution action
- Offline queue for distribution actions when internet is unavailable
- Automatic background sync (no sync button) on:
  - app startup
  - app foreground resume
  - connectivity restoration
  - periodic poll interval
- Progress dashboard showing confirmed and pending values

## Backend contract used

- `POST /api/auth/login`
- `GET /api/beneficiaries`
- `GET /api/cycle`
- `POST /api/distribute`
- `GET /api/cache/pending`
- `GET /api/stats`
- `GET /api/cycle/progress` (preferred, with fallback to stats+pending if missing)

## Run locally

```bash
npm install
```

Set API URL:

```bash
set EXPO_PUBLIC_API_BASE_URL=http://<YOUR_FLASK_HOST>:5000
```

Start app:

```bash
npm start
```

## Notes

- The web dashboard remains unchanged and keeps all existing functionality.
- This mobile app is additive and uses the same Flask API hub architecture.

## APK login troubleshooting

If login fails on an installed APK:

- Make sure Flask is running on the laptop with `host="0.0.0.0"` and port `5000`.
- Phone and laptop must be on the same network.
- In mobile login screen, set **Server URL** to your laptop LAN IP, e.g.:
  - `http://192.168.1.25:5000`
- Do not use `http://10.0.2.2:5000` on a real phone (that is emulator-only).
- If repeated wrong login attempts were made, Flask limiter may temporarily block (`5/minute`).
