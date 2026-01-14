import { delay, isEmpty } from "@/utils";
import { connect, PageWithCursor } from "puppeteer-real-browser";
import config from "@/config";
import processScrapedJob from "@/job.controller";
import { existsSync, mkdirSync, rmSync } from "fs";
import * as path from "path";

let scraping = false;
const searchUrls = [
  "https://www.lancers.jp/work/search/system?open=1&show_description=1&sort=started&type%5B%5D=competition&type%5B%5D=project&type%5B%5D=task&work_rank%5B%5D=0&work_rank%5B%5D=2&work_rank%5B%5D=3",
  "https://www.lancers.jp/work/search/web?open=1&show_description=1&sort=started&type%5B%5D=competition&type%5B%5D=project&type%5B%5D=task&work_rank%5B%5D=0&work_rank%5B%5D=2&work_rank%5B%5D=3",
];

export const useRealBrowser = async () => {
  try {
    const proxy = (config as any).PROXY as string | undefined;
    const proxyAuth = (config as any).PROXY_AUTH as
      | { username: string; password: string }
      | undefined;

    const userDataDir = path.resolve(process.cwd(), "userdata");
    console.log("📁 User data directory:", userDataDir);
    
    try {
      mkdirSync(userDataDir, { recursive: true });
      // Remove possible Chrome profile locks that can block startup on Windows
      ["SingletonLock", "SingletonCookie", "SingletonSocket"].forEach((f) => {
        const p = path.join(userDataDir, f);
        if (existsSync(p)) {
          try {
            rmSync(p, { force: true });
          } catch {}
        }
      });
    } catch (err) {
      console.log("Error setting up user data directory:", (err as Error).message);
    }

    const baseLaunchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--start-minimized",
      "--window-size=800,600",
      "--window-position=800,1000",
    ];

    const withProxyArgs = [...baseLaunchArgs];
    if (proxy) {
      withProxyArgs.push(`--proxy-server=${proxy}`);
      console.log("Using proxy:", proxy);
    }

    const connectOnce = async (args: string[]) =>
      connect({
        headless: true,
        args,
        customConfig: {
          userDataDir, // folder to store session/cookies
        },
        turnstile: true,
        connectOption: {
          protocolTimeout: 300000, // set to 5 minutes
        },
        disableXvfb: false,
        ignoreAllFlags: false,
      });

    let browser, page;
    try {
      ({ browser, page } = await connectOnce(withProxyArgs));
    } catch (firstErr) {
      // Retry once without proxy to isolate proxy-related failures
      console.error(
        "First launch attempt failed:",
        (firstErr as Error).message
      );
      try {
        ({ browser, page } = await connectOnce(baseLaunchArgs));
        console.log("Launched without proxy as a fallback");
      } catch (secondErr) {
        throw secondErr;
      }
    }

    // Set up request interception to block images, stylesheets, fonts for faster loading
    await page.setRequestInterception(true);
    page.on("request", (interceptedRequest) => {
      const resourceType = interceptedRequest.resourceType();
      const url = interceptedRequest.url();
      if (
        resourceType === "image" ||
        resourceType === "stylesheet" ||
        resourceType === "font" ||
        url.match(/\.(png|jpe?g|gif|webp|svg|ico)$/i) ||
        url.match(/\.(woff2?|ttf|otf|eot)$/i) ||
        url.match(/\.(css)$/i)
      ) {
        interceptedRequest.abort();
      } else {
        interceptedRequest.continue();
      }
    });

    // If proxy requires authentication, provide credentials to the page
    if (proxy && proxyAuth && page && (page as any).authenticate) {
      try {
        await (page as any).authenticate({
          username: proxyAuth.username,
          password: proxyAuth.password,
        });
        console.log("Proxy authentication applied");
      } catch (authErr) {
        console.error("Error applying proxy auth:", (authErr as Error).message);
      }
    }

    return { browser, page };
  } catch (err) {
    console.error("Error in useRealBrowser:", (err as Error).message);
    throw err;
  }
};

