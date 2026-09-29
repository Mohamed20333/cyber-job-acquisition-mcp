import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const VERSION = "1.0.0";
const PROFILE_DIR = resolve(process.env.LINKEDIN_PROFILE_DIR || join(homedir(), ".linkedin-profile-agent"));
const HEADLESS = process.env.LINKEDIN_HEADLESS === "true";
const AUTO_CONFIRM = process.env.LINKEDIN_AUTO_CONFIRM === "true";
const LINKEDIN_URL = "https://www.linkedin.com";

let context: BrowserContext | null = null;
let page: Page | null = null;

async function browser(): Promise<{ context: BrowserContext; page: Page }> {
  if (context && page && !page.isClosed()) return { context, page };
  await mkdir(PROFILE_DIR, { recursive: true });
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
    viewport: { width: 1440, height: 1000 },
    locale: "en-US",
    timezoneId: "Africa/Cairo"
  });
  page = context.pages()[0] ?? await context.newPage();
  await page.goto(LINKEDIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  return { context, page };
}

async function requireLogin(page: Page): Promise<void> {
  const url = page.url();
  if (url.includes("/login") || url.includes("/authwall") || url.includes("/checkpoint")) {
    throw new Error("LOGIN_REQUIRED: LinkedIn login is required. Complete login in the opened browser window, then retry.");
  }
}

async function profilePage(page: Page): Promise<void> {
  await page.goto(LINKEDIN_URL + "/in/me/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await requireLogin(page);
  await page.waitForTimeout(1200);
}

async function clickOne(page: Page, names: string[]): Promise<void> {
  for (const name of names) {
    for (const locator of [
      page.getByRole("button", { name, exact: true }).first(),
      page.getByText(name, { exact: true }).first()
    ]) {
      try {
        await locator.waitFor({ state: "visible", timeout: 1800 });
        await locator.click();
        return;
      } catch {}
    }
  }
  throw new Error("LinkedIn control not found: " + names.join(" / "));
}

async function visibleFields(page: Page) {
  const all = page.locator("input, textarea, [contenteditable='true']");
  const result: ReturnType<typeof page.locator>[] = [];
  for (let i = 0; i < await all.count(); i++) {
    if (await all.nth(i).isVisible().catch(() => false)) result.push(all.nth(i));
  }
  return result;
}

async function fillField(page: Page, labels: string[], value: string): Promise<void> {
  for (const label of labels) {
    const el = page.getByLabel(label, { exact: false }).first();
    try {
      await el.waitFor({ state: "visible", timeout: 1800 });
      await el.fill(value);
      return;
    } catch {}
  }
  const fields = await visibleFields(page);
  for (const el of fields) {
    const aria = (await el.getAttribute("aria-label")) ?? "";
    const placeholder = (await el.getAttribute("placeholder")) ?? "";
    const hint = (aria + " " + placeholder).toLowerCase();
    if (labels.some(x => hint.includes(x.toLowerCase()))) {
      await el.fill(value);
      return;
    }
  }
  throw new Error("LinkedIn field not found: " + labels.join(" / "));
}

function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function failure(error: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] };
}

function needsConfirmation(confirmed?: boolean) {
  return !(confirmed === true || AUTO_CONFIRM);
}

