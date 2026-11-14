# orphiusmusic.com

Orphius 的音乐网站。纯静态页面，部署在 Vercel。

- 歌单：`songs.js`（加歌只改这个文件）
- 音频、封面、歌词：Cloudflare R2，`https://media.orphiusmusic.com/orphius/songs/<id>/`
  （audio.m4a / cover.jpg / thumb.jpg / lyrics.json）
- 网站里不放大文件，这样每次部署只有几十 KB。

## 歌曲页 /songs/<id>
- `songs/<id>/index.html` 是生成的静态页面（歌名、完整歌词、分享预览都写在页面里，方便 Google 收录）
- 模板：`tools/song-template.html`；特效和播放器：`scene/`（scene.js / player.js / style.css / three.min.js）
- `scene/songs.js`：特效用的歌曲数据（不含私人的信和照片）；首页用的是根目录的 `songs.js`
- 改了歌单或歌词后运行 `python3 tools/build.py`，会重新生成所有歌曲页、sitemap.xml、robots.txt
