const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Create a transporter
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports like 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        // For development with services like Gmail, you might need to allow less secure apps
        // or configure TLS options if you encounter issues.
        // tls: { rejectUnauthorized: false } // Use with caution, only if necessary
    });

    // 2. Define the email options
    const mailOptions = {
        from: process.env.EMAIL_FROM, // Sender address (defined in .env)
        to: options.email, // List of receivers
        subject: options.subject, // Subject line
        text: options.message, // Plain text body
        // html: options.html // You can also send HTML content
    };

    // 3. Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;