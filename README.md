# orphiusmusic.com

Orphius 的音乐网站。纯静态页面，部署在 Vercel。

- 歌单：`songs.js`（加歌只改这个文件）
- 音频、封面、歌词：Cloudflare R2，`https://media.orphiusmusic.com/orphius/songs/<id>/`
  （audio.m4a / cover.jpg / thumb.jpg / lyrics.json）
- 网站里不放大文件，这样每次部署只有几十 KB。
