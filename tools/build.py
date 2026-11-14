#!/usr/bin/env python3
"""
生成每首歌的静态页面 songs/<id>/index.html，以及 sitemap.xml / robots.txt。

页面里直接写好歌名、完整歌词和翻译、分享预览（封面图），
这样 Google 能搜到歌词，链接发到社交软件也会显示封面。

用法（在仓库根目录）：
    python3 tools/build.py
改了 songs.js、scene/songs.js 或者歌词之后，重新跑一遍再推送。
"""
import html, json, os, re, subprocess, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.orphiusmusic.com"
MEDIA = "https://media.orphiusmusic.com/orphius/songs"
CHANNEL = "https://www.youtube.com/@Orphius1"
UA = {"User-Agent": "Mozilla/5.0 (orphiusmusic build)"}


def load_js(path, var="SONGS"):
    """Read window.SONGS out of a songs.js file using node."""
    code = f"""
global.window={{Image:function(){{}},Audio:function(){{}}}};global.document={{createElement:()=>({{}})}};
require({json.dumps(path)});console.log(JSON.stringify({{songs:window.{var},featured:window.FEATURED||null}}));"""
    return json.loads(subprocess.run(["node", "-e", code], capture_output=True, text=True, check=True).stdout)


def lyrics(song_id):
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{MEDIA}/{song_id}/lyrics.json", headers=UA), timeout=30) as r:
            return json.load(r)
    except Exception:
        return []


def lang_of(text):
    if re.search(r"[぀-ヿ]", text): return "ja"
    if re.search(r"[一-鿿]", text): return "zh"
    return "en"


def iso_dur(sec):
    return f"PT{sec // 60}M{sec % 60}S"


def iso_date(d):
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})$", d or "")
    return f"{m[1]}-{m[2]}-{m[3]}" if m else None


def main():
    home = {s["id"]: s for s in load_js(os.path.join(ROOT, "songs.js"))["songs"]}
    scene = load_js(os.path.join(ROOT, "scene", "songs.js"))["songs"]
    tpl = open(os.path.join(ROOT, "tools", "song-template.html"), encoding="utf-8").read()
    urls = [(SITE + "/", None)]

    for s in scene:
        sid, h = s["id"], home.get(s["id"], {})
        title, sub = s["title"], s.get("subtitle", "")
        rev = f"?r={s['rev']}" if s.get("rev") else ""
        cover = f"{MEDIA}/{sid}/cover.jpg{rev}"
        url = f"{SITE}/songs/{sid}"
        lines = lyrics(sid)
        orig = ["".join(c for c, *_ in l["w"]).strip() for l in lines]
        first = " / ".join(o for o in orig[:2] if o)

        desc = f"{title}{'（' + sub + '）' if sub else ''} by Orphius."
        desc += f" Full lyrics with translation: {first}…" if first else " Listen with visuals."
        page_title = f"{title} – Orphius" + (" | Lyrics" if lines else "")

        if lines:
            def subs(l):
                out = ""
                for key, code in (("en", "en"), ("tr", "zh"), ("ja", "ja")):
                    if l.get(key):
                        out += f'<span class="t" data-l="{code}" lang="{code}">{html.escape(l[key])}</span>'
                return out
            body = "\n".join(
                f'      <p><span class="o" lang="{lang_of(o)}">{html.escape(o)}</span>{subs(l)}</p>'
                for o, l in zip(orig, lines) if o)
        else:
            body = '      <p class="none">Lyrics for this song are coming soon.</p>'

        yt = h.get("yt")
        links = f'<a class="lnk" href="https://www.youtube.com/watch?v={yt}" target="_blank" rel="noopener">Watch on YouTube</a>' if yt else \
                f'<a class="lnk" href="{CHANNEL}" target="_blank" rel="noopener">Orphius on YouTube</a>'

        ld = {
            "@context": "https://schema.org", "@type": "MusicRecording", "name": title,
            "alternateName": sub or None, "url": url, "image": cover,
            "byArtist": {"@type": "MusicGroup", "name": "Orphius", "url": SITE + "/"},
            "duration": iso_dur(h["dur"]) if h.get("dur") else None,
            "datePublished": iso_date(s.get("date")),
            "inLanguage": lang_of(" ".join(orig) or title),
        }
        if yt: ld["sameAs"] = f"https://www.youtube.com/watch?v={yt}"
        if lines: ld["recordingOf"] = {"@type": "MusicComposition", "name": title, "lyrics": {"@type": "CreativeWork", "text": "\n".join(orig)}}
        ld = {k: v for k, v in ld.items() if v}

        head = f"""<title>{html.escape(page_title)}</title>
<meta name="description" content="{html.escape(desc, quote=True)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="Orphius">
<meta property="og:title" content="{html.escape(title + ' – Orphius', quote=True)}">
<meta property="og:description" content="{html.escape((sub + '. ' if sub else '') + (first or 'Listen with lyrics and visuals.'), quote=True)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{cover}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>"""

        out = (tpl.replace("{{HEAD}}", head)
                  .replace("{{ID}}", sid)
                  .replace("{{TITLE}}", html.escape(title))
                  .replace("{{LYRICS}}", body)
                  .replace("{{LINKS}}", links))
        d = os.path.join(ROOT, "songs", sid)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(out)
        urls.append((url, iso_date(s.get("date"))))
        print(sid, "lyrics" if lines else "no lyrics", "yt" if yt else "")

    today = datetime.date.today().isoformat()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, d in urls:
        sm.append(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>")
    sm.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w").write("\n".join(sm) + "\n")
    open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")


if __name__ == "__main__":
    main()
