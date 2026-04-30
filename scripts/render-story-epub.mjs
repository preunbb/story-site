#!/usr/bin/env node
/*
 * Renders a single story to an EPUB (EPUB 3, with EPUB 2 NCX fallback for
 * Kindle / KDP). Mirrors the structure and back-matter of the PDF generator
 * (TOC up front, one chapter per "page", "Until next time" closing page),
 * but produces ebook-native output suitable for KDP / Kindle Direct
 * Publishing's reflowable ebook pipeline:
 *
 *   - One XHTML file per chapter so e-readers get clean chapter navigation.
 *   - EPUB 3 nav doc + EPUB 2 toc.ncx (Kindle still consults the NCX).
 *   - Cover image embedded with cover-image properties.
 *   - No background colors / fixed sizes so the user's dark/light/font
 *     preferences continue to work on-device.
 *
 * Usage:
 *   node scripts/render-story-epub.mjs [storyId] [--out=path.epub]
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { dirname, join, resolve, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import {
  loadStories,
  findStory,
  readStoryMarkdown,
  slugify,
  escapeHtml,
  splitMarkdownByChapter,
  renderBodyBlocks,
  END_PAGE,
  DEFAULT_OUT_DIR,
  COVERS_DIR,
  repoRoot,
} from "./lib/story-render.mjs";
import { buildZip } from "./lib/zip.mjs";

const READER_OPTS = {
  linkClass: "story-link",
  dividerClass: "scene-break",
};

const AUTHOR = "Preun";
const NS_UUID = "urn:uuid:9b9b1d60-7c1c-5a6a-9d0a-preun-story-site";

function parseArgs(argv) {
  const out = { id: 1, output: null };
  for (const arg of argv) {
    if (arg.startsWith("--out=")) {
      out.output = arg.slice("--out=".length);
    } else if (/^\d+$/.test(arg)) {
      out.id = Number(arg);
    } else if (!arg.startsWith("--")) {
      const n = Number(arg);
      if (!Number.isNaN(n)) out.id = n;
    }
  }
  return out;
}

/* ---------- IDs ---------- */

