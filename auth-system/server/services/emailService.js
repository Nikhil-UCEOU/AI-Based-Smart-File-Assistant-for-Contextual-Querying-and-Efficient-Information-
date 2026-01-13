const nodemailer = require('nodemailer');

// Create transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendPasswordResetEmail(userEmail, userName, resetToken) {
  const resetUrl = `${process.env.RESET_URL_BASE}?token=${resetToken}`;
  
  console.log(`📧 Attempting to send password reset email to ${userEmail}...`);
  
  try {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: userEmail,
      subject: 'Password Reset Request - AI Smart File Assistant',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">AI-Based Smart File Assistant</p>
          </div>
          
          <div style="padding: 0 20px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hello <strong>${userName}</strong>,</p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 25px;">
              We received a request to reset your password. If you made this request, click the button below to reset your password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 25px 0;">
              <p style="font-size: 14px; color: #856404; margin: 0; font-weight: 500;">
                ⚠️ This link will expire in 1 hour for security reasons.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              This email was sent by AI-Based Smart File Assistant<br>
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📧 Sent to: ${userEmail}`);
    
    return info;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    
    // Fallback: Log the reset token
    console.log('📝 Email failed - logging reset token:');
    console.log('=== PASSWORD RESET TOKEN ===');
    console.log(`Email: ${userEmail}`);
    console.log(`Name: ${userName}`);
    console.log(`Reset Token: ${resetToken}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('============================');
    
    return { messageId: 'email-failed-logged' };
  }
}

async function sendWelcomeEmail(userEmail, userName) {
  console.log(`📧 Attempting to send welcome email to ${userEmail}...`);
  
  try {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: userEmail,
      subject: 'Welcome to AI Smart File Assistant! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to AI Smart File Assistant! 🎉</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your account has been created successfully</p>
          </div>
          
          <div style="padding: 0 20px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hello <strong>${userName}</strong>,</p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 25px;">
              Welcome to AI-Based Smart File Assistant! We're excited to have you on board. Your account has been successfully created and you can now start using our powerful features.
            </p>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">🚀 What you can do:</h3>
              <ul style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Upload and manage multiple documents</li>
                <li>Query your files with AI-powered search</li>
                <li>Extract information efficiently from multi-doc collections</li>
                <li>Get context-aware responses from your documents</li>
                <li>Organize and categorize your file library</li>
                <li>Access advanced analytics and insights</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Go to Dashboard
              </a>
            </div>
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 25px 0;">
              <p style="font-size: 14px; color: #155724; margin: 0; font-weight: 500;">
                💡 Pro Tip: Start by uploading your first document and try asking questions about its content!
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              If you have any questions or need help getting started, don't hesitate to reach out to our support team.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              This email was sent by AI-Based Smart File Assistant<br>
              Thank you for choosing our platform!
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📧 Sent to: ${userEmail}`);
    
    return info;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return { messageId: 'email-failed' };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail
};