// Check if user is logged in by checking for login indicators
export const isLoggedIn = async (page: PageWithCursor): Promise<boolean> => {
  try {
    const currentUrl = page.url();
    // If we're on login page, we're not logged in
    if (currentUrl.includes('/login')) {
      return false;
    }
    
    // If we're on verify_code page, we're in the process of logging in but not fully logged in yet
    // However, if the session is already verified, we might be redirected away automatically
    if (currentUrl.includes('/verify_code')) {
      // Wait a bit to see if we get redirected
      await delay(2000);
      const newUrl = page.url();
      if (newUrl.includes('/verify_code')) {
        // Still on verify_code page - not fully logged in
        return false;
      }
      // Got redirected - check again
      return await isLoggedIn(page);
    }
    
    // Try to find elements that indicate logged-in state
    const loggedInIndicators = await page.evaluate(() => {
      // Check for common logged-in indicators on Lancers.jp
      const userMenu = document.querySelector('.c-header__user-menu, .p-header__user, [class*="user-menu"]');
      const logoutLink = document.querySelector('a[href*="/user/logout"]');
      const myPageLink = document.querySelector('a[href*="/mypage"]');
      const headerUser = document.querySelector('.c-header__user, .p-header__user');
      return !!(userMenu || logoutLink || myPageLink || headerUser);
    });
    
    return loggedInIndicators;
  } catch (err) {
    console.error("Error checking login status:", (err as Error).message);
    return false;
  }
};