// Deterministic UUID v5 derived from the story id so re-generating produces
// the same identifier (KDP treats the dc:identifier as the book's identity).
function deterministicUuid(name) {
  const hash = createHash("sha1").update(NS_UUID + "|" + name).digest("hex");
  const v = (parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80;
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    v.toString(16).padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
}

function nowIsoSecond() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/* ---------- Cover detection ---------- */

function findCover(story) {
  // Story.cover is something like "assets/covers/three_strikes.jpg"
  if (!story.cover) return null;
  const candidate = join(repoRoot, story.cover);
  if (!existsSync(candidate)) return null;
  const ext = extname(candidate).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
      ? "image/webp"
      : ext === ".gif"
      ? "image/gif"
      : null;
  if (!mime) return null;
  return {
    src: candidate,
    name: "cover" + ext,
    mime,
  };
}

/* ---------- XHTML helpers ---------- */

const XHTML_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" type="text/css" href="../styles.css" />
`;

function xhtmlPage({ title, bodyClass, body, extraHead }) {
  return (
    XHTML_HEAD +
    `  <title>${escapeHtml(title)}</title>\n` +
    (extraHead || "") +
    "</head>\n" +
    `<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ""}>\n` +
    body +
    "\n</body>\n</html>\n"
  );
}

/* ---------- Content pages ---------- */

function buildCoverPage(cover) {
  if (!cover) return null;
  return xhtmlPage({
    title: "Cover",
    bodyClass: "cover",
    body:
      `  <section epub:type="cover" class="cover-page">\n` +
      `    <img src="../${escapeHtml(cover.name)}" alt="Cover" />\n` +
      `  </section>`,
  });
}

function buildTitlePage(story) {
  const title = escapeHtml(story.title || "Story");
  const summary = story.summary ? escapeHtml(story.summary) : "";
  const author = escapeHtml(AUTHOR);
  return xhtmlPage({
    title: story.title || "Story",
    bodyClass: "titlepage",
    body:
      `  <section epub:type="titlepage" class="titlepage">\n` +
      `    <h1 class="title-main">${title}</h1>\n` +
      (summary ? `    <p class="title-summary">${summary}</p>\n` : "") +
      `    <p class="title-byline">${author}</p>\n` +
      `  </section>`,
  });
}

function buildNavPage({ story, chapters, hasCover }) {
  const title = escapeHtml(story.title || "Story");
  const items = chapters
    .map((ch, i) => {
      const num = i + 1;
      const href = chapterFilename(ch);
      return `      <li><a href="${href}"><span class="toc-num">${num}.</span> <span class="toc-name">${escapeHtml(
        ch.title,
      )}</span></a></li>`;
    })
    .join("\n");

  // The EPUB navigation document. By marking it `epub:type="toc"` AND
  // including it in the spine we get a single source of truth that's both
  // the machine-readable nav AND a visible Contents page when the reader
  // pages forward through the book.
  const aboutHref = "about.xhtml";
  const titleHref = "titlepage.xhtml";
  const coverHref = hasCover ? "cover.xhtml" : null;

  const landmarks = [
    coverHref
      ? `      <li><a epub:type="cover" href="${coverHref}">Cover</a></li>`
      : null,
    `      <li><a epub:type="titlepage" href="${titleHref}">Title page</a></li>`,
    `      <li><a epub:type="toc" href="nav.xhtml">Table of contents</a></li>`,
    chapters.length
      ? `      <li><a epub:type="bodymatter" href="${chapterFilename(chapters[0])}">Begin reading</a></li>`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body =
    `  <section class="contents-page">\n` +
    `    <p class="toc-eyebrow">Contents</p>\n` +
    `    <h1 class="toc-title">${title}</h1>\n` +
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

function buildChapterPage(chapter, totalChapters) {
  const title = chapter.title || `Chapter ${chapter.index + 1}`;
  const num = chapter.index + 1;
  const bodyHtml = renderBodyBlocks(chapter.blocks, READER_OPTS);
  return xhtmlPage({
    title,
    bodyClass: "chapter",
    body:
      `  <section epub:type="chapter" class="chapter">\n` +
      `    <header class="chapter-header">\n` +
      `      <p class="chapter-eyebrow">Chapter ${num} of ${totalChapters}</p>\n` +
      `      <h1 class="chapter-title">${escapeHtml(title)}</h1>\n` +
      `    </header>\n` +
      `    <div class="chapter-body">\n` +
      bodyHtml +
      `\n    </div>\n` +
      `  </section>`,
  });
}

function buildAboutPage() {
  const paras = END_PAGE.paragraphs
    .map((p) => `    <p class="end-message">${escapeHtml(p)}</p>`)
    .join("\n");
  const contacts = END_PAGE.contacts
    .map(
      (c) =>
        `      <li><span class="end-contact-label">${escapeHtml(c.label)}</span> ` +
        `<a href="${escapeHtml(c.href)}" class="story-link">${escapeHtml(c.text)}</a></li>`,
    )
    .join("\n");
  const body =
    `  <section epub:type="afterword" class="end-page">\n` +
    `    <hr class="end-flourish" />\n` +
    `    <h1 class="end-title">${escapeHtml(END_PAGE.title)}</h1>\n` +
    paras +
    `\n    <ul class="end-contacts">\n${contacts}\n    </ul>\n` +
    `    <p class="end-signoff">${escapeHtml(END_PAGE.signoff)}</p>\n` +
    `  </section>`;
  return xhtmlPage({
    title: END_PAGE.title,
    bodyClass: "about",
    body,
  });
}

/* ---------- Stylesheet ---------- */

// Deliberately conservative for ebook readers. No backgrounds, em-based
// sizing, no fixed widths -- so dark mode, font scaling, and reflow on
// arbitrary screen sizes (Kindle / phone / Kobo / etc.) all keep working.
function buildStylesheet() {
  return `@charset "utf-8";

body {
  margin: 0;
  padding: 0;
  font-family: serif;
  line-height: 1.55;
  font-size: 1em;
}

/* Cover */
body.cover { margin: 0; padding: 0; }
.cover-page {
  margin: 0;
  padding: 0;
  text-align: center;
  page-break-after: always;
}
.cover-page img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

