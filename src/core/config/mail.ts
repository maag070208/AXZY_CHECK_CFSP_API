import * as nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true, // Use SSL for port 465
  connectionTimeout: 30000, // Increase timeout for cloud environment
  greetingTimeout: 30000,
  auth: {
    user: "aamaro@axzy.dev",
    pass: "martin@M070208",
  },
});
