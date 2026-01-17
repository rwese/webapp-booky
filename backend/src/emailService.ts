import axios from 'axios';
import dotenv from 'dotenv';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

dotenv.config();

// Configuration
const EMAILProvider = process.env.EMAIL_PROVIDER || 'console'; // 'sendgrid', 'mailgun', 'ses', 'console'
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@booky.app';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Booky';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Types
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Console fallback for development
async function sendConsoleEmail(options: EmailOptions): Promise<EmailResult> {
  console.log('=== EMAIL (Development Mode) ===');
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`Content: ${options.html}`);
  console.log('===============================');
  return {
    success: true,
    messageId: `console-${Date.now()}`
  };
}

// SendGrid provider
async function sendSendGridEmail(options: EmailOptions): Promise<EmailResult> {
  if (!SENDGRID_API_KEY) {
    return {
      success: false,
      error: 'SENDGRID_API_KEY not configured'
    };
  }

  try {
    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [
          {
            to: [{ email: options.to }],
            dynamic_template_data: {
              subject: options.subject,
              content: options.html
            }
          }
        ],
        from: {
          email: EMAIL_FROM,
          name: EMAIL_FROM_NAME
        },
        template_id: SENDGRID_TEMPLATE_ID
      },
      {
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      messageId: response.headers['x-message-id']
    };
  } catch (error: any) {
    console.error('SendGrid error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.message || 'SendGrid request failed'
    };
  }
}

// Mailgun provider
async function sendMailgunEmail(options: EmailOptions): Promise<EmailResult> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    return {
      success: false,
      error: 'MAILGUN_API_KEY or MAILGUN_DOMAIN not configured'
    };
  }

  try {
    const response = await axios.post(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      new URLSearchParams({
        from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || ''
      }),
      {
        auth: {
          username: 'api',
          password: MAILGUN_API_KEY
        }
      }
    );

    return {
      success: true,
      messageId: response.data.id
    };
  } catch (error: any) {
    console.error('Mailgun error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Mailgun request failed'
    };
  }
}

// AWS SES provider
let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID!,
        secretAccessKey: AWS_SECRET_ACCESS_KEY!
      }
    });
  }
  return sesClient;
}

async function sendSESEmail(options: EmailOptions): Promise<EmailResult> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return {
      success: false,
      error: 'AWS credentials not configured'
    };
  }

  try {
    const client = getSESClient();

    const command = new SendEmailCommand({
      Source: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      Destination: {
        ToAddresses: [options.to]
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: options.html,
            Charset: 'UTF-8'
          },
          Text: {
            Data: options.text || '',
            Charset: 'UTF-8'
          }
        }
      }
    });

    const response = await client.send(command);

    return {
      success: true,
      messageId: response.MessageId
    };
  } catch (error: any) {
    console.error('AWS SES error:', error.message);
    return {
      success: false,
      error: error.message || 'SES request failed'
    };
  }
}

// Main send function - dispatches to the appropriate provider
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  switch (EMAILProvider.toLowerCase()) {
    case 'sendgrid':
      return sendSendGridEmail(options);
    case 'mailgun':
      return sendMailgunEmail(options);
    case 'ses':
      return sendSESEmail(options);
    case 'console':
    default:
      return sendConsoleEmail(options);
  }
}

// Template helpers
export function getPasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Password Reset Request</h1>
        
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to create a new password:
        </p>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center; padding: 20px 0;">
              <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        
        <p style="color: #4a4a4a; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
          This link will expire in 1 hour for security purposes.
        </p>
        
        <p style="color: #888888; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
          If you didn't request this password reset, you can safely ignore this email.
        </p>
      </td>
    </tr>
    
    <tr>
      <td style="text-align: center; padding: 20px; color: #888888; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Booky. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function getPasswordResetEmailText(resetLink: string): string {
  return `
Password Reset Request

We received a request to reset your password. Click the link below to create a new password:

${resetLink}

This link will expire in 1 hour for security purposes.

If you didn't request this password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Booky. All rights reserved.
`;
}

export default {
  sendEmail,
  getPasswordResetEmailHtml,
  getPasswordResetEmailText
};
