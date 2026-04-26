import config from "@/config";
import { Markup, Telegraf } from "telegraf";
import setup_commands from "./commands";
import { isEmpty } from "@/utils";

const bot = new Telegraf(config.BOT_TOKEN);

setup_commands(bot);

const refKeyboard = (jobId: string) => {
  if (isEmpty(jobId) || !config.PROJECT_LINKS_API) {
    return undefined;
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback("Reference sites", `ref|${jobId}`)],
  ]).reply_markup;
};

/**
 * @returns `message_id` of the first message (for thread replies in private chat)
 */
export const sendMessage = async (
  chatId: string,
  text: string,
  options?: { avatarUrl?: string; jobIdForRefButton?: string },
): Promise<number | undefined> => {
  const avatarUrl = options?.avatarUrl;
  const jobId = options?.jobIdForRefButton;
  const reply_markup = refKeyboard(jobId);
  const base = { parse_mode: "HTML" as const, ...(reply_markup ? { reply_markup } : {}) };

  try {
    if (!isEmpty(avatarUrl)) {
      const msg = await bot.telegram.sendPhoto(chatId, avatarUrl, {
        caption: text,
        ...base,
      });
      return msg.message_id;
    } else {
      const msg = await bot.telegram.sendMessage(chatId, text, base);
      return msg.message_id;
    }
  } catch (error: any) {
    console.error(`Error sending message to chat ${chatId}`, error.message);
    return undefined;
  }
};

export const launchBot = async () => {
  try {
    return await new Promise((resolve) => {
      bot.launch(() => {
        resolve("Bot started");
      });
    });
  } catch (error: any) {
    console.error("Error launching bot:", error.message);
    throw error;
  }
};
