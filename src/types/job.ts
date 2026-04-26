interface JobType {
  id: string;
  bidPlaced: boolean;
  /** Lancers カテゴリ / 概要 — for PROJECT_LINKS_API on demand */
  refCategory?: string;
  refDescription?: string;
}

export interface ScrapedJobType {
  id?: string;
  title: string;
  url: string;
  desc: string;
  category: string;
  price: string;
  suggestions: string;
  daysLeft: string;
  deadline: string;
  postedDate: string;
  employer: string;
  employerUrl: string;
  employerAvatar: string;
  tags?: string[];
  workType?: string;
}

export default JobType;
