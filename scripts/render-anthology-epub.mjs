#!/usr/bin/env node
/*
 * Renders an anthology EPUB combining multiple stories into a single book.
 *
 * The visible structure is:
 *
 *   Cover (optional)
 *   Anthology title page
 *   Master Table of Contents -- one entry per story, linking to that
 *     story's title page (the "beginning" of each short story)
 *   For each story:
 *     Story title page (visible separator: title + summary)
 *     One XHTML page per chapter of that story
 *   "Until next time" back matter (shared across all stories)
 *
 * Chapter files are prefixed with the story id (e.g.
 * `s14-chapter-01.xhtml`) so two stories can both have a "chapter 1"
 * without colliding inside the EPUB.
 *
 * The EPUB 3 nav doc and the EPUB 2 NCX both mirror the visible TOC --
 * one top-level entry per story plus the cover, title page, master TOC,
 * and back matter. (Per-chapter sub-navigation isn't included so the
 * Kindle TOC stays clean and readable; if a future use case wants
 * per-chapter skip-back, that's a small change to buildNcx / buildNavPage.)
 *
 * Usage:
 *   node scripts/render-anthology-epub.mjs <storyId> [storyId ...] \
 *     [--title="My Anthology"] \
 *     [--summary="Short blurb for the title page"] \
 *     [--cover=path/to/cover.jpg] \
 *     [--out=path/to/output.epub]
 *
 * Example:
 *   node scripts/render-anthology-epub.mjs 14 16 18 \
 *     --title="The Ballbusting Arena: The Complete Series"
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  loadStories,
  findStory,
  readStoryMarkdown,
  slugify,
  escapeHtml,
  splitMarkdownByChapter,
  END_PAGE,
  DEFAULT_OUT_DIR,
} from "./lib/story-render.mjs";
import {
  AUTHOR,
  CONTAINER_XML,
  buildAboutPage,
  buildChapterPage,
  buildCoverPage,
  buildStylesheet,
  coverFromAbsolutePath,
  deterministicUuid,
  findStoryCover,
  nowIsoSecond,
  xhtmlPage,
} from "./lib/epub-shared.mjs";
import { buildZip } from "./lib/zip.mjs";

/* ---------- CLI ---------- */

function parseArgs(argv) {
  const out = {
    ids: [],
    title: null,
    summary: null,
    cover: null,
    output: null,
  };
  for (const arg of argv) {
    if (arg.startsWith("--title=")) {
      out.title = arg.slice("--title=".length);
    } else if (arg.startsWith("--summary=")) {
      out.summary = arg.slice("--summary=".length);
    } else if (arg.startsWith("--cover=")) {
      out.cover = arg.slice("--cover=".length);
    } else if (arg.startsWith("--out=")) {
      out.output = arg.slice("--out=".length);
    } else if (/^\d+$/.test(arg)) {
      out.ids.push(Number(arg));
    } else if (!arg.startsWith("--")) {
      const n = Number(arg);
      if (!Number.isNaN(n)) out.ids.push(n);
    }
  }
  return out;
}

function dedupePreservingOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function defaultAnthologyTitle(stories) {
  if (stories.length <= 3) {
    return stories.map((s) => s.title || `Story ${s.id}`).join(" / ");
  }
  return `Anthology (${stories.length} stories)`;
}

/* ---------- File naming ---------- */

function storyKey(storyId) {
  return `s${String(storyId).padStart(3, "0")}`;
}

function storyTitleFilename(storyId) {
  return `${storyKey(storyId)}-title.xhtml`;
}

function chapterFilename(storyId, chapterIndex) {
  const cnum = String(chapterIndex + 1).padStart(2, "0");
  return `${storyKey(storyId)}-chapter-${cnum}.xhtml`;
}

function chapterId(storyId, chapterIndex) {
  return `${storyKey(storyId)}-ch${String(chapterIndex + 1).padStart(2, "0")}`;
}

function storyTitleId(storyId) {
  return `${storyKey(storyId)}-title`;
}

/* ---------- Pages ---------- */

