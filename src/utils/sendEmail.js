import mailer from "../config/mailer.js";

const sendEmail = async (to, subject, html) => {
    const response = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
            method: "POST",

            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": mailer.apiKey,
            },

            body: JSON.stringify({
                sender: {
                    name: "Fresh15",
                    email: mailer.senderEmail,
                },

                to: [
                    {
                        email: to,
                    },
                ],

                subject,
                htmlContent: html,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Brevo Email Error:", data);
        throw new Error(
            data?.message || "Failed to send email"
        );
    }

    return data;
};

export default sendEmail;