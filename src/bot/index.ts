import config from "@/config";
import { Telegraf } from "telegraf";
import setup_commands from "./commands";
import { isEmpty } from "@/utils";

const bot = new Telegraf(config.BOT_TOKEN);

setup_commands(bot);

/**
 * @returns `message_id` of the first message (for thread replies in private chat)
 */
export const sendMessage = async (
  chatId: string,
  text: string,
  avatarUrl?: string,
): Promise<number | undefined> => {
  try {
    const extra = { parse_mode: "HTML" as const };

    if (!isEmpty(avatarUrl)) {
      const msg = await bot.telegram.sendPhoto(chatId, avatarUrl, {
        caption: text,
        parse_mode: "HTML",
      });
      return msg.message_id;
    } else {
      const msg = await bot.telegram.sendMessage(chatId, text, extra);
      return msg.message_id;
    }
  } catch (error: any) {
    console.error(`Error sending message to chat ${chatId}`, error.message);
    return undefined;
  }
};

/** Reply in the same thread as `replyToMessageId` (e.g. reference site links). */
export const sendMessageAsReply = async (
  chatId: string,
  text: string,
  replyToMessageId: number,
) => {
  try {
    await bot.telegram.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_parameters: { message_id: replyToMessageId },
    });
  } catch (error: any) {
    console.error(
      `Error sending thread reply to chat ${chatId}`,
      error.message,
    );
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
