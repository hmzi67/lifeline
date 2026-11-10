process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/lifeline_test';
process.env.JWT_SECRET = 'google-auth-test-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET = 'google-auth-test-refresh-secret-32-characters';
process.env.GOOGLE_CLIENT_ID = 'web-client';
process.env.GOOGLE_ANDROID_CLIENT_ID = 'android-client';
process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api';
