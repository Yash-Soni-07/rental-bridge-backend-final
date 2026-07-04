import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

let testAccount: nodemailer.TestAccount | null = null;

async function getTransporter() {
    // If user provided real credentials, use them
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            service: "gmail", // Assuming Gmail based on the prompt, can be changed
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    // Otherwise, create a mock test account automatically
    if (!testAccount) {
        testAccount = await nodemailer.createTestAccount();
    }
    
    return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });
}

router.post("/", async (req, res) => {
    try {
        const { name, phone, email, message, property } = req.body;

        if (!name || !phone || !email || !property) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const transporter = await getTransporter();

        // 1. Email to the Owner/Agent
        const ownerMail = await transporter.sendMail({
            from: '"Rental Bridge" <noreply@rentalbridge.com>',
            to: "yashsoni0701@gmail.com",
            subject: `New Property Inquiry from ${name}`,
            text: `
You have received a new inquiry for a property!

--- User Details ---
Name: ${name}
Phone: ${phone}
Email: ${email}
Message: ${message || "No additional message."}

--- Property Details ---
Title: ${property.name}
Type: ${property.type}
Location: ${property.location}
Price/Rent: ${property.price}
            `.trim(),
        });

        // 2. Email to the User
        const userMail = await transporter.sendMail({
            from: '"Rental Bridge" <noreply@rentalbridge.com>',
            to: email,
            subject: "Your inquiry has been registered!",
            text: `
Hello ${name},

Welcome to Rental Bridge! 

We have successfully registered your inquiry for:
${property.name} (${property.location})

Our team or the property owner will contact you shortly at ${phone} or via this email address.

Best regards,
Rental Bridge Team
            `.trim(),
        });

        // If using test account, log the preview URLs so they can be viewed
        if (!process.env.SMTP_USER) {
            console.log("Mock Email 1 (To Owner):", nodemailer.getTestMessageUrl(ownerMail));
            console.log("Mock Email 2 (To User):", nodemailer.getTestMessageUrl(userMail));
        }

        return res.status(200).json({ 
            message: "Inquiry sent successfully",
            previewUrl: process.env.SMTP_USER ? null : nodemailer.getTestMessageUrl(userMail)
        });
    } catch (error) {
        console.error("Error sending inquiry email:", error);
        return res.status(500).json({ error: "Failed to send inquiry" });
    }
});

export default router;
