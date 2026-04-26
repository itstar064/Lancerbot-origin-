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

const plEnv = process.env.PROJECT_LINKS_API;
const PROJECT_LINKS_API: string | undefined = (() => {
  if (plEnv === "off" || plEnv === "false" || plEnv === "0" || plEnv === "") {
    return undefined;
  }
  if (plEnv) {
    return plEnv;
  }
  return "http://135.181.224.37:3000/api/project-links";
})();

const _plMax = parseInt(process.env.PROJECT_LINKS_MAX || "200", 10);
/** Requested link count sent to the API; higher = return more URLs in one response */
const PROJECT_LINKS_MAX = Math.min(2000, Math.max(1, _plMax || 200));

interface Config {
  PORT: number;
  BOT_TOKEN: string;
  MONGODB_URI: string;
  EMAIL: string;
  PASSWORD: string;
  ADMIN_ID: string;
  OPENAI_API: string;
  /** POST JSON body: category, description, count — empty / off to disable */
  PROJECT_LINKS_API: string | undefined;
  /** Max `count` in project-links request (all returned `links` are then posted) */
  PROJECT_LINKS_MAX: number;
  PROXY: string | undefined;
  PROXY_AUTH: { username: string; password: string } | undefined;
}

const config: Config = {
  PORT: Number(PORT),
  BOT_TOKEN: BOT_TOKEN!,
  MONGODB_URI: MONGODB_URI!,
  EMAIL: EMAIL!,
  PASSWORD: PASSWORD!,
  ADMIN_ID: ADMIN_ID!,
  OPENAI_API: OPENAI!,
  PROJECT_LINKS_API: PROJECT_LINKS_API,
  PROJECT_LINKS_MAX,
  PROXY: process.env.PROXY,
  PROXY_AUTH: process.env.PROXY_AUTH ? JSON.parse(process.env.PROXY_AUTH) : undefined,
};

export default config;
