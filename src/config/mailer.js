import "./env.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

transporter.verify()
    .then(() => console.log("✅ SMTP Connected"))
    .catch((err) => console.error("❌ SMTP Error:", err));

export default transporter;