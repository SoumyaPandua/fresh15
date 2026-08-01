// import "./env.js";
// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//     },
// });

// transporter.verify()
//     .then(() => console.log("✅ SMTP Connected"))
//     .catch((err) => console.error("❌ SMTP Error:", err));

// export default transporter;

import "./env.js";
import nodemailer from "nodemailer";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },

    family: 4,

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
});

transporter
    .verify()
    .then(() => console.log("SMTP Connected"))
    .catch((err) => {
        console.error("SMTP Error:", {
            message: err.message,
            code: err.code,
            command: err.command,
        });
    });

export default transporter;