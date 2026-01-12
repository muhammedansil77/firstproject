import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
});

export const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"LuxTime" <${process.env.NODEMAILER_EMAIL}>`,
    to: email,
    subject: "LuxTime Email Verification",
    html: `
      <div style="font-family: Arial; background:#111; color:#fff; padding:20px;">
        <h2 style="color:#d4af37;">Email Verification</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing:6px;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};