export const login = async (page: PageWithCursor) => {
  try {
    console.log("🔐 Navigating to login page...");
    await page.goto("https://www.lancers.jp/user/login?ref=header_menu", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for login form to be fully loaded
    console.log("⏳ Waiting for login form...");
    await page.waitForSelector('#login_form, form#login_form', { timeout: 15000 });
    console.log("✅ Login form found");

    // Wait for form fields to be ready
    await page.waitForSelector('#UserEmail', { timeout: 10000 });
    await page.waitForSelector('#UserPassword', { timeout: 10000 });
    await page.waitForSelector('#form_submit', { timeout: 10000 });
    
    // Wait a bit for any JavaScript to finish loading
    await delay(1000);

    // Clear and fill email field
    console.log("📧 Filling email field...");
    await page.click('#UserEmail');
    await delay(200);
    await page.evaluate(() => {
      const emailInput = document.querySelector('#UserEmail') as HTMLInputElement;
      if (emailInput) {
        emailInput.value = '';
        emailInput.focus();
      }
    });
    await page.type('#UserEmail', config.EMAIL, { delay: 100 });
    await delay(500);

    // Clear and fill password field
    console.log("🔑 Filling password field...");
    await page.click('#UserPassword');
    await delay(200);
    await page.evaluate(() => {
      const passwordInput = document.querySelector('#UserPassword') as HTMLInputElement;
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    });
    await page.type('#UserPassword', config.PASSWORD, { delay: 100 });
    await delay(500);

    // Check for any validation errors before submitting
    const hasErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('.is-invalid, .c-form__item-error:not(:empty)');
      return errorElements.length > 0;
    });

    if (hasErrors) {
      console.log("⚠️ Form validation errors detected, checking...");
      const errorText = await page.evaluate(() => {
        const errors = Array.from(document.querySelectorAll('.c-form__item-error'))
          .map(el => el.textContent?.trim())
          .filter(text => text);
        return errors.join(', ');
      });
      console.log("Error messages:", errorText);
    }

    // Wait a bit before submitting to ensure form is ready
    await delay(1000);

    // Verify form fields have values before submitting
    const formReady = await page.evaluate(() => {
      const emailInput = document.querySelector('#UserEmail') as HTMLInputElement;
      const passwordInput = document.querySelector('#UserPassword') as HTMLInputElement;
      return emailInput?.value && passwordInput?.value;
    });

    if (!formReady) {
      throw new Error("Form fields are not filled correctly");
    }

    // Get current URL before submission
    const urlBeforeSubmit = page.url();
    
    // Submit the form - try clicking the submit button
    console.log("🔓 Submitting login form...");
    
    // Wait for navigation promise before clicking
    const navigationPromise = page.waitForNavigation({ 
      waitUntil: "networkidle2", 
      timeout: 30000 
    });
    
    await page.click('#form_submit');
    
    // Wait for navigation or form submission
    try {
      await navigationPromise;
      console.log("✅ Navigation completed");
    } catch (navErr) {
      console.log("⚠️ Navigation timeout, waiting and checking...");
      // Wait a bit more and check URL
      await delay(5000);
    }
    
    // Check current URL and page state
    const currentUrl = page.url();
    console.log("📍 Current URL:", currentUrl);
    
    // Check if we're on verify_code page - this means login was successful but verification is needed
    if (currentUrl.includes('/verify_code')) {
      console.log("🔐 Redirected to verification code page - login credentials accepted");
      console.log("⏳ If verification was already completed manually, session should be saved");
      console.log("⏳ Waiting to see if we get redirected automatically...");
      
      // Wait to see if we get automatically redirected (if already verified)
      await delay(5000);
      const urlAfterWait = page.url();
      
      if (urlAfterWait.includes('/verify_code')) {
        console.log("⚠️ Still on verification page - manual verification may be needed");
        console.log("💡 Tip: If you've already verified manually in this browser, the session should be saved");
        console.log("💡 The scraper will try to continue - if verification is needed, please complete it manually");
        // Don't throw error - let it continue and check login status
      } else {
        console.log("✅ Automatically redirected from verify_code to:", urlAfterWait);
      }
    } else if (currentUrl.includes('/login')) {
      // Check for error messages
      const errorMessage = await page.evaluate(() => {
        const errorEl = document.querySelector('.c-form__item-error, .is-invalid');
        return errorEl?.textContent?.trim() || '';
      });
      
      if (errorMessage) {
        console.log("❌ Login error:", errorMessage);
        throw new Error(`Login failed: ${errorMessage}`);
      }
      
      // Check if form still exists (might be a redirect issue)
      const formExists = await page.evaluate(() => {
        return !!document.querySelector('#login_form');
      });
      
      if (formExists) {
        console.log("⚠️ Still on login page with form visible");
        // Wait a bit more - sometimes redirect is delayed
        await delay(5000);
        const newUrl = page.url();
        if (newUrl.includes('/login')) {
          throw new Error("Login failed - still on login page after waiting");
        } else {
          console.log("✅ Redirected after delay to:", newUrl);
        }
      }
    } else {
      console.log("✅ Login successful - redirected to:", currentUrl);
    }

    // Verify login by checking for logged-in indicators
    // Give it more time if we were on verify_code page
    await delay(3000);
    
    // Navigate to homepage to check login status properly
    try {
      await page.goto("https://www.lancers.jp/", { waitUntil: "domcontentloaded", timeout: 15000 });
      await delay(2000);
    } catch (err) {
      console.log("⚠️ Error navigating to homepage for verification:", (err as Error).message);
    }
    
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      console.log("⚠️ Login verification failed - checking again...");
      // Try one more time after a longer delay
      await delay(3000);
      const loggedInAgain = await isLoggedIn(page);
      if (!loggedInAgain) {
        // Don't throw error if we're on verify_code - that's expected
        const finalUrl = page.url();
        if (finalUrl.includes('/verify_code')) {
          console.log("⚠️ On verification page - please complete verification manually if needed");
          console.log("💡 If you've already verified, the session should work on next run");
          // Return without error - let the scraper try to continue
          return;
        }
        throw new Error("Login verification failed - user may not be logged in");
      } else {
        console.log("✅ Login verified on second check");
      }
    } else {
      console.log("✅ Login verified - user is logged in");
    }
  } catch (err) {
    console.error("Error in login:", (err as Error).message);
    // Take a screenshot for debugging
    try {
      const screenshotsDir = `${process.cwd()}/screenshots`;
      if (!existsSync(screenshotsDir)) {
        mkdirSync(screenshotsDir, { recursive: true });
      }
      await page.screenshot({ path: `${screenshotsDir}/login_error.png`, fullPage: true });
      console.log("📸 Screenshot saved to screenshots/login_error.png");
    } catch (screenshotErr) {
      console.error("Could not save screenshot:", (screenshotErr as Error).message);
    }
    throw err;
  }
};

