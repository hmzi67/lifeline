# Google Mobile Authentication Implementation

## Overview

This implementation adds a new endpoint for mobile applications to authenticate users using Google ID tokens. This is different from the web-based OAuth flow that uses redirects.

## What Was Added

### 1. **New Package Installed**

- `google-auth-library` - Official Google library for verifying ID tokens

### 2. **New Endpoint Created**

**POST** `/api/auth/google/mobile`

This endpoint:

- ✅ Receives the ID token from the mobile app
- ✅ Verifies the token with Google using the Google Auth Library
- ✅ Extracts user info (email, name, profile picture) from the verified token
- ✅ Finds or creates the user in your database
- ✅ Generates JWT access and refresh tokens for your app
- ✅ Returns the tokens to the mobile app in the response

### 3. **Request Format**

```json
POST /api/auth/google/mobile
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE..."
}
```

### 4. **Response Format (Success)**

```json
{
  "success": true,
  "message": "Google authentication successful",
  "data": {
    "user": {
      "id": "clxxxxx",
      "email": "user@gmail.com",
      "username": "user123",
      "googleId": "1234567890",
      "profileImage": "https://lh3.googleusercontent.com/...",
      "roleId": null,
      "isEmailVerified": true,
      "status": "active"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 5. **Error Responses**

#### Missing ID Token (400)

```json
{
  "success": false,
  "message": "ID token is required"
}
```

#### Invalid/Expired Token (401)

```json
{
  "success": false,
  "message": "Invalid or expired Google ID token"
}
```

#### Invalid Token Payload (400)

```json
{
  "success": false,
  "message": "Invalid token payload - email not found"
}
```

#### Server Error (500)

```json
{
  "success": false,
  "message": "Internal server error during authentication"
}
```

## How It Works

### Flow Diagram

```
Mobile App → Google Sign-In SDK → Get ID Token
                                       ↓
Mobile App → POST /api/auth/google/mobile (with ID token)
                                       ↓
Backend → Verify token with Google Auth Library
                                       ↓
Backend → Extract user info from verified token
                                       ↓
Backend → Find user by email OR Create new user
                                       ↓
Backend → Generate JWT tokens (access + refresh)
                                       ↓
Backend → Save refresh token to database
                                       ↓
Backend → Return tokens + user info to mobile app
                                       ↓
Mobile App → Store tokens securely
Mobile App → Use access token for authenticated requests
```

### New User Creation

When a user signs in with Google for the first time:

- A unique username is generated from their email
- Profile image is saved from Google
- Email is automatically marked as verified (since Google verified it)
- User status is set to "active"
- Google ID is stored for future logins

### Existing User Login

When a user who already exists signs in:

- User is found by email
- Google ID is linked if not already linked
- New tokens are generated
- Tokens are returned to the mobile app

## Environment Variables Required

Make sure these are set in your `.env` file:

```env
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_ANDROID_CLIENT_ID=your-android-web-client-id-here
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
```

**Note:** `GOOGLE_CLIENT_ID` remains the Passport web OAuth client. Set
`GOOGLE_ANDROID_CLIENT_ID` when the native app requests ID tokens from a
different Google project; the API accepts either explicitly configured
audience. Its value must exactly match the mobile build's
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Restart the API after changing the
production environment so the running process receives the new audience.

## Mobile App Integration Guide

### For React Native (using @react-native-google-signin/google-signin)

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import axios from 'axios';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: 'YOUR_GOOGLE_CLIENT_ID', // From Google Console
  offlineAccess: false,
});

// Sign in with Google
const signInWithGoogle = async () => {
  try {
    // Get ID token from Google
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.idToken;

    // Send ID token to your backend
    const response = await axios.post('https://your-api.com/api/auth/google/mobile', {
      idToken: idToken,
    });

    // Store tokens securely
    const { accessToken, refreshToken, user } = response.data.data;

    // Save tokens to secure storage (e.g., AsyncStorage with encryption)
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);

    // Navigate to home screen
    console.log('User authenticated:', user);
  } catch (error) {
    console.error('Google sign-in error:', error);
  }
};
```

