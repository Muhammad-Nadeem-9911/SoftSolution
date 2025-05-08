const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Create a transporter (this should use your existing Nodemailer setup)
  //    Ensure your .env variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD) are set.
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // Changed to match .env
        pass: process.env.EMAIL_PASS, // Changed to match .env
    },
    // For services like Gmail, you might need to configure "less secure app access"
    // or use an "App Password" if 2FA is enabled.
    // tls: {
    //   rejectUnauthorized: false // Often needed for local development with some providers
    // }
  });

  // 2. Define the email options
  const mailOptions = {
    from: process.env.EMAIL_FROM || `SoftSolution <${process.env.EMAIL_USER}>`, // Use EMAIL_FROM from .env or default
    to: options.email,
    subject: options.subject,
    html: options.html,
    // text: options.text, // You can also provide a plain text version
  };

  // 3. Actually send the email
  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', options.email);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Email could not be sent. Please try again later.'); // Or handle more gracefully
  }
};

module.exports = sendEmail;