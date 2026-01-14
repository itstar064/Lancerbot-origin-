import { sendMessage } from "./bot";
import Job from "./models/Job";
import { ScrapedJobType } from "./types/job";
import { delay, isEmpty } from "./utils";

const processScrapedJob = async (userid: string, jobs: ScrapedJobType[]) => {
  console.log(`🔄 Processing ${jobs.length} jobs...`);
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    // Use job.id if available, otherwise extract from URL
    const jobid = (job as any).id || job.url.split("/").pop() || "";
    console.log(`🔍 Checking job ID: ${jobid}`);
    const exist = await Job.findOne({ id: jobid });
    if (isEmpty(exist)) {
      console.log(`✨ New job found! ID: ${jobid} - ${job.title}`);
      await Job.create({ id: jobid });
      
      // Build message with title, category, id, period, price, and avatar
      let message = `🔉 <b>${job.title}</b>\n\n`;
      
      if (jobid) {
        message += `<b>ID:</b> ${job.employer}\n`;
      }
      
      if (job.category) {
        message += `<b>カテゴリ:</b> ${job.category}\n`;
      }
      
      if (job.daysLeft) {
        message += `<b>期間:</b> ${job.daysLeft}\n`;
      }
      
      if (job.price) {
        message += `<b>報酬:</b> ${job.price}円\n`;
      }
      
      await sendMessage(
        userid,
        message,
        job.url,
        job.employerUrl,
        jobid,
        job.employerAvatar,
      );
    } else {
      console.log(`⏭️  Job already exists, skipping. ID: ${jobid}`);
    }
    await delay(200);
  }
  console.log(`✅ Finished processing ${jobs.length} jobs`);
};

export default processScrapedJob;
