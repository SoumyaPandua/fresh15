import transporter from "../config/mailer.js";

const sendEmail = async (to, subject, html) => {
    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        html
    });
};

export default sendEmail;