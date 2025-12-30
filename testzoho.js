// test-zoho.js
const nodemailer = require('nodemailer');

async function testZoho() {
  console.log('🔍 Testing Zoho Configuration...\n');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: 'subscriptions@com360view.com',
      pass: '2cBUL1zj8RzC',
    },
    debug: true, // Enable debug output
    logger: true  // Log to console
  });

  try {
    // Verify connection
    console.log('✅ Step 1: Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection successful!\n');

    // Send test email
    console.log('📧 Step 2: Sending test email...');
    const info = await transporter.sendMail({
      from: '"Test" <subscriptions@com360view.com>',
      to: 'subscriptions@com360view.com', // Send to yourself
      subject: 'Zoho Test Email',
      text: 'If you receive this, Zoho is working correctly!',
      html: '<b>If you receive this, Zoho is working correctly!</b>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📨 Message ID:', info.messageId);
    console.log('\n✅ ALL TESTS PASSED! Zoho is configured correctly.');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('\n🔴 Authentication Failed!');
      console.error('Solutions:');
      console.error('1. Check if your password is correct');
      console.error('2. Enable "Allow less secure apps" in Zoho');
      console.error('3. Generate an App Password instead');
    } else if (error.responseCode === 550) {
      console.error('\n🔴 Rate Limit or Spam Detection!');
      console.error('Solutions:');
      console.error('1. Wait 15-30 minutes before trying again');
      console.error('2. Contact Zoho support to unblock your account');
      console.error('3. Verify SPF/DKIM records for your domain');
    }
    
    console.error('\nFull Error:', error);
  }
}

testZoho();