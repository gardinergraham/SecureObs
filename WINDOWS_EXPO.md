# Running SecureObs on a Windows computer

SecureObs can run on a Windows computer through the Expo web build. This is the best route for nurses
who prefer a keyboard and larger screen for longer patient notes, care plans, handovers, analytics review
or management tasks.

The Android tablet app remains the best route for ward-floor observation recording and NFC staff cards.

Expo does not make this project a native Windows `.exe` desktop app. For Windows laptops and desktops,
use SecureObs in Microsoft Edge or Chrome as a web app connected to the same backend.

## Recommended desktop use

Windows web is especially useful for:

- Writing longer patient notes
- Creating and reviewing care plans
- Reviewing patient voice and family responses
- Reviewing analytics and shift handover
- Management settings and ward setup
- Printing or saving PDFs from the browser

## Prerequisites

- Windows 10/11
- Node.js LTS
- Git
- Expo CLI through `npx`, no global install required

## Local Windows run

```powershell
git clone <your-repository-url>
cd SecureObsExpo
npm install
npm run web
```

Expo will print a local URL, usually:

```text
http://localhost:8081
```

Open that in Microsoft Edge or Chrome.

Staff should use STAFFCODE and PIN sign-in on Windows. NFC staff card scanning and NFC tag writing are
Android tablet features.

## Build the web version

To create a static web build that can be hosted for desktop users:

```powershell
npm run web:build
```

Expo writes the web build to the `dist` folder. That folder can be hosted behind the same access rules
as the public/family website, or served internally for a care home/NHS site.

## Connect to the backend

The app currently defaults to the Railway backend:

```text
https://adequate-energy-production.up.railway.app
```

To point Windows Expo web at another backend, create a `.env` file in the project root:

```powershell
EXPO_PUBLIC_API_URL=https://your-backend-url.example.com
```

Then restart Expo.

## Android emulator from Windows, optional

For the tablet-style app on Windows:

1. Install Android Studio.
2. Create an Android Virtual Device.
3. Start the emulator.
4. Run:

```powershell
npm run android
```

NFC hardware is normally not available in the emulator. Use STAFFCODE/PIN sign-in there.

## Physical Android tablet from Windows, optional

For the full SecureObs workflow:

1. Connect the Android tablet by USB, or use Expo Go on the same network.
2. Run:

```powershell
npm start
```

Then open the project on the tablet.

NFC staff card scanning and NFC tag writing should be tested on an NFC-enabled Android tablet.

## Feature differences on Windows web

Available on Windows web:

- Staff PIN sign-in
- Ward overview
- General observations
- Patient notes
- Care plans
- Patient voice and family review
- Analytics and handover review
- Management settings and admin checks
- Browser printing/PDF workflows

Native Android/tablet only:

- NFC staff card scanning
- NFC staff tag writing
- Some device sharing/printing behaviour may differ by browser

## Suggested deployment model

For live care-home or NHS-style use, the cleanest setup is:

1. Android tablets on the ward for fast observations and NFC sign-in.
2. Windows browser access for nurses/managers who need to type longer notes or care plans.
3. Both connect to the same Railway/Postgres backend, so the patient record stays in one place.
