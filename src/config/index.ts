import { configDotenv } from "dotenv";

configDotenv();

const PORT = process.env.PORT || "5000";
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const ADMIN_ID = process.env.ADMIN_ID;
const OPENAI = process.env.OPENAI_API;

let config_missing = false;

if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN");
  config_missing = true;
}

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  config_missing = true;
}

if (!EMAIL) {
  console.error("Missing EMAIL");
  config_missing = true;
}

if (!PASSWORD) {
  console.error("Missing PASSWORD");
  config_missing = true;
}

if (!ADMIN_ID) {
  console.error("Missing ADMIN_ID");
  config_missing = true;
}
if (!OPENAI) {
  console.error("Missing OPENAI");
  config_missing = true;
}

if (config_missing) {
  process.exit(1);
}

interface Config {
  PORT: number;
  BOT_TOKEN: string;
  MONGODB_URI: string;
  EMAIL: string;
  PASSWORD: string;
  ADMIN_ID: string;
  OPENAI_API: string;
  /** Only notify Telegram when scraped 報酬 max amount is >= this (yen). */
  MIN_TELEGRAM_REPORT_YEN: number;
  PROXY: string | undefined;
  PROXY_AUTH: { username: string; password: string } | undefined;
}

const minTelegramYenRaw = process.env.MIN_TELEGRAM_REPORT_YEN;
const MIN_TELEGRAM_REPORT_YEN =
  minTelegramYenRaw !== undefined && minTelegramYenRaw !== ""
    ? Number(minTelegramYenRaw)
    : 200_000;

const config: Config = {
  PORT: Number(PORT),
  BOT_TOKEN: BOT_TOKEN!,
  MONGODB_URI: MONGODB_URI!,
  EMAIL: EMAIL!,
  PASSWORD: PASSWORD!,
  ADMIN_ID: ADMIN_ID!,
  OPENAI_API: OPENAI!,
  MIN_TELEGRAM_REPORT_YEN: Number.isFinite(MIN_TELEGRAM_REPORT_YEN)
    ? MIN_TELEGRAM_REPORT_YEN
    : 200_000,
  PROXY: process.env.PROXY,
  PROXY_AUTH: process.env.PROXY_AUTH ? JSON.parse(process.env.PROXY_AUTH) : undefined,
};

export default config;