function buildAnthologyTitlePage({ title, summary }) {
  const safeTitle = escapeHtml(title);
  const safeSummary = summary ? escapeHtml(summary) : "";
  const author = escapeHtml(AUTHOR);
  return xhtmlPage({
    title,
    bodyClass: "titlepage",
    body:
      `  <section epub:type="titlepage" class="titlepage">\n` +
      `    <h1 class="title-main">${safeTitle}</h1>\n` +
      (safeSummary ? `    <p class="title-summary">${safeSummary}</p>\n` : "") +
      `    <p class="title-byline">${author}</p>\n` +
      `  </section>`,
  });
}

function buildStoryTitlePage(story, position) {
  const safeTitle = escapeHtml(story.title || `Story ${story.id}`);
  const safeSummary = story.summary ? escapeHtml(story.summary) : "";
  const eyebrow = `Story ${position.index + 1} of ${position.total}`;
  return xhtmlPage({
    title: story.title || `Story ${story.id}`,
    bodyClass: "story-separator",
    body:
      `  <section epub:type="halftitlepage" class="story-separator-page">\n` +
      `    <p class="story-eyebrow">${escapeHtml(eyebrow)}</p>\n` +
      `    <h1 class="story-title">${safeTitle}</h1>\n` +
      (safeSummary
        ? `    <p class="story-summary">${safeSummary}</p>\n`
        : "") +
      `    <hr class="story-flourish" />\n` +
      `  </section>`,
  });
}

