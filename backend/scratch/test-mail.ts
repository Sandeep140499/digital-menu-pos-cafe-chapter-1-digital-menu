import 'dotenv/config';
import { sendEmail, isMailConfigured, verifyMailConnection } from '../src/config/mailer.js';

async function test() {
  console.log('--- Mailer Configuration Check ---');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('EMAIL_SMTP_HOST:', process.env.EMAIL_SMTP_HOST);
  console.log('EMAIL_SMTP_USER:', process.env.EMAIL_SMTP_USER);
  console.log('BREVO_API_KEY set:', !!process.env.BREVO_API_KEY);
  console.log('Is mail configured:', isMailConfigured());

  try {
    console.log('\nVerifying connection...');
    await verifyMailConnection();
    console.log('Connection verified successfully! ✅');

    const to = 'chapteronecafe11@gmail.com'; // Sending to the sender address as a test
    console.log(`\nSending test mail to: ${to}`);
    
    await sendEmail({
      to,
      subject: 'Test Email - Cafe Chapter 1 (Fix Verification)',
      text: 'This is a test email sent from the backend to verify the new SMTP configuration.',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #047857;">Mailer is Working!</h2>
          <p>This test email confirms that your <strong>Brevo SMTP</strong> configuration is now correctly handling requests.</p>
          <hr />
          <p style="font-size: 12px; color: #666;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `
    });

    console.log('Test email sent successfully! 📧✅');
  } catch (error) {
    console.error('\nMailer test failed! ❌');
    console.error('Error:', error instanceof Error ? error.message : error);
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Error Code:', error.code);
    }
  }
}

test();
