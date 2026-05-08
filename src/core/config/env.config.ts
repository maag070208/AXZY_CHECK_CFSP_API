import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4444', 10),
  APP_SECRET: process.env.APP_SECRET || 'secret',
  DATABASE_URL: process.env.DATABASE_URL,
  SYSTEM_URL: process.env.SYSTEM_URL,
  AWS: {
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    REGION: process.env.AWS_REGION,
    BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  },
  TWILIO: {
    ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    API_KEY_SID: process.env.TWILIO_API_KEY_SID,
    API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET,
  },
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};
