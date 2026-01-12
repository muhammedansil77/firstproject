import nodemailer from "nodemailer";

// Create transporter (use your email service)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD   // or process.env.SMTP_PASS
    }
});

// Send OTP Email
const sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: `"LuxTime" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your LuxTime Verification Code",
        text: `Your verification code is: ${otp}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #edb511; border-radius: 10px; background-color: #1a1a1a; color: white;">
                <h2 style="color: #edb511; text-align: center;">LuxTime</h2>
                <h3 style="text-align: center;">Email Verification</h3>
                <p>Hello,</p>
                <p>Your verification code is:</p>
                <h1 style="text-align: center; letter-spacing: 5px; background: #edb511; color: #000; padding: 15px; border-radius: 10px; font-size: 32px;">
                    ${otp}
                </h1>
                <p>This code expires in <strong>10 minutes</strong>.</p>
                <p>If you didn't request this, ignore this email.</p>
                <hr style="border: 1px solid #333;">
                <p style="font-size: 12px; color: #888; text-align: center;">
                    © 2025 LuxTime. All rights reserved.
                </p>
            </div>
            
        `,
        
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP email sent to ${email}`);
        console.log(otp)
    } catch (error) {
        console.log("Email send failed:", error.message);
        throw new Error("Failed to send OTP email");
    }
};

export { sendOtpEmail };