import * as nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 587,
  secure: false, // TLS requires secure: false for port 587
  requireTLS: true,
  tls: {
    ciphers: "SSLv3",
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  auth: {
    user: "aamaro@axzy.dev",
    pass: "martin@M070208",
  },
});