function createServer() {
  const server = new McpServer({ name: "linkedin-profile-agent", version: VERSION });

  server.registerTool("linkedin_status", {
    description: "Open the dedicated persistent LinkedIn browser and report whether a login session exists. Never returns credentials or cookies.",
    inputSchema: z.object({})
  }, async () => {
    try {
      const { page } = await browser();
      const url = page.url();
      return result({
        status: url.includes("/login") || url.includes("/authwall") || url.includes("/checkpoint") ? "LOGIN_REQUIRED" : "READY",
        profileDir: PROFILE_DIR,
        browserVisible: !HEADLESS
      });
    } catch (e) { return failure(e); }
  });

  server.registerTool("linkedin_open_profile", {
    description: "Open the authenticated user's LinkedIn profile.",
    inputSchema: z.object({})
  }, async () => {
    try {
      const { page } = await browser();
      await profilePage(page);
      return result({ status: "OPEN", url: page.url() });
    } catch (e) { return failure(e); }
  });

  server.registerTool("linkedin_add_project", {
    description: "Add a project to the user's LinkedIn profile. Uses the local authenticated browser. Write requires confirmed=true unless LINKEDIN_AUTO_CONFIRM=true.",
    inputSchema: z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      url: z.string().url().optional(),
      confirmed: z.boolean().optional()
    })
  }, async ({ name, description, url, confirmed }) => {
    if (needsConfirmation(confirmed)) {
      return result({
        status: "CONFIRMATION_REQUIRED",
        action: "linkedin_add_project",
        proposed: { name, description, url },
        instruction: "Call again with confirmed=true to perform the LinkedIn write."
      });
    }
    try {
      const { page } = await browser();
      await profilePage(page);
      await clickOne(page, ["Add profile section", "Add section"]);
      try { await clickOne(page, ["Additional", "Accomplishments"]); } catch {}
      await clickOne(page, ["Add projects", "Projects"]);
      await fillField(page, ["Project name", "Name", "Project"], name);

      const fields = await visibleFields(page);
      if (fields.length >= 2) await fields[1].fill(description);

      if (url) {
        try { await fillField(page, ["Project URL", "URL", "Website"], url); } catch {}
      }
      await clickOne(page, ["Save"]);
      return result({ status: "COMPLETED", action: "linkedin_add_project", name, url });
    } catch (e) { return failure(e); }
  });

  server.registerTool("linkedin_update_about", {
    description: "Replace the LinkedIn About section. Write requires confirmed=true unless LINKEDIN_AUTO_CONFIRM=true.",
    inputSchema: z.object({
      about: z.string().min(1),
      confirmed: z.boolean().optional()
    })
  }, async ({ about, confirmed }) => {
    if (needsConfirmation(confirmed)) {
      return result({
        status: "CONFIRMATION_REQUIRED",
        action: "linkedin_update_about",
        proposed: { about },
        instruction: "Call again with confirmed=true to perform the LinkedIn write."
      });
    }
    try {
      const { page } = await browser();
      await profilePage(page);
      try {
        await clickOne(page, ["Edit about", "Edit About"]);
      } catch {
        const about = page.locator("section").filter({ hasText: /^About$/ }).first();
        await about.getByRole("button").first().click();
      }
      await fillField(page, ["About", "Summary"], about);
      await clickOne(page, ["Save"]);
      return result({ status: "COMPLETED", action: "linkedin_update_about" });
    } catch (e) { return failure(e); }
  });

  server.registerTool("linkedin_add_skill", {
    description: "Add a skill to LinkedIn. Write requires confirmed=true unless LINKEDIN_AUTO_CONFIRM=true.",
    inputSchema: z.object({
      skill: z.string().min(1),
      confirmed: z.boolean().optional()
    })
  }, async ({ skill, confirmed }) => {
    if (needsConfirmation(confirmed)) {
      return result({
        status: "CONFIRMATION_REQUIRED",
        action: "linkedin_add_skill",
        proposed: { skill },
        instruction: "Call again with confirmed=true to perform the LinkedIn write."
      });
    }
    try {
      const { page } = await browser();
      await profilePage(page);
      await clickOne(page, ["Add profile section", "Add section"]);
      try { await clickOne(page, ["Core"]); } catch {}
      await clickOne(page, ["Add skills", "Skills"]);
      await fillField(page, ["Skill", "Skills"], skill);
      await page.waitForTimeout(700);
      try { await clickOne(page, [skill, "Add skill"]); } catch {}
      try { await clickOne(page, ["Save"]); } catch {}
      return result({ status: "COMPLETED", action: "linkedin_add_skill", skill });
    } catch (e) { return failure(e); }
  });

  return server;
}

process.on("SIGINT", async () => { await context?.close(); process.exit(0); });
process.on("SIGTERM", async () => { await context?.close(); process.exit(0); });

serveStdio(createServer);