### For Flutter (using google_sign_in package)

```dart
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

final GoogleSignIn _googleSignIn = GoogleSignIn(
  scopes: ['email', 'profile'],
);

Future<void> signInWithGoogle() async {
  try {
    // Get ID token from Google
    final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
    final GoogleSignInAuthentication googleAuth = await googleUser!.authentication;
    final String? idToken = googleAuth.idToken;

    // Send ID token to your backend
    final response = await http.post(
      Uri.parse('https://your-api.com/api/auth/google/mobile'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'idToken': idToken}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final accessToken = data['data']['accessToken'];
      final refreshToken = data['data']['refreshToken'];

      // Store tokens securely
      // Use flutter_secure_storage or similar

      print('User authenticated: ${data['data']['user']}');
    }
  } catch (error) {
    print('Google sign-in error: $error');
  }
}
```

## Token Management

### Access Token

- **Expiration:** 15 minutes
- **Usage:** Include in Authorization header for all authenticated requests
- **Format:** `Authorization: Bearer <accessToken>`

### Refresh Token

- **Expiration:** 7 days
- **Usage:** Use to get a new access token when it expires
- **Storage:** Store securely on the mobile device
- **Endpoint:** POST `/api/auth/refresh-token`

## Security Features

1. ✅ **Token Verification:** ID token is verified with Google before accepting it
2. ✅ **Audience Check:** Ensures token was issued for your app
3. ✅ **Email Verification:** Google-authenticated emails are automatically verified
4. ✅ **Secure Token Storage:** Refresh tokens are stored in the database
5. ✅ **Short-lived Access Tokens:** 15-minute expiration reduces risk
6. ✅ **Refresh Token Rotation:** New tokens can be requested with refresh endpoint

## Testing

Test file created at: `http-test/googleMobileAuth.http`

To test manually:

1. Get a Google ID token from your mobile app or Google OAuth Playground
2. Send POST request to `/api/auth/google/mobile` with the token
3. Verify you receive access and refresh tokens in response
4. Use access token to make authenticated requests

## Differences from Web OAuth Flow

| Feature    | Web OAuth                    | Mobile Auth                    |
| ---------- | ---------------------------- | ------------------------------ |
| Flow Type  | Redirect-based               | Token-based                    |
| Endpoint   | GET `/api/auth/google`       | POST `/api/auth/google/mobile` |
| Returns    | Redirects with tokens in URL | JSON response with tokens      |
| Best For   | Web applications             | Mobile apps (iOS, Android)     |
| Token Type | Handled by Passport.js       | ID Token verified directly     |

## Files Modified

1. `/api/src/controllers/authController.ts` - Added `googleMobileAuth` function
2. `/api/src/routes/authRoute.ts` - Added route for mobile endpoint
3. `/api/package.json` - Added `google-auth-library` dependency
4. `/http-test/googleMobileAuth.http` - Created test file

## Next Steps for Mobile Team

1. **Configure Google Sign-In in mobile app:**
   - Android: Add SHA-1 fingerprint to Firebase Console
   - iOS: Add URL schemes to Info.plist
   - Set the app's web client ID as `GOOGLE_ANDROID_CLIENT_ID` on the backend

2. **Implement Google Sign-In SDK in mobile app**

3. **Send ID token to backend endpoint**

4. **Store returned tokens securely**

5. **Use access token for authenticated API requests**

6. **Implement refresh token logic when access token expires**

## Support

If you encounter any issues:

- Check that `GOOGLE_ANDROID_CLIENT_ID` matches the app's configured web client ID
- Verify the ID token is valid and not expired
- Ensure the token's audience matches your Google Client ID
- Check backend logs for detailed error messages
