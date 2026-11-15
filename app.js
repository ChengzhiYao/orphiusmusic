(() => {
  const MEDIA = "https://media.orphiusmusic.com/orphius/songs";
  // newest first; a song without a date counts as the newest
  const key = s => (/^\d{4}\.\d{2}\.\d{2}$/.test(s.date) ? s.date : s.date ? s.date.slice(0, 4) + ".09.30" : "9999") + s.id;
  const SONGS = [...window.SONGS].sort((a, b) => key(b).localeCompare(key(a)));
  const byId = Object.fromEntries(SONGS.map(s => [s.id, s]));
  const $ = s => document.querySelector(s);
  const file = (s, f) => `${MEDIA}/${s.id}/${f}${s.rev ? "?r=" + s.rev : ""}`;
  const page = s => `/songs/${s.id}`;
  const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" d="M7 4v16l13-8z"/><path class="i-pause" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  const setAccent = c => document.documentElement.style.setProperty("--accent", c);

  // ── Audio ──────────────────────────────────────
  const audio = new Audio();
  audio.crossOrigin = "anonymous";   // needed to read loudness for the background scenes
  audio.preload = "metadata";
  let current = null;

  // ── Background scene: the song's own page runs behind the homepage ──
  // The scene reads time / loudness / bass from window.__bgState every frame.
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bgFrame = $("#bgScene");
  let analyser = null, freq = null, lowpass = null;
  function initAudioGraph() {
    if (analyser) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaElementSource(audio);
      lowpass = ac.createBiquadFilter(); lowpass.type = "lowpass"; lowpass.frequency.value = 22000; lowpass.Q.value = .7;
      analyser = ac.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .82;
      src.connect(lowpass); lowpass.connect(analyser); analyser.connect(ac.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      window.__ac = ac;
      window.__lowpass = f => lowpass.frequency.setTargetAtTime(Math.max(200, Math.min(22000, f)), ac.currentTime, .25);
      audio.addEventListener("play", () => ac.state === "suspended" && ac.resume());
    } catch (e) { analyser = null; }
  }
  window.__bgState = { id: null, t: 0, playing: false, level: 0, bass: 0 };
  (function feed() {
    const s = window.__bgState;
    s.id = current && current.id; s.t = audio.currentTime; s.playing = !audio.paused;
    if (analyser && !audio.paused) {
      analyser.getByteFrequencyData(freq);
      let sum = 0; for (let i = 2; i < 40; i++) sum += freq[i];
      s.level = Math.min(1, Math.max(0, (sum / 38 / 255 - .25) * 1.8));
      let b = 0; for (let i = 1; i < 6; i++) b += freq[i];
      s.bass = b / 5 / 255;
    } else { s.level = audio.paused ? 0 : .35; s.bass = 0; }
    requestAnimationFrame(feed);
  })();
  function showScene(song) {
    if (reduceMotion || !bgFrame) return;
    document.body.classList.add("has-scene");
    bgFrame.classList.remove("on");
    bgFrame.onload = () => { bgFrame.classList.add("on"); placeSceneCover(); };
    bgFrame.src = `/songs/${song.id}/?bg=1`;
  }
  // While the lyrics panel is open, the scene's animated cover sits exactly where the panel's cover is.
  function placeSceneCover() {
    let d = null;
    try { d = bgFrame && bgFrame.contentDocument; } catch (e) { d = null; }
    const open = !$("#sheet").hidden;
    document.body.classList.toggle("scene-cover", !!(d && open && bgFrame.classList.contains("on")));
    if (!d || !d.documentElement) return;
    d.documentElement.classList.toggle("show-cover", open);
    if (open) {
      const r = $("#sCover").getBoundingClientRect(), st = d.documentElement.style;
      st.setProperty("--cx", r.left + "px"); st.setProperty("--cy", r.top + "px"); st.setProperty("--cw", r.width + "px");
    }
  }
  addEventListener("resize", () => placeSceneCover());

  function load(song) {
    if (current === song) return;
    current = song;
    initAudioGraph();
    if (lowpass) lowpass.frequency.value = 22000;   // a previous scene may have muffled the sound
    audio.src = file(song, "audio.m4a");
    showScene(song);
    setAccent(song.accent);
    $("#player").hidden = false;
    document.body.classList.add("has-player");
    setBar();
    $("#pImg").src = `${MEDIA}/${song.id}/card.jpg?c=3`;
    $("#pArt").href = $("#pTitle").href = page(song);
    $("#pTitle").textContent = song.title;
    $("#pSub").textContent = song.sub;
    $("#pDur").textContent = fmt(song.dur);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title, artist: "Orphius", album: song.sub,
        artwork: [{ src: file(song, "cover.jpg"), sizes: "1024x1024", type: "image/jpeg" }]
      });
    }
    refresh();
  }
  const setBar = () => document.documentElement.style.setProperty("--bar-h", $("#player").offsetHeight + "px");
  addEventListener("resize", () => current && setBar());
  const play = song => { load(song); audio.play().catch(() => {}); };
  function toggle(song) {
    if (song && song !== current) return play(song);
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }
  const step = d => { const i = SONGS.indexOf(current); play(SONGS[(i + d + SONGS.length) % SONGS.length]); };
  $("#pNext").onclick = () => step(1);
  $("#pPrev").onclick = () => (audio.currentTime > 4 ? (audio.currentTime = 0) : step(-1));
  $("#pToggle").onclick = () => toggle();
  audio.addEventListener("ended", () => step(1));
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
    navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
  }

  const seek = $("#pSeek");
  let seeking = false;
  seek.addEventListener("input", () => { seeking = true; $("#pCur").textContent = fmt(seek.value / 1000 * (audio.duration || current.dur)); });
  seek.addEventListener("change", () => { audio.currentTime = seek.value / 1000 * (audio.duration || current.dur); seeking = false; });
  audio.addEventListener("timeupdate", () => {
    if (seeking) return;
    const d = audio.duration || current.dur;
    seek.value = d ? audio.currentTime / d * 1000 : 0;
    $("#pCur").textContent = fmt(audio.currentTime);
  });
  ["play", "pause"].forEach(ev => audio.addEventListener(ev, refresh));

  // ── Featured song ──────────────────────────────
  const feat = byId[window.FEATURED] || SONGS[0];
  $("#fImg").src = `${MEDIA}/${feat.id}/card.jpg?c=3`;
  $("#fImg").alt = `Cover of ${feat.title}`;
  $("#fLink").href = $("#fOpen").href = page(feat);
  $("#fTitle").textContent = feat.title;
  $("#fSub").textContent = feat.sub;
  $("#fMeta").innerHTML = `${feat.date ? `<span>${esc(feat.date)}</span>` : ""}<span>${fmt(feat.dur)}</span>`;
  $("#fPlay").onclick = () => { toggle(feat); if (!audio.paused || current === feat) openSheet(); };
  if (feat.yt) { $("#fYt").href = `https://www.youtube.com/watch?v=${feat.yt}`; $("#fYt").hidden = false; }
  setAccent(feat.accent);

  // ── All songs ──────────────────────────────────
  const grid = $("#grid");
  grid.innerHTML = SONGS.map(s => `
    <li class="card" data-id="${s.id}" style="--c:${s.accent}">
      <button class="card-btn" type="button" aria-label="Play ${esc(s.title)} and show lyrics">
        <span class="card-art"><img src="${MEDIA}/${s.id}/card.jpg?c=3" alt="" loading="lazy" width="320" height="320"><span class="card-play" aria-hidden="true">${ICON}</span></span>
        <span class="card-title">${esc(s.title)}</span>
        <span class="card-sub">${esc(s.sub || "")}</span>
        <span class="card-meta">${s.date ? `<span>${esc(s.date)}</span>` : ""}<span>${fmt(s.dur)}</span></span>
      </button>
    </li>`).join("");
  grid.addEventListener("click", e => {
    const c = e.target.closest(".card"); if (!c) return;
    const s = byId[c.dataset.id];
    if (s === current) { toggle(); openSheet(); } else { play(s); openSheet(); }
  });
  $("#songCount").textContent = `${SONGS.length} songs`;

  function refresh() {
    const on = !audio.paused;
    $("#player").classList.toggle("is-playing", on);
    $("#pToggle").setAttribute("aria-label", on ? "Pause" : "Play");
    grid.querySelectorAll(".card").forEach(c => {
      const me = current && c.dataset.id === current.id;
      c.classList.toggle("is-current", !!me);
      c.classList.toggle("is-playing", !!me && on);
      c.querySelector(".card-btn").setAttribute("aria-label", `${me && on ? "Pause" : "Play"} ${byId[c.dataset.id].title} and show lyrics`);
    });
    const fOn = current === feat && on;
    $("#fPlay").classList.toggle("is-playing", fOn);
    $("#fPlay").textContent = fOn ? "Pause" : "Play";
  }

  // ── Now playing: synced lyrics ─────────────────
  const sheet = $("#sheet"), box = $("#sLyrics");
  let lines = [], lineEls = [], shown = null, lastLine = -1, opener = null;
  function openSheet() {
    if (!current) return;
    if (sheet.hidden) opener = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add("sheet-open");
    $("#pLyrics").setAttribute("aria-expanded", "true");
    $("#pLyrics").textContent = "Hide lyrics";
    fillSheet(current);
    requestAnimationFrame(placeSceneCover);
    $("#sClose").focus({ preventScroll: true });
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.classList.remove("sheet-open");
    $("#pLyrics").setAttribute("aria-expanded", "false");
    $("#pLyrics").textContent = "Lyrics";
    placeSceneCover();
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }
  $("#sClose").onclick = closeSheet;
  $("#pLyrics").onclick = () => (sheet.hidden ? openSheet() : closeSheet());
  addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });

  async function fillSheet(song) {
    if (shown === song) return;
    shown = song; lastLine = -1;
    $("#sBg").src = $("#sCover").src = `${MEDIA}/${song.id}/card.jpg?c=3`;
    $("#sTitle").textContent = song.title;
    $("#sSub").textContent = song.sub;
    $("#sOpen").href = page(song);
    $("#sYt").hidden = !song.yt;
    if (song.yt) $("#sYt").href = `https://www.youtube.com/watch?v=${song.yt}`;
    box.innerHTML = ""; lines = []; lineEls = [];
    if (song.lyrics !== false) {
      try { const r = await fetch(`${MEDIA}/${song.id}/lyrics.json?l=2${song.rev ? "&r=" + song.rev : ""}`); lines = r.ok ? await r.json() : []; } catch { lines = []; }
    }
    if (shown !== song) return;
    if (!lines.length) { box.innerHTML = '<p class="none">This song has no lyrics yet.</p>'; return; }
    box.innerHTML = lines.map((l, k) => `<p class="line" data-k="${k}"><span class="o">${l.w.map(([c, t]) => `<span class="ch" data-t="${t}">${esc(c)}</span>`).join("")}</span><span class="t" ${SUB.attrs(l)}></span></p>`).join("");
    SUB.apply(box);
    lineEls = [...box.querySelectorAll(".line")];
    box.scrollTop = 0;
  }
  box.addEventListener("click", e => {
    const p = e.target.closest(".line"); if (!p || shown !== current) return;
    audio.currentTime = lines[p.dataset.k].t; audio.play().catch(() => {});
  });
  // when the song changes while the panel is open, follow it
  audio.addEventListener("loadstart", () => { if (!sheet.hidden && current) fillSheet(current); });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  (function tick() {
    requestAnimationFrame(tick);
    if (sheet.hidden || !lineEls.length || shown !== current) return;
    const t = audio.currentTime;
    let k = -1;
    for (let i = 0; i < lines.length; i++) if (t >= lines[i].t) k = i; else break;
    if (k !== lastLine) {
      if (lastLine >= 0 && lineEls[lastLine]) { lineEls[lastLine].classList.remove("on"); lineEls[lastLine].querySelectorAll(".lit").forEach(c => c.classList.remove("lit")); }
      lastLine = k;
      if (k >= 0) {
        const el = lineEls[k]; el.classList.add("on");
        box.scrollTo({ top: el.offsetTop - box.clientHeight * 0.38, behavior: reduce ? "auto" : "smooth" });
      }
    }
    if (k >= 0) lineEls[k].querySelectorAll(".ch:not(.lit)").forEach(c => { if (t >= +c.dataset.t) c.classList.add("lit"); });
  })();

  $("#yr").textContent = new Date().getFullYear();
})();
