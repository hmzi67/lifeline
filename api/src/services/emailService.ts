import nodemailer from 'nodemailer';
import * as process from 'node:process';

const isDevelopment = () => process.env.NODE_ENV !== 'production';

// Create and configure the email transporter
const createTransporter = () => {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
  } = process.env;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Missing required email environment variables');
  }

  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT, 10),
    secure: parseInt(EMAIL_PORT, 10) === 465, // true if port is 465
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
    // SMTP transcripts include message bodies (one-time codes): development only.
    logger: isDevelopment(),
    debug: isDevelopment(),
  });
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/**
 * Local development only: with LOG_OTP_TO_CONSOLE=true (and not in production),
 * one-time codes are printed to the server console instead of being emailed.
 */
const logOtpInsteadOfEmail = (purpose: string, email: string, code: string): boolean => {
  if (process.env.LOG_OTP_TO_CONSOLE !== 'true' || process.env.NODE_ENV === 'production') return false;
  console.log(`[dev OTP] ${purpose} code for ${email}: ${code}`);
  return true;
};

// Send a password reset email
export const sendPasswordResetEmail = async (
  email: string,
  firstName: string,
  resetUrl: string
): Promise<void> => {
  if (logOtpInsteadOfEmail('Password reset', email, resetUrl)) return;
  try {
    const transporter = createTransporter();

    const fromName = process.env.EMAIL_FROM_NAME || 'YourApp';
    const fromEmail = process.env.EMAIL_FROM_EMAIL || 'no-reply@yourapp.com';

    const mailOptions = {
      from: {
        name: fromName,
        address: fromEmail,
      },
      to: email,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Password Reset</title>
        </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset OTP</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
              <p style="font-size: 18px;">Hello ${escapeHtml(firstName)},</p>
              <p>We received a request to reset your password. If you didn’t make this request, you can safely ignore this email.</p>
              <p>Use the following One-Time Password (OTP) to reset your password:</p>

              <div style="text-align: center; margin: 30px 0;">
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea; margin: 0;">
                  ${resetUrl}
                </p>
              </div>

              <p>This OTP will expire in <strong>10 minutes</strong> for security reasons.</p>
              <p>Please enter this code in the password reset page of our application.</p>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Best regards,<br>
                ${fromName} Team
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
        Hello ${firstName},

        We received a request to reset your password. If you didn't make this request, you can safely ignore this email.

        To reset your password, visit this link: ${resetUrl}

        This link will expire in 1 hour for security reasons.

        Best regards,
        ${fromName} Team
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    // The code is never logged in production; the caller logs the failure.
    if (!isDevelopment()) throw error;
    console.error('❌ Error sending password reset email (likely local ISP block). Logging OTP directly for local testing:');
    console.log(`\n\n     ➡️ PASSWORD RESET URL/CODE: ${resetUrl} ⬅️     \n\n`);
    // don't throw an error locally so the flow can continue
  }
};


// Send a email verification email
export const sendEmailVerificationEmail = async (
  email: string,
  firstName: string,
  verificationUrl: string
): Promise<void> => {
  if (logOtpInsteadOfEmail('Email verification', email, verificationUrl)) return;
  try {
    const transporter = createTransporter();

    const fromName = process.env.EMAIL_FROM_NAME || 'YourApp';
    const fromEmail = process.env.EMAIL_FROM_EMAIL || 'no-reply@yourapp.com';

    const mailOptions = {
      from: {
        name: fromName,
        address: fromEmail,
      },
      to: email,
      subject: 'Email Verification Request',
      html: `
       <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Email Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Email Verification</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
            <p style="font-size: 18px;">Hello ${escapeHtml(firstName)},</p>
            <p>Thank you for signing up with LifeLine. Please verify your email address by entering the following verification code in the app:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${verificationUrl}</p>
            </div>

            <p>This code will expire in 10 minutes for security reasons.</p>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Best regards,<br>
              ${fromName} Team
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${firstName},

        Thank you for signing up with LifeLine. Please verify your email address by clicking on the button below:

        ${verificationUrl}

        This link will expire in 1 hour for security reasons.

        Best regards,
        ${fromName}
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    // The code is never logged in production; the caller logs the failure.
    if (!isDevelopment()) throw error;
    console.error('❌ Error sending verification email (likely local ISP block). Logging OTP directly for local testing:');
    console.log(`\n\n     ➡️ EMAIL VERIFICATION CODE: ${verificationUrl} ⬅️     \n\n`);
    // don't throw an error locally so the flow can continue
  }
};