import config from "@/config";
import Job from "@/models/Job";
import {
  buildReferenceMessageParts,
  fetchReferenceLinks,
} from "@/services/projectLinks";
import { delay } from "@/utils";
import type { Context } from "telegraf";

export async function handleRefSitesCallback(ctx: Context) {
  const data = (ctx as { callbackQuery?: { data?: string } })?.callbackQuery
    ?.data;
  if (!data || !data.startsWith("ref|")) return;

  const jobid = data.replace(/^ref\|/, "");
  if (!jobid) {
    await ctx.answerCbQuery("Invalid id.");
    return;
  }

  if (!config.PROJECT_LINKS_API) {
    await ctx.answerCbQuery("Reference API is off.");
    return;
  }

  await ctx.answerCbQuery("OK");

  const msg = (ctx as { callbackQuery?: { message?: { message_id?: number } } })
    .callbackQuery?.message;
  const replyTo = msg?.message_id;
  const chatId = ctx.chat?.id;
  if (chatId == null) return;

  const sendThread = (text: string) => {
    const p: { parse_mode: "HTML"; reply_to_message_id?: number } = {
      parse_mode: "HTML",
    };
    if (replyTo != null) {
      p.reply_to_message_id = replyTo;
    }
    return ctx.telegram.sendMessage(String(chatId), text, p);
  };

  const job = await Job.findOne({ id: jobid });
  if (!job) {
    await sendThread("Job is not in the database (cannot load references).");
    return;
  }

  const doc = job as { refCategory?: string; refDescription?: string };
  const category = (doc.refCategory || "未分類")
    .replace(/\s+/g, " ")
    .trim();
  const description = (doc.refDescription || "No description")
    .replace(/\s+/g, " ")
    .trim();

  const ref = await fetchReferenceLinks(
    category,
    description,
    config.PROJECT_LINKS_MAX,
  );

  if (!ref?.links?.length) {
    await sendThread("No reference links (API empty or error).");
    return;
  }

  for (const part of buildReferenceMessageParts(ref)) {
    await sendThread(part);
    await delay(200);
  }
}
