const $ = (sel, root = document) => root.querySelector(sel);

async function loadHealth() {
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    const el = $("#health");
    const bits = [];
    if (!j.openai) bits.push("OpenAI key missing");
    if (!j.googleCredentialsOk) bits.push("Google credentials missing");
    if (!j.googleTokenSaved) bits.push("Google not connected");
    el.textContent = bits.length ? bits.join(" · ") : "Ready";
    el.classList.toggle("bad", bits.length > 0);
  } catch {
    $("#health").textContent = "Server unreachable";
    $("#health").classList.add("bad");
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderStories(stories) {
  const ul = $("#story-list");
  ul.innerHTML = "";
  for (const s of stories) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "story-btn";
    btn.dataset.rowIndex = String(s.rowIndex);
    const title = document.createElement("span");
    title.textContent = s.title;
    btn.appendChild(title);
    const meta = document.createElement("span");
    meta.className = "story-meta";
    if (s.driveUrl) {
      const a = document.createElement("a");
      a.href = s.driveUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Published doc";
      meta.appendChild(a);
      meta.appendChild(document.createTextNode(` · id ${s.id}`));
    } else {
      meta.textContent = `No driveUrl · id ${s.id}`;
    }
    btn.appendChild(meta);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

let activeRow = null;

async function openStory(rowIndex) {
  activeRow = rowIndex;
  document.querySelectorAll(".story-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.rowIndex === String(rowIndex));
  });

  const detail = $("#detail");
  detail.hidden = false;
  $("#chapters").innerHTML = '<p class="loading">Loading outline…</p>';
  $("#detail-title").textContent = "";
  $("#detail-links").innerHTML = "";

  const r = await fetch(`/api/story/${rowIndex}/outline`);
  const j = await r.json();
  if (!r.ok) {
    $("#chapters").innerHTML = `<p class="status-line err">${esc(j.error || r.status)}</p>`;
    return;
  }

  $("#detail-title").textContent = j.title;
  const links = $("#detail-links");
  links.innerHTML = "";
  if (j.driveUrl) {
    const pub = document.createElement("a");
    pub.href = j.driveUrl;
    pub.target = "_blank";
    pub.rel = "noopener noreferrer";
    pub.textContent = "Published (raw)";
    links.appendChild(pub);
  }
  if (j.driveDocId) {
    if (links.childNodes.length) links.appendChild(document.createTextNode(" · "));
    const ed = document.createElement("a");
    ed.href = `https://docs.google.com/document/d/${j.driveDocId}/edit`;
    ed.target = "_blank";
    ed.rel = "noopener noreferrer";
    ed.textContent = "Editable doc";
    links.appendChild(ed);
  } else {
    if (links.childNodes.length) links.appendChild(document.createTextNode(" · "));
    links.appendChild(
      document.createTextNode("No drive_doc_id — check dist/drive_doc_ids.json"),
    );
  }

  const wrap = $("#chapters");
  wrap.innerHTML = "";
  if (!j.chapters?.length) {
    wrap.innerHTML = '<p class="empty">No chapters found.</p>';
    return;
  }

  for (const ch of j.chapters) {
    const det = document.createElement("details");
    det.className = "chapter";
    det.dataset.chapterIndex = String(ch.index);

    const sum = document.createElement("summary");
    sum.textContent = `${ch.title} (${ch.wordCount} words)`;
    det.appendChild(sum);

    const body = document.createElement("div");
    body.className = "chapter-body";

    const wait = document.createElement("p");
    wait.className = "loading";
    wait.textContent = "Open this section to analyze.";
    body.appendChild(wait);

    det.appendChild(body);

    det.addEventListener("toggle", async () => {
      if (!det.open || det.dataset.loaded === "1") return;
      wait.textContent = "Analyzing…";
      try {
        const ar = await fetch(
          `/api/story/${rowIndex}/chapter/${ch.index}/analyze`,
          { method: "POST" },
        );
        const aj = await ar.json();
        if (!ar.ok) throw new Error(aj.error || ar.status);
        det.dataset.loaded = "1";
        body.innerHTML = "";
        if (!aj.issues?.length) {
          body.innerHTML = '<p class="empty">No issues reported.</p>';
          return;
        }
        for (const issue of aj.issues) {
          body.appendChild(renderIssue(rowIndex, ch.index, issue));
        }
        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "btn primary";
        submit.textContent = "Submit accepted fixes to Google Doc";
        submit.dataset.rowIndex = String(rowIndex);
        submit.dataset.chapterIndex = String(ch.index);
        submit.addEventListener("click", () => submitChapter(rowIndex, ch.index, submit));
        body.appendChild(submit);
        const status = document.createElement("p");
        status.className = "status-line";
        status.hidden = true;
        status.dataset.role = "submit-status";
        body.appendChild(status);
      } catch (e) {
        wait.textContent = "";
        wait.className = "status-line err";
        wait.textContent = String(e.message);
      }
    });

    wrap.appendChild(det);
  }
}

function renderIssue(rowIndex, chapterIndex, issue) {
  const wrap = document.createElement("div");
  wrap.className = "issue" + (issue.warning ? " warn" : "");

  if (issue.reason) {
    const r = document.createElement("div");
    r.className = "issue-reason";
    r.textContent = issue.reason;
    wrap.appendChild(r);
  }
  if (issue.warning) {
    const w = document.createElement("div");
    w.className = "issue-reason";
    w.textContent = issue.warning;
    wrap.appendChild(w);
  }

  const diff = document.createElement("div");
  diff.className = "diff";

  const before = document.createElement("div");
  before.className = "before";
  before.innerHTML = `<label>Before</label><pre>${esc(issue.before)}</pre>`;

  const after = document.createElement("div");
  after.className = "after";
  after.innerHTML = `<label>After</label><pre>${esc(issue.after)}</pre>`;

  diff.appendChild(before);
  diff.appendChild(after);
  wrap.appendChild(diff);

  const name = `decision-${rowIndex}-${chapterIndex}-${issue.id}`;
  const radios = document.createElement("div");
  radios.className = "radio-row";

  const rejLbl = document.createElement("label");
  const rej = document.createElement("input");
  rej.type = "radio";
  rej.name = name;
  rej.value = "reject";
  rej.checked = true;
  rejLbl.appendChild(rej);
  rejLbl.appendChild(document.createTextNode(" Reject"));

  const accLbl = document.createElement("label");
  const acc = document.createElement("input");
  acc.type = "radio";
  acc.name = name;
  acc.value = "accept";
  accLbl.appendChild(acc);
  accLbl.appendChild(document.createTextNode(" Accept"));

  radios.appendChild(rejLbl);
  radios.appendChild(accLbl);
  wrap.appendChild(radios);

  return wrap;
}

async function submitChapter(rowIndex, chapterIndex, btn) {
  const chapterBody = btn.closest(".chapter-body");
  const issues = [];
  for (const box of chapterBody.querySelectorAll(".issue")) {
    const radios = box.querySelectorAll('input[type="radio"]');
    const picked = [...radios].find((r) => r.checked);
    if (!picked || picked.value !== "accept") continue;
    const pres = box.querySelectorAll(".diff pre");
    const before = pres[0]?.textContent ?? "";
    const after = pres[1]?.textContent ?? "";
    issues.push({ before, after });
  }

  const status = chapterBody.querySelector('[data-role="submit-status"]');
  status.hidden = false;
  status.classList.remove("err");
  btn.disabled = true;

  try {
    const r = await fetch(`/api/story/${rowIndex}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edits: issues }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    status.textContent = `Applied ${j.replacements} replacement(s). Refresh the Google Doc to verify.`;
  } catch (e) {
    status.classList.add("err");
    status.textContent = String(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function init() {
  await loadHealth();
  const r = await fetch("/api/stories");
  const j = await r.json();
  if (!r.ok) {
    $("#story-list").innerHTML = `<li class="status-line err">${esc(j.error)}</li>`;
    return;
  }
  renderStories(j.stories);

  $("#story-list").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".story-btn");
    if (!btn) return;
    openStory(Number(btn.dataset.rowIndex));
  });
}

init();
