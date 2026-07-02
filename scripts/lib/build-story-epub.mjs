/*
 * Build a single-story EPUB from an in-memory markdown string.
 * Shared by render-story-epub.mjs and Andrea & Lucas publish bundles.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { splitMarkdownByChapter, escapeHtml, END_PAGE } from "./story-render.mjs";
import {
  AUTHOR,
  CONTAINER_XML,
  buildAboutPage,
  buildChapterPage,
  buildCoverPage,
  buildStylesheet,
  collectReferencedSceneImages,
  deterministicUuid,
  findStoryCover,
  nowIsoSecond,
  xhtmlPage,
} from "./epub-shared.mjs";
import { buildZip } from "./zip.mjs";

function chapterFilename(chapter) {
  const num = String(chapter.index + 1).padStart(2, "0");
  return `chapter-${num}.xhtml`;
}

function buildTitlePage(story) {
  const title = escapeHtml(story.title);
  const summary = story.summary ? escapeHtml(story.summary) : "";
  const author = escapeHtml(AUTHOR);
  return xhtmlPage({
    title: story.title,
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
  const title = escapeHtml(story.title);
  const items = chapters
    .map((ch, i) => {
      const num = i + 1;
      const href = chapterFilename(ch);
      const label = ch.title || story.title;
      return `      <li><a href="${href}"><span class="toc-num">${num}.</span> <span class="toc-name">${escapeHtml(
        label,
      )}</span></a></li>`;
    })
    .join("\n");

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

function buildOpf({ story, chapters, cover, sceneImages, modified }) {
  const uuid = deterministicUuid(`story-${story.id}`);
  const title = escapeHtml(story.title);
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

  for (const img of sceneImages) {
    manifestItems.push(
      `    <item id="${escapeHtml(img.manifestId)}" href="${escapeHtml(img.internalPath)}" media-type="${escapeHtml(img.mime)}" />`,
    );
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
  const title = escapeHtml(story.title);

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
    const label = ch.title || story.title;
    navPoints.push(
      `    <navPoint id="navp-ch${ch.index + 1}" playOrder="${order++}">\n` +
        `      <navLabel><text>${escapeHtml(label)}</text></navLabel>\n` +
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

/**
 * @param {object} opts
 * @param {object} opts.story — metadata (id, title, scenes, summary, cover, …)
 * @param {string} opts.markdown
 * @param {string} opts.outPath
 * @param {boolean} [opts.noCover=false]
 * @param {boolean} [opts.noImages=false]
 */
export function writeStoryEpub({
  story,
  markdown,
  outPath,
  noCover = false,
  noImages = false,
}) {
  const chapters = splitMarkdownByChapter(markdown);
  if (!chapters.length) {
    throw new Error("markdown has no chapter content");
  }

  const cover = noCover ? null : findStoryCover(story);
  const modified = nowIsoSecond();
  const imageMode = noImages ? "strip" : "embed";
  let sceneImages = [];
  const sceneImageMap = new Map();
  if (imageMode === "embed") {
    const allBlocks = chapters.flatMap((ch) => ch.blocks);
    sceneImages = collectReferencedSceneImages(story, allBlocks);
    for (const img of sceneImages) sceneImageMap.set(img.index, img);
  }

  const files = [
    { name: "mimetype", data: "application/epub+zip", store: true },
    { name: "META-INF/container.xml", data: CONTAINER_XML },
    {
      name: "OEBPS/package.opf",
      data: buildOpf({ story, chapters, cover, sceneImages, modified }),
    },
    {
      name: "OEBPS/toc.ncx",
      data: buildNcx({ story, chapters, cover }),
    },
    { name: "OEBPS/styles.css", data: buildStylesheet() },
    { name: "OEBPS/text/titlepage.xhtml", data: buildTitlePage(story) },
    {
      name: "OEBPS/text/nav.xhtml",
      data: buildNavPage({ story, chapters, hasCover: !!cover }),
    },
    { name: "OEBPS/text/about.xhtml", data: buildAboutPage() },
  ];

  if (cover) {
    files.push({ name: `OEBPS/${cover.name}`, data: readFileSync(cover.src) });
    files.push({
      name: "OEBPS/text/cover.xhtml",
      data: buildCoverPage(cover),
    });
  }

  for (const img of sceneImages) {
    files.push({ name: `OEBPS/${img.internalPath}`, data: img.data });
  }

  for (const ch of chapters) {
    files.push({
      name: `OEBPS/text/${chapterFilename(ch)}`,
      data: buildChapterPage({
        title: ch.title,
        num: ch.index + 1,
        total: chapters.length,
        blocks: ch.blocks,
        story,
        imageMode,
        sceneImageMap,
      }),
    });
  }

  const resolvedOut = resolve(outPath);
  mkdirSync(dirname(resolvedOut), { recursive: true });
  const zip = buildZip(files);
  writeFileSync(resolvedOut, zip);

  const imageNote = sceneImages.length
    ? `, ${sceneImages.length} inline scene${sceneImages.length === 1 ? "" : "s"}`
    : imageMode === "strip"
      ? ", text-only"
      : "";
  console.log(
    `[epub] wrote ${resolvedOut} (${(zip.length / 1024).toFixed(1)} KB, ${chapters.length} chapters${cover ? ", with cover" : ""}${imageNote})`,
  );
  return resolvedOut;
}
