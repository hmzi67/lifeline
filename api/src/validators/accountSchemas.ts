import { z } from 'zod';
import { dateText, flag, id, text, url } from './fields.js';

// Bodies for sign-in, account and profile endpoints, and a user's daily routine.

const email = text(254);
const password = text(256);
const otp = text(10);
const token = text(8192);

export const emailBody = z.object({ email });
export const verifyEmailBody = z.object({ email, otp });
export const resetPasswordBody = z.object({ email, otp, newPassword: password });
// Native clients send the refresh token in the body; the web uses the cookie.
export const refreshTokenBody = z.object({ refreshToken: token });
export const oauthExchangeBody = z.object({ code: text(512) });
export const googleMobileBody = z.object({ idToken: token });
export const appleMobileBody = z.object({
  identityToken: token,
  authorizationCode: text(2048),
  firstName: text(100),
  nonce: text(512),
});

export const ownProfileBody = z.object({
  displayName: text(100),
  username: text(100),
  profileImage: url,
  phone: text(30),
  password,
  currentPassword: password,
});

export const userSettingsBody = z.object({
  theme: text(20),
  notificationsEnabled: flag,
  waterReminderEnabled: flag,
  language: text(20),
  unitSystem: text(20),
});

export const pushTokenBody = z.object({
  pushToken: text(4096),
  expoPushToken: text(4096),
  platform: text(20),
  timezone: text(64),
});

export const deleteAccountBody = z.object({ email, password, confirmation: text(100) });

export const adminUserBody = z.object({
  email,
  username: text(100),
  profileImage: url,
  phone: text(30),
  subject: text(200),
  password,
  status: text(20),
  roleId: id,
});

export const dailyRoutineBody = z.object({
  userId: id,
  routinesDate: dateText,
  date: dateText,
  fastingId: id,
  sleepId: id,
  medicationId: id,
  meditationId: id,
  waterId: id,
});
