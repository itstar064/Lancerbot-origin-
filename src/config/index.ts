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
  /**
   * When set (yen), Telegram only notifies jobs whose scraped 報酬 parses to max >= this.
   * When unset, every new job is notified.
   */
  TELEGRAM_NOTIFY_MIN_YEN: number | undefined;
  PROXY: string | undefined;
  PROXY_AUTH: { username: string; password: string } | undefined;
}

const minYenRaw =
  process.env.TELEGRAM_NOTIFY_MIN_YEN ?? process.env.MIN_TELEGRAM_REPORT_YEN;
const minYenParsed =
  minYenRaw !== undefined && minYenRaw !== "" ? Number(minYenRaw) : NaN;
const TELEGRAM_NOTIFY_MIN_YEN =
  Number.isFinite(minYenParsed) && minYenParsed > 0
    ? minYenParsed
    : undefined;

const config: Config = {
  PORT: Number(PORT),
  BOT_TOKEN: BOT_TOKEN!,
  MONGODB_URI: MONGODB_URI!,
  EMAIL: EMAIL!,
  PASSWORD: PASSWORD!,
  ADMIN_ID: ADMIN_ID!,
  OPENAI_API: OPENAI!,
  TELEGRAM_NOTIFY_MIN_YEN,
  PROXY: process.env.PROXY,
  PROXY_AUTH: process.env.PROXY_AUTH ? JSON.parse(process.env.PROXY_AUTH) : undefined,
};

export default config;
