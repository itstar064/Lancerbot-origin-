import axios from "axios";
import config from "@/config";

export type ProjectLinksResponse = {
  category: string;
  description: string;
  requestedCount: number;
  returnedCount: number;
  links: string[];
  totalCandidates: number;
};

const escapeTelegramHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeHref = (s: string) => s.replace(/&/g, "&amp;");

/** One reply chunk: header + link lines, under Telegram 4096. */
const MAX_CHUNK_BODY = 3600;

/**
 * POST to project-links API: category, description, count in JSON.
 */
export async function fetchReferenceLinks(
  category: string,
  description: string,
  count: number,
): Promise<ProjectLinksResponse | null> {
  if (!config.PROJECT_LINKS_API) {
    return null;
  }
  try {
    const { data } = await axios.post<ProjectLinksResponse>(
      config.PROJECT_LINKS_API,
      { category, description, count },
      {
        timeout: 20000,
        headers: { "content-type": "application/json" },
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );
    if (!data || !Array.isArray(data.links)) {
      return null;
    }
    return data;
  } catch (e) {
    console.error(
      "Project links API error:",
      (e as { message?: string }).message ?? e,
    );
    return null;
  }
}

/**
 * Split into HTML bodies for one or more thread replies (all reply to the main job message).
 */
export function buildReferenceMessageParts(
  res: ProjectLinksResponse,
): string[] {
  const { links, totalCandidates, returnedCount } = res;
  if (!links.length) {
    return [];
  }

  const lineBlocks = links.map((url, i) => {
    const h = escapeHref(url);
    const t = escapeTelegramHtml(url);
    return `${i + 1}. <a href="${h}">${t}</a>`;
  });

  const packed: string[][] = [];
  let current: string[] = [];
  let used = 0;
  for (const line of lineBlocks) {
    const extra = (current.length ? 1 : 0) + line.length;
    if (current.length > 0 && used + extra > MAX_CHUNK_BODY) {
      packed.push(current);
      current = [line];
      used = line.length;
    } else {
      current.push(line);
      used += extra;
    }
  }
  if (current.length) {
    packed.push(current);
  }

  const n = packed.length;
  return packed.map((c, i) => {
    const sub =
      n === 1
        ? ""
        : ` <i>(${i + 1}/${n})</i>`;
    const head =
      n === 1
        ? `<b>参考サイト</b>（表示: ${returnedCount} / 候補: ${totalCandidates}）\n\n`
        : i === 0
          ? `<b>参考サイト</b>（表示: ${returnedCount} / 候補: ${totalCandidates}）${sub}\n\n`
          : `<b>参考サイト</b> 続き${sub}\n\n`;
    return head + c.join("\n");
  });
}
