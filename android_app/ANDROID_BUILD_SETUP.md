# Android Build Setup - Final Steps

## ✅ What's Been Configured

All Android build files are in place:
- ✅ Gradle build files (app & project level)
- ✅ AndroidManifest.xml with OAuth deep linking
- ✅ MainActivity.kt
- ✅ ProGuard rules
- ✅ GitHub Actions workflow updated for Flutter

## 🔑 Required GitHub Secrets

You need to add **ONE additional secret** to your existing GitHub secrets:

### New Secret Required:
- `FIREBASE_GOOGLE_SERVICES_BASE64` - Base64 encoded google-services.json

Your existing secrets will be used:
- ✅ `KEYSTORE_BASE64` (already set)
- ✅ `KEYSTORE_PASSWORD` (already set)
- ✅ `KEY_PASSWORD` (already set)

## 📋 Steps to Complete Setup

### 1. Get Firebase google-services.json

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project or create new one
3. Add Android app with package name: `com.autosong.autosong_studio`
4. Enable **Google Sign-In** authentication
5. Download `google-services.json`

### 2. Encode and Add to GitHub Secrets

```bash
# Encode google-services.json to base64
base64 -i google-services.json | pbcopy

# Then add to GitHub Secrets as:
# FIREBASE_GOOGLE_SERVICES_BASE64
```

### 3. Replace Template File

Replace the placeholder file at:
`android_app/android/app/google-services.json`

With your real Firebase configuration.

### 4. Update OAuth Redirect in Backend

In your backend's YouTube OAuth configuration, ensure redirect URI includes:
```
https://jusdown.onrender.com/api/auth/callback
```

And configure Android app deep linking to handle this redirect.

## 🚀 How to Build

Once secrets are set and Firebase is configured:

### Automatic Build (GitHub Actions)
```bash
git add .
git commit -m "Complete Android build configuration"
git push
```

GitHub Actions will automatically:
1. ✅ Run backend checks
2. ✅ Build Flutter APK
3. ✅ Build Flutter AAB (for Play Store)
4. ✅ Upload artifacts with version numbers

### Local Build (Testing)
```bash
cd android_app

# Install dependencies
flutter pub get

# Build APK
flutter build apk --release

# Build AAB
flutter build appbundle --release
```

## 📦 Build Outputs

After GitHub Actions runs, you'll find:
- **APK**: `AutoSong-Studio-APK-v{BUILD_NUMBER}`
- **AAB**: `AutoSong-Studio-AAB-v{BUILD_NUMBER}`

Download from: **Actions** tab → **Workflow run** → **Artifacts**

## ⚠️ Important Notes

### Android Package Name
- Package: `com.autosong.autosong_studio`
- Make sure this matches in:
  - Firebase Console
  - AndroidManifest.xml ✅ (already set)
  - build.gradle ✅ (already set)

### Keystore
- Your existing keystore with alias `upload` will be used
- Already configured in GitHub Actions ✅

### OAuth Deep Linking
- Configured for: `https://jusdown.onrender.com/api/auth/callback`
- Make sure your backend redirects properly

## 🎯 Next Steps

1. **Get Firebase google-services.json**
2. **Add to GitHub Secrets** as `FIREBASE_GOOGLE_SERVICES_BASE64`
3. **Push to GitHub** to trigger first build
4. **Download APK** from Actions artifacts
5. **Test on Android device**

## 🐛 Troubleshooting

### Build fails with "google-services.json invalid"
- Ensure you encoded the correct file
- Check base64 encoding has no newlines

### OAuth redirect doesn't work
- Check AndroidManifest deep link configuration
- Verify backend redirect URI matches
- Test with `adb logcat` to see intents

### Keystore errors
- Verify KEYSTORE_PASSWORD and KEY_PASSWORD secrets
- Check keystore alias is `upload`

## 📱 Testing Signed APK

Once built:
```bash
# Download APK from GitHub Artifacts
# Install on device:
adb install autosong-studio-v1.apk

# Or scan QR code / share via USB
```

---

**Ready to build!** Just add the Firebase secret and push to GitHub.