/* Title page */
.titlepage {
  text-align: center;
  page-break-after: always;
  margin-top: 25%;
}
.titlepage .title-main {
  font-size: 2.2em;
  font-weight: bold;
  margin: 0 0 1em;
  line-height: 1.2;
}
.titlepage .title-summary {
  font-style: italic;
  font-size: 1.05em;
  margin: 0 1em 2em;
  line-height: 1.45;
}
.titlepage .title-byline {
  font-size: 1.1em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}

/* Contents */
.contents-page { page-break-after: always; }
.contents-page .toc-eyebrow {
  font-size: 0.8em;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-align: center;
  margin: 1em 0 0.4em;
}
.contents-page .toc-title {
  font-size: 1.7em;
  font-weight: bold;
  text-align: center;
  margin: 0 0 1em;
  line-height: 1.2;
}
.contents-page .toc-flourish {
  border: 0;
  height: 0;
  text-align: center;
  margin: 0 25% 1.5em;
  border-top: 1px solid currentColor;
  opacity: 0.35;
}
.contents-page .toc-h2 {
  font-size: 0;
  height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.contents-page .toc-list {
  list-style: none;
  margin: 0;
  padding: 0 1em;
}
.contents-page .toc-list li { margin: 0.5em 0; }
.contents-page .toc-list a {
  text-decoration: none;
  color: inherit;
}
.contents-page .toc-num {
  display: inline-block;
  min-width: 2em;
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}
.hidden { display: none; }

/* Chapter pages */
.chapter { page-break-before: always; }
.chapter-header {
  text-align: center;
  margin: 1.5em 0 1.5em;
}
.chapter-eyebrow {
  font-size: 0.7em;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin: 0 0 0.6em;
  opacity: 0.7;
}
.chapter-title {
  font-size: 1.6em;
  font-weight: bold;
  margin: 0;
  line-height: 1.25;
}
.chapter-body { margin: 0; }
.chapter-body p {
  margin: 0;
  text-indent: 1.2em;
  orphans: 2;
  widows: 2;
}
.chapter-body p + p { margin-top: 0.4em; }
.chapter-body .chapter-header + p,
.chapter-body p:first-child,
.chapter-body hr + p { text-indent: 0; }

.chapter-body em { font-style: italic; }
.chapter-body strong { font-weight: bold; }
.chapter-body .story-link {
  color: inherit;
  text-decoration: underline;
}

/* Scene break */
.scene-break {
  border: 0;
  height: 0;
  text-align: center;
  margin: 1.4em 0;
}
.scene-break::after {
  content: "* * *";
  letter-spacing: 0.5em;
  display: block;
  opacity: 0.55;
}

/* About / end page */
.end-page {
  page-break-before: always;
  text-align: center;
  margin-top: 2em;
}
.end-page .end-flourish {
  border: 0;
  height: 0;
  border-top: 1px solid currentColor;
  opacity: 0.35;
  margin: 0 30% 1.5em;
}
.end-page .end-title {
  font-size: 1.6em;
  font-weight: bold;
  margin: 0 0 1.2em;
}
.end-page .end-message {
  text-align: left;
  margin: 0 1em 0.8em;
  line-height: 1.55;
}
.end-page .end-contacts {
  list-style: none;
  margin: 1.6em auto 1em;
  padding: 0;
  display: inline-block;
  text-align: left;
  line-height: 1.9;
}
.end-page .end-contact-label {
  display: inline-block;
  min-width: 4.5em;
  opacity: 0.7;
}
.end-page .end-contacts a {
  color: inherit;
  text-decoration: underline;
}
.end-page .end-signoff {
  font-style: italic;
  margin: 1.5em 0 0;
  opacity: 0.7;
}
`;
}

/* ---------- Manifest / OPF / NCX ---------- */

function chapterFilename(chapter) {
  const num = String(chapter.index + 1).padStart(2, "0");
  return `chapter-${num}.xhtml`;
}

function buildOpf({ story, chapters, cover, modified }) {
  const uuid = deterministicUuid(`story-${story.id}`);
  const title = escapeHtml(story.title || "Story");
  const summary = story.summary ? escapeHtml(story.summary) : "";

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
    `    <item id="titlepage" href="text/titlepage.xhtml" media-type="application/xhtml+xml" />`,
  );
  spineItems.push(`    <itemref idref="titlepage" linear="yes" />`);
  spineItems.push(`    <itemref idref="nav" linear="yes" />`);

  for (const ch of chapters) {
    const id = `ch${String(ch.index + 1).padStart(2, "0")}`;
    manifestItems.push(
      `    <item id="${id}" href="text/${chapterFilename(ch)}" media-type="application/xhtml+xml" />`,
    );
    spineItems.push(`    <itemref idref="${id}" linear="yes" />`);
  }

  manifestItems.push(
    `    <item id="about" href="text/about.xhtml" media-type="application/xhtml+xml" />`,
  );
  spineItems.push(`    <itemref idref="about" linear="yes" />`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator id="creator">${escapeHtml(AUTHOR)}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
    <meta refines="#creator" property="file-as">${escapeHtml(AUTHOR)}</meta>
    ${summary ? `<dc:description>${summary}</dc:description>` : ""}
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

function buildNcx({ story, chapters, cover }) {
  const uuid = deterministicUuid(`story-${story.id}`);
  const title = escapeHtml(story.title || "Story");

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
      `      <content src="text/titlepage.xhtml" />\n` +
      `    </navPoint>`,
  );
  navPoints.push(
    `    <navPoint id="navp-toc" playOrder="${order++}">\n` +
      `      <navLabel><text>Contents</text></navLabel>\n` +
      `      <content src="text/nav.xhtml" />\n` +
      `    </navPoint>`,
  );
  for (const ch of chapters) {
    navPoints.push(
      `    <navPoint id="navp-ch${ch.index + 1}" playOrder="${order++}">\n` +
        `      <navLabel><text>${escapeHtml(ch.title)}</text></navLabel>\n` +
        `      <content src="text/${chapterFilename(ch)}" />\n` +
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
  <docTitle><text>${title}</text></docTitle>
  <docAuthor><text>${escapeHtml(AUTHOR)}</text></docAuthor>
  <navMap>
${navPoints.join("\n")}
  </navMap>
</ncx>
`;
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

/* ---------- main ---------- */

function main() {
  const args = parseArgs(process.argv.slice(2));
  const stories = loadStories();
  const story = findStory(stories, args.id);
  if (!story) {
    console.error(`No story with id ${args.id} in data/stories.js`);
    process.exit(1);
  }

  let markdown;
  try {
    markdown = readStoryMarkdown(story.id);
  } catch (e) {
    console.error(`Could not read story ${story.id} markdown: ${e.message}`);
    console.error(`Run \`npm run sync -- --only=${story.id}\` first.`);
    process.exit(1);
  }

  const chapters = splitMarkdownByChapter(markdown);
  if (!chapters.length) {
    console.error(`Story ${story.id} has no content.`);
    process.exit(1);
  }
  const cover = findCover(story);
  const modified = nowIsoSecond();

  const files = [
    // mimetype must be first and stored uncompressed.
    { name: "mimetype", data: "application/epub+zip", store: true },
    { name: "META-INF/container.xml", data: CONTAINER_XML },
    {
      name: "OEBPS/package.opf",
      data: buildOpf({ story, chapters, cover, modified }),
    },
    {
      name: "OEBPS/toc.ncx",
      data: buildNcx({ story, chapters, cover }),
    },
    { name: "OEBPS/styles.css", data: buildStylesheet() },
    {
      name: "OEBPS/text/titlepage.xhtml",
      data: buildTitlePage(story),
    },
    {
      name: "OEBPS/text/nav.xhtml",
      data: buildNavPage({ story, chapters, hasCover: !!cover }),
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

  for (const ch of chapters) {
    files.push({
      name: `OEBPS/text/${chapterFilename(ch)}`,
      data: buildChapterPage(ch, chapters.length),
    });
  }

  const outPath = args.output
    ? resolve(args.output)
    : join(DEFAULT_OUT_DIR, `${slugify(story.title)}.epub`);
  mkdirSync(dirname(outPath), { recursive: true });

  const zip = buildZip(files);
  writeFileSync(outPath, zip);
  console.log(
    `Wrote ${outPath} (${(zip.length / 1024).toFixed(1)} KB, ${chapters.length} chapters${cover ? ", with cover" : ""})`,
  );
}

main();