function buildAnthologyNavPage({ anthologyTitle, entries, hasCover }) {
  // entries: [{ story, href }] -- one per story, in spine order.
  const items = entries
    .map((e, i) => {
      const num = i + 1;
      const safeTitle = escapeHtml(e.story.title || `Story ${e.story.id}`);
      const summary = e.story.summary
        ? `\n        <span class="toc-summary">${escapeHtml(e.story.summary)}</span>`
        : "";
      return (
        `      <li><a href="${e.href}">` +
        `<span class="toc-num">${num}.</span> ` +
        `<span class="toc-name">${safeTitle}</span>` +
        `</a>${summary}</li>`
      );
    })
    .join("\n");

  const titleHref = "anthology-title.xhtml";
  const coverHref = hasCover ? "cover.xhtml" : null;

  const landmarks = [
    coverHref
      ? `      <li><a epub:type="cover" href="${coverHref}">Cover</a></li>`
      : null,
    `      <li><a epub:type="titlepage" href="${titleHref}">Title page</a></li>`,
    `      <li><a epub:type="toc" href="nav.xhtml">Table of contents</a></li>`,
    entries.length
      ? `      <li><a epub:type="bodymatter" href="${entries[0].href}">Begin reading</a></li>`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body =
    `  <section class="contents-page">\n` +
    `    <p class="toc-eyebrow">Contents</p>\n` +
    `    <h1 class="toc-title">${escapeHtml(anthologyTitle)}</h1>\n` +
    `    <hr class="toc-flourish" />\n` +
    `    <nav epub:type="toc" id="toc">\n` +
    `      <h2 class="toc-h2">Table of Contents</h2>\n` +
    `      <ol class="toc-list">\n${items}\n      </ol>\n` +
    `    </nav>\n` +
    `    <nav epub:type="landmarks" id="landmarks" class="hidden">\n` +
    `      <h2>Guide</h2>\n` +
    `      <ol>\n${landmarks}\n      </ol>\n` +
    `    </nav>\n` +
    `  </section>`;

  return xhtmlPage({
    title: "Contents",
    bodyClass: "nav",
    body,
  });
}

/* ---------- OPF / NCX ---------- */

function buildOpf({ anthologyTitle, anthologySummary, stories, cover, modified, uuid }) {
  const safeTitle = escapeHtml(anthologyTitle);
  const safeSummary = anthologySummary ? escapeHtml(anthologySummary) : "";

  const manifestItems = [];
  const spineItems = [];

  manifestItems.push(
    `    <item id="nav" href="text/nav.xhtml" media-type="application/xhtml+xml" properties="nav" />`,
  );
  manifestItems.push(
    `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />`,
  );
  manifestItems.push(
    `    <item id="css" href="styles.css" media-type="text/css" />`,
  );

  if (cover) {
    manifestItems.push(
      `    <item id="cover-image" href="${escapeHtml(cover.name)}" media-type="${escapeHtml(cover.mime)}" properties="cover-image" />`,
    );
    manifestItems.push(
      `    <item id="cover-page" href="text/cover.xhtml" media-type="application/xhtml+xml" />`,
    );
    spineItems.push(`    <itemref idref="cover-page" linear="yes" />`);
  }

  manifestItems.push(
    `    <item id="anthology-title" href="text/anthology-title.xhtml" media-type="application/xhtml+xml" />`,
  );
  spineItems.push(`    <itemref idref="anthology-title" linear="yes" />`);
  spineItems.push(`    <itemref idref="nav" linear="yes" />`);

  for (const entry of stories) {
    const { story, chapters } = entry;
    const titleId = storyTitleId(story.id);
    manifestItems.push(
      `    <item id="${titleId}" href="text/${storyTitleFilename(story.id)}" media-type="application/xhtml+xml" />`,
    );
    spineItems.push(`    <itemref idref="${titleId}" linear="yes" />`);
    for (const ch of chapters) {
      const id = chapterId(story.id, ch.index);
      manifestItems.push(
        `    <item id="${id}" href="text/${chapterFilename(story.id, ch.index)}" media-type="application/xhtml+xml" />`,
      );
      spineItems.push(`    <itemref idref="${id}" linear="yes" />`);
    }
  }

  manifestItems.push(
    `    <item id="about" href="text/about.xhtml" media-type="application/xhtml+xml" />`,
  );
  spineItems.push(`    <itemref idref="about" linear="yes" />`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator id="creator">${escapeHtml(AUTHOR)}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
    <meta refines="#creator" property="file-as">${escapeHtml(AUTHOR)}</meta>
    ${safeSummary ? `<dc:description>${safeSummary}</dc:description>` : ""}
    <meta property="dcterms:modified">${modified}</meta>${
    cover ? `\n    <meta name="cover" content="cover-image" />` : ""
  }
  </metadata>
  <manifest>
${manifestItems.join("\n")}
  </manifest>
  <spine toc="ncx">
${spineItems.join("\n")}
  </spine>
</package>
`;
}

function buildNcx({ anthologyTitle, stories, cover, uuid }) {
  const navPoints = [];
  let order = 1;

  if (cover) {
    navPoints.push(
      `    <navPoint id="navp-cover" playOrder="${order++}">\n` +
        `      <navLabel><text>Cover</text></navLabel>\n` +
        `      <content src="text/cover.xhtml" />\n` +
        `    </navPoint>`,
    );
  }
  navPoints.push(
    `    <navPoint id="navp-title" playOrder="${order++}">\n` +
      `      <navLabel><text>Title page</text></navLabel>\n` +
      `      <content src="text/anthology-title.xhtml" />\n` +
      `    </navPoint>`,
  );
  navPoints.push(
    `    <navPoint id="navp-toc" playOrder="${order++}">\n` +
      `      <navLabel><text>Contents</text></navLabel>\n` +
      `      <content src="text/nav.xhtml" />\n` +
      `    </navPoint>`,
  );
  for (const entry of stories) {
    const { story } = entry;
    const safeTitle = escapeHtml(story.title || `Story ${story.id}`);
    navPoints.push(
      `    <navPoint id="navp-${storyKey(story.id)}" playOrder="${order++}">\n` +
        `      <navLabel><text>${safeTitle}</text></navLabel>\n` +
        `      <content src="text/${storyTitleFilename(story.id)}" />\n` +
        `    </navPoint>`,
    );
  }
  navPoints.push(
    `    <navPoint id="navp-about" playOrder="${order++}">\n` +
      `      <navLabel><text>${escapeHtml(END_PAGE.title)}</text></navLabel>\n` +
      `      <content src="text/about.xhtml" />\n` +
      `    </navPoint>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}" />
    <meta name="dtb:depth" content="1" />
    <meta name="dtb:totalPageCount" content="0" />
    <meta name="dtb:maxPageNumber" content="0" />
  </head>
  <docTitle><text>${escapeHtml(anthologyTitle)}</text></docTitle>
  <docAuthor><text>${escapeHtml(AUTHOR)}</text></docAuthor>
  <navMap>
${navPoints.join("\n")}
  </navMap>
</ncx>
`;
}

/* ---------- main ---------- */

function loadAnthologyStories(allStories, requestedIds) {
  const stories = [];
  for (const id of requestedIds) {
    const story = findStory(allStories, id);
    if (!story) {
      console.error(`No story with id ${id} in data/stories.js`);
      process.exit(1);
    }
    let markdown;
    try {
      markdown = readStoryMarkdown(story.id);
    } catch (e) {
      console.error(
        `Could not read story ${story.id} markdown: ${e.message}`,
      );
      console.error(`Run \`npm run sync -- --only=${story.id}\` first.`);
      process.exit(1);
    }
    const chapters = splitMarkdownByChapter(markdown);
    if (!chapters.length) {
      console.error(`Story ${story.id} has no content; skipping.`);
      continue;
    }
    stories.push({ story, chapters });
  }
  return stories;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ids.length) {
    console.error(
      "Usage: node scripts/render-anthology-epub.mjs <storyId> [storyId ...] " +
        "[--title=...] [--summary=...] [--cover=path] [--out=path.epub]",
    );
    process.exit(1);
  }

  const orderedIds = dedupePreservingOrder(args.ids);
  const allStories = loadStories();
  const stories = loadAnthologyStories(allStories, orderedIds);
  if (!stories.length) {
    console.error("No usable stories; aborting.");
    process.exit(1);
  }

  const anthologyTitle =
    args.title || defaultAnthologyTitle(stories.map((e) => e.story));
  const anthologySummary = args.summary || null;

  const cover = args.cover ? coverFromAbsolutePath(resolve(args.cover)) : null;
  if (args.cover && !cover) {
    console.error(
      `Cover not found or unsupported format: ${args.cover}. Continuing without cover.`,
    );
  }

  const uuid = deterministicUuid(
    `anthology|${orderedIds.join(",")}|${anthologyTitle}`,
  );
  const modified = nowIsoSecond();

  const navEntries = stories.map((e) => ({
    story: e.story,
    href: storyTitleFilename(e.story.id),
  }));

  const files = [
    { name: "mimetype", data: "application/epub+zip", store: true },
    { name: "META-INF/container.xml", data: CONTAINER_XML },
    {
      name: "OEBPS/package.opf",
      data: buildOpf({
        anthologyTitle,
        anthologySummary,
        stories,
        cover,
        modified,
        uuid,
      }),
    },
    {
      name: "OEBPS/toc.ncx",
      data: buildNcx({ anthologyTitle, stories, cover, uuid }),
    },
    { name: "OEBPS/styles.css", data: buildStylesheet() },
    {
      name: "OEBPS/text/anthology-title.xhtml",
      data: buildAnthologyTitlePage({
        title: anthologyTitle,
        summary: anthologySummary,
      }),
    },
    {
      name: "OEBPS/text/nav.xhtml",
      data: buildAnthologyNavPage({
        anthologyTitle,
        entries: navEntries,
        hasCover: !!cover,
      }),
    },
    {
      name: "OEBPS/text/about.xhtml",
      data: buildAboutPage(),
    },
  ];

  if (cover) {
    files.push({ name: `OEBPS/${cover.name}`, data: readFileSync(cover.src) });
    files.push({
      name: "OEBPS/text/cover.xhtml",
      data: buildCoverPage(cover),
    });
  }

  stories.forEach((entry, i) => {
    const { story, chapters } = entry;
    files.push({
      name: `OEBPS/text/${storyTitleFilename(story.id)}`,
      data: buildStoryTitlePage(story, { index: i, total: stories.length }),
    });
    for (const ch of chapters) {
      files.push({
        name: `OEBPS/text/${chapterFilename(story.id, ch.index)}`,
        data: buildChapterPage({
          title: ch.title,
          num: ch.index + 1,
          total: chapters.length,
          blocks: ch.blocks,
        }),
      });
    }
  });

  const outPath = args.output
    ? resolve(args.output)
    : join(DEFAULT_OUT_DIR, `${slugify(anthologyTitle)}.epub`);
  mkdirSync(dirname(outPath), { recursive: true });

  const zip = buildZip(files);
  writeFileSync(outPath, zip);
  const totalChapters = stories.reduce((sum, e) => sum + e.chapters.length, 0);
  console.log(
    `Wrote ${outPath} (${(zip.length / 1024).toFixed(1)} KB, ${stories.length} stories, ${totalChapters} chapters${cover ? ", with cover" : ""})`,
  );
}

main();