export async function scrapeJobs() {
  let iteration = 0;
  const RESTART_BROWSER_EVERY = 100; // Restart browser every 100 cycles to avoid memory leaks

  let browser: Awaited<ReturnType<typeof useRealBrowser>>["browser"] | null =
    null;
  let page: Awaited<ReturnType<typeof useRealBrowser>>["page"] | null = null;

  // Initialize browser and check login status (use existing logged-in session)
  console.log("🌐 Initializing browser (using existing logged-in session)...");
  try {
    const realBrowser = await useRealBrowser();
    browser = realBrowser.browser;
    page = realBrowser.page;

    try {
      await page!.setViewport({ width: 1220, height: 860 });
    } catch (err) {
      console.error("Error setting viewport:", (err as Error).message);
    }

    // Navigate to homepage to check if already logged in (from saved session)
    console.log("🔍 Checking login status from saved session...");
    try {
      await page!.goto("https://www.lancers.jp/", { waitUntil: "networkidle2", timeout: 20000 });
      await delay(3000);
    } catch (err) {
      console.log("⚠️ Error navigating to homepage, continuing...");
    }

    // Check if already logged in (session should be preserved from userDataDir if you logged in manually)
    const alreadyLoggedIn = await isLoggedIn(page!);
    if (alreadyLoggedIn) {
      console.log("✅ Already logged in - using existing session from browser");
      console.log("🚀 Ready to start scraping with logged-in session");
    } else {
      // Check current URL - might be on verify_code or other page
      const currentUrl = page!.url();
      console.log("📍 Current URL:", currentUrl);
      
      if (currentUrl.includes('/verify_code')) {
        console.log("💡 On verification page - if you've already verified manually, session should work");
        console.log("💡 Attempting to continue - session may be valid");
        // Try navigating to a protected page to test
        try {
          await page!.goto("https://www.lancers.jp/work/search", { waitUntil: "domcontentloaded", timeout: 15000 });
          await delay(2000);
          const testLogin = await isLoggedIn(page!);
          if (testLogin) {
            console.log("✅ Session is valid - ready to scrape");
          } else {
            console.log("⚠️ Session may not be fully active, but continuing anyway");
          }
        } catch (testErr) {
          console.log("⚠️ Could not test session, but continuing:", (testErr as Error).message);
        }
      } else if (currentUrl.includes('/login')) {
        console.log("⚠️ Not logged in - you may need to login manually in the browser");
        console.log("💡 After logging in manually, the session will be saved and used next time");
        console.log("💡 Continuing anyway - will attempt to scrape");
      } else {
        console.log("⚠️ Login status unclear, but continuing to scrape");
      }
    }

    // Final check - try accessing search page to confirm we can scrape
    try {
      await page!.goto("https://www.lancers.jp/work/search", { waitUntil: "domcontentloaded", timeout: 15000 });
      await delay(2000);
      console.log("✅ Can access search page - ready to scrape");
    } catch (verifyErr) {
      console.log("⚠️ Could not access search page, but will try anyway:", (verifyErr as Error).message);
    }

    await delay(2000);
  } catch (err) {
    console.error("Error initializing browser:", (err as Error).message);
    throw err;
  }

  while (true) {
    // Check if scraping should stop and cleanup
    if (!scraping) {
      try {
        if (page) await page.close().catch(() => { });
      } catch (err) {
        console.error("Error closing page:", (err as Error).message);
      }
      try {
        if (browser) await browser.close().catch(() => { });
      } catch (err) {
        console.error("Error closing browser:", (err as Error).message);
      }
      break;
    }

    try {
      // Restart browser every N iterations (but not on first iteration since we just initialized)
      if (iteration > 0 && iteration % RESTART_BROWSER_EVERY === 0) {
        console.log("♻️ Restarting browser to free resources...");
        try {
          if (page) await page.close().catch(() => { });
        } catch (err) {
          console.error("Error closing page:", (err as Error).message);
        }
        try {
          if (browser) await browser.close().catch(() => { });
        } catch (err) {
          console.error("Error closing browser:", (err as Error).message);
        }
        let realBrowser;
        try {
          realBrowser = await useRealBrowser();
        } catch (err) {
          console.error("Error creating real browser:", (err as Error).message);
          await delay(5000);
          continue;
        }
        browser = realBrowser.browser;
        page = realBrowser.page;
        iteration = 0;

        try {
          await page!.setViewport({ width: 1220, height: 860 });
        } catch (err) {
          console.error("Error setting viewport:", (err as Error).message);
        }

        // Check if session was preserved (from userDataDir)
        try {
          await page!.goto("https://www.lancers.jp/", { waitUntil: "networkidle2", timeout: 15000 });
          await delay(2000);
          const loggedIn = await isLoggedIn(page!);
          if (loggedIn) {
            console.log("✅ Browser restarted - login session preserved from saved data");
          } else {
            console.log("⚠️ Session not restored after restart");
            console.log("💡 If you're logged in manually, the session should be saved");
            console.log("💡 Continuing anyway - will attempt to scrape");
          }
        } catch (err) {
          console.error("Error verifying login after restart:", (err as Error).message);
          console.log("💡 Continuing anyway - session may still be valid");
        }

        await delay(2000);
      }

      // Check again after browser restart
      if (!scraping) break;

      try {
        const searchUrl = searchUrls[iteration % searchUrls.length];

        if (isEmpty(searchUrl)) continue;

        // Quick check if we're logged in (using existing session)
        try {
          const loggedIn = await isLoggedIn(page!);
          if (!loggedIn) {
            console.log("⚠️ Login status unclear, but continuing with scraping");
            console.log("💡 Using existing browser session - if logged in manually, it should work");
          } else {
            console.log("✅ Confirmed logged in - proceeding to scrape");
          }
        } catch (loginCheckErr) {
          console.log("⚠️ Error checking login status, but continuing:", (loginCheckErr as Error).message);
        }

        try {
          await page!.goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });

          // Check if we got redirected to login page (session might have expired)
          const currentUrl = page!.url();
          if (currentUrl.includes('/login')) {
            console.log("⚠️ Redirected to login page - session may have expired");
            console.log("💡 Please login manually in the browser, then the session will be saved");
            console.log("💡 Skipping this scrape iteration");
            await delay(30000); // Wait before retrying
            continue;
          } else {
            console.log("✅ Successfully navigated to search page");
          }
        } catch (err) {
          console.error(
            "Error navigating to searchUrl:",
            (err as Error).message,
          );
          continue;
        }
        const MAX_RETRIES = 30;
        let jobs = [];

        //After page title is found, try to scrape with retries
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            // Wait for at least one job card to appear
            const jobCards = await page!.$$(".p-search-job-media");
            if (jobCards.length === 0) {
              console.log(
                `🕵️ Waiting for job cards... (${attempt + 1}/${MAX_RETRIES})`,
              );
              await delay(1000);
              continue;
            }

            // Ensure the screenshots directory exists before saving the screenshot
            const screenshotsDir = `${process.cwd()}/screenshots`;
            if (!existsSync(screenshotsDir)) {
              mkdirSync(screenshotsDir, { recursive: true });
            }
            await page.screenshot({
              path: `${screenshotsDir}/job_cards.png`,
            });

            jobs = await page!.evaluate(() => {
              // Select all job card elements
              const cardNodes = document.querySelectorAll(
                ".p-search-job-media",
              );
              const results: any[] = [];

              cardNodes.forEach((card) => {
                // Job ID - extract from onclick attribute or URL
                let jobId = "";
                const onclickAttr = card.getAttribute("onclick");
                if (onclickAttr) {
                  const match = onclickAttr.match(/goToLjpWorkDetail\((\d+)\)/);
                  if (match) {
                    jobId = match[1];
                  }
                }

                // Title from p-search-job-media__title c-media__title
                // Exclude tags (NEW, 2回目, etc.) from title
                const titleElement = card.querySelector(".p-search-job-media__title.c-media__title");
                let title = "";
                if (titleElement) {
                  // Clone the element to avoid modifying the original
                  const cloned = titleElement.cloneNode(true) as Element;
                  // Remove the tags ul element
                  const tagsUl = cloned.querySelector("ul.p-search-job-media__tags");
                  if (tagsUl) {
                    tagsUl.remove();
                  }
                  // Get the text content without the tags
                  title = cloned.textContent?.trim() || "";
                }
                const url = titleElement
                  ? `https://www.lancers.jp${titleElement.getAttribute("href")}`
                  : "";

                // If jobId not found from onclick, get from URL
                if (!jobId && url) {
                  const urlMatch = url.match(/\/work\/detail\/(\d+)/);
                  if (urlMatch) {
                    jobId = urlMatch[1];
                  }
                }

                // Period (days left) from p-search-job-media__time-remaining
                const daysLeftElement = card.querySelector(".p-search-job-media__time-remaining");
                const daysLeft = daysLeftElement?.textContent?.trim() || "";

                // Price - get two p-search-job-media__number from p-search-job-media__price and join with '~'
                const priceElement = card.querySelector(".p-search-job-media__price");
                let price = "";
                if (priceElement) {
                  const priceNumbers = priceElement.querySelectorAll(".p-search-job-media__number");
                  const numbers = Array.from(priceNumbers)
                    .map(num => num.textContent?.trim())
                    .filter(text => text);
                  if (numbers.length >= 2) {
                    price = `${numbers[0]}~${numbers[1]}`;
                  } else if (numbers.length === 1) {
                    price = numbers[0];
                  }
                }

                // Employer ID from p-search-job-media__avatar-note c-avatar__note
                const employerNoteElement = card.querySelector(".p-search-job-media__avatar-note.c-avatar__note");
                const employerAnchor = employerNoteElement?.querySelector("a");
                const employer = employerAnchor?.textContent?.trim() || "";
                const employerUrl = employerAnchor
                  ? `https://www.lancers.jp${employerAnchor.getAttribute("href")}`
                  : "";

                // Avatar from c-avatar__image
                const employerAvatar = card.querySelector(".c-avatar__image")?.getAttribute("src") || "";

                // Category
                const categoryElements = card.querySelectorAll(".p-search-job__division-link");
                const category = Array.from(categoryElements)
                  .map(cat => cat.textContent?.trim())
                  .filter(text => text)
                  .join(", ");

                // Job status (proposals)
                const proposalsElement = card.querySelector(".p-search-job-media__proposals");
                const proposals = proposalsElement?.textContent?.trim() || "";

                // Job status (募集中, etc.)
                const statusElement = card.querySelector(".p-search-job-media__time-text");
                const status = statusElement?.textContent?.trim() || "";

                // Work type (プロジェクト, etc.)
                const workTypeElement = card.querySelector(".c-badge__text");
                const workType = workTypeElement?.textContent?.trim() || "";

                results.push({
                  id: jobId,
                  title,
                  url,
                  desc: "", // Not extracting description from tags anymore
                  category,
                  price,
                  suggestions: proposals,
                  daysLeft,
                  deadline: status,
                  postedDate: "",
                  employer,
                  employerUrl,
                  employerAvatar,
                  tags: [],
                  workType,
                });
              });

              return results;
            });

            break;
          } catch (err) {
            console.error(
              `⚠️ Error during scrape attempt ${attempt + 1}:`,
              err,
            );
            continue;
          }
        }

        if (jobs.length === 0) {
          console.log("❌ Failed to scrape jobs after multiple attempts.");
        } else {
          console.log(`✅ Scraped ${jobs.length} jobs from page`);
          // Log all job IDs found
          jobs.forEach((job: any) => {
            const jobId = job.id || (job.url ? job.url.split("/").pop() : "unknown");
            console.log(`📋 Job ID: ${jobId} - ${job.title || "No title"}`);
          });
        }

        try {
          // console.log(jobs);
          processScrapedJob(config.ADMIN_ID, jobs.reverse());
        } catch (err) {
          console.error("Error in processScrapedJob:", (err as Error).message);
        }
        await delay(30000);

        // Increment iteration after successful scrape
        iteration++;
      } catch (err) {
        console.error("Error in user scraping loop:", (err as Error).message);
        continue;
      }
    } catch (err) {
      console.error("Error in scrapeJobs loop:", (err as Error).message);
    }
    // No longer close browser/page here; handled by restart logic above
  }
}

export const startScraping = async () => {
  try {
    scraping = true;
    await scrapeJobs();
  } catch (error) {
    console.error(
      "Error occurred while scraping jobs:",
      (error as Error).message,
    );
  }
};

export const stopScraping = () => {
  scraping = false;
};

export const getScrapingStatus = () => {
  return scraping;
};
