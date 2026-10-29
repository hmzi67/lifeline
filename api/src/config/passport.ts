import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isEmailVerified: true,
        profileImage: true,
      },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy (only if environment variables are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('🔐 Configuring Google OAuth strategy...');
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        // Bind each callback to the browser session that started the flow, so
        // a callback URL from someone else's sign-in is rejected.
        state: true,
        pkce: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0].value;
          if (!email) {
            return done(new Error('No email found in Google profile'), false);
          }

          // Check if user already exists
          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (user) {
            // User exists, update their Google ID if not set
            if (!user.googleId) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id },
              });
            }
          } else {
            // Generate a unique username from email
            const baseUsername = email.split('@')[0].toLowerCase();
            let username = baseUsername;
            let counter = 1;
            while (await prisma.user.findUnique({ where: { username } })) {
              username = `${baseUsername}${counter}`;
              counter++;
            }

            user = await prisma.user.create({
              data: {
                username,
                email,
                profileImage: profile.photos?.[0].value || null,
                googleId: profile.id,
                isEmailVerified: true, // Google emails are verified
              },
            });
          }

          return done(null, user);
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error, false);
        }
      }
    )
  );
} else {
  console.log('⚠️  Google OAuth not configured - missing environment variables');
}

export default passport;
