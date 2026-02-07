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
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light only">
    </head>

    <body style="margin:0; padding:0; background-color:#ffffff;" bgcolor="#ffffff">
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background-color:#ffffff;">
        <tr>
          <td align="center" style="padding:30px;">

            <table width="500" cellpadding="0" cellspacing="0"
              style="background-color:#ffffff; border-radius:12px; border:1px solid #e5e5e5; padding:25px;"
              bgcolor="#ffffff">

              <tr>
                <td align="center" style="font-family: Arial, sans-serif;">
                  <h2 style="color:#111111; margin:0;">LuxTime Email Verification</h2>

                  <p style="color:#444444; font-size:14px; margin-top:15px;">
                    Your OTP code is:
                  </p>

                  <div style="margin:20px 0; font-size:32px; font-weight:bold; letter-spacing:6px; color:#d4af37;">
                    ${otp}
                  </div>

                  <p style="color:#666666; font-size:13px;">
                    This code expires in 10 minutes.
                  </p>

                  <p style="color:#999999; font-size:12px; margin-top:20px;">
                    If you did not request this, ignore this email.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
    `
  };

  await transporter.sendMail(mailOptions);
};
