require('dotenv').config();
const { sendEmail } = require('./dist/config/mailer');

async function main() {
  const to = 'sandeep140499@gmail.com';
  console.log(`Sending test email to ${to}...`);
  
  try {
    await sendEmail({
      to,
      subject: 'Test Email from Cafe Chapter 1',
      text: 'This is a test email to verify that the mailer configuration is working correctly.',
      html: '<h1>Test Email</h1><p>This is a test email to verify that the mailer configuration is working correctly.</p>'
    });
    console.log('Email sent successfully! ✅');
  } catch (error) {
    console.error('Failed to send email: ❌', error);
    process.exit(1);
  }
}

main();
