# Barcode scanner setup

The scanner uses `@capacitor-mlkit/barcode-scanning`, compatible with this project's Capacitor 8 installation. It scans Aztec, Codabar, Code 39, Code 93, Code 128, Data Matrix, EAN-8, EAN-13, ITF, PDF417, QR Code, UPC-A, and UPC-E barcodes. Food product details are looked up only for EAN/UPC codes; other formats are shown as scanned values and can be added manually. The browser UI supports manual EAN/UPC entry.

Indian EAN-13 barcodes (often beginning with GS1 prefix `890`) use the same supported EAN-13 format; no India-specific scanner format is required. Product lookup depends on the product being listed in Open Food Facts.

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
