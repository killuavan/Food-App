# Barcode scanner setup

The scanner uses `@capacitor-mlkit/barcode-scanning`, compatible with this project's Capacitor 8 installation. It scans EAN-13, EAN-8, UPC-A, and UPC-E. The browser UI supports manual barcode entry.

## Android

This repository does not currently contain a generated `android/` native project. After adding one with `npx cap add android`, add the camera permission above the `<application>` element in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

The plugin's Google Play Services scanner module can be installed the first time a user starts scanning. Then sync and build the native app:

```powershell
npx cap sync android
npx cap open android
```

The plugin also documents the following optional scanner dependency metadata inside `<application>`:

```xml
<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />
```

## iOS

The plugin requires iOS 15.5 or later and CocoaPods. Add a camera explanation to `ios/App/App/Info.plist` after generating the iOS project:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is used to scan food product barcodes.</string>
```

Then run `npx cap sync ios` and build from Xcode.

## Open Food Facts

Product details are retrieved from the public Open Food Facts product API and cached in memory for ten minutes. Unlisted products are not fabricated; users can retry, enter the product manually, or search through the existing nutrition page. The client sends an application User-Agent identifier. Follow current Open Food Facts API usage and rate-limit guidance before deploying to production.

No barcode-specific Firestore collection is added. Inventory records can store optional barcode, brand, image URL, and a nutrition profile snapshot. Consumption records preserve the nutrition profile snapshot with the log.

Publish the repository's current `firestore.rules` to the same Firebase project/database before saving scanned products or barcode nutrition snapshots. Rules are not deployed automatically.
