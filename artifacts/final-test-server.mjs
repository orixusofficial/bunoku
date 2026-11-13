// Isolated browser test profiles. Only test responses seed storage/mock ads.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve('dist')
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf' }
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:5201')
  const file = path.resolve(root, '.' + url.pathname, url.pathname.endsWith('/') ? 'index.html' : '')
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return }
  let data = fs.readFileSync(file)
  if (file.endsWith('index.html') && url.searchParams.has('profile')) {
    const profile = url.searchParams.get('profile')
    const level = profile === 'unlock' ? 10 : profile === 'ready' || profile === 'errorready' ? 11 : 7
    const mode = url.searchParams.get('ad') || 'success'
    const fixture = `<script>
if(localStorage.getItem('test.profile.v2')!==${JSON.stringify(profile)}){localStorage.setItem('test.profile.v2',${JSON.stringify(profile)});localStorage.removeItem('bunoku.allowances.v1');if(${JSON.stringify(profile)}==='ready'||${JSON.stringify(profile)}==='errorready')localStorage.setItem('bunoku.allowances.v1',JSON.stringify({hintUsed:5,undoUsed:5,hintCredits:0,undoCredits:0,dailyStarted:0,clock:Date.now(),lastRewardId:'',rewardAvailableAt:0}));localStorage.setItem('bunoku.normalLevel','${level}');localStorage.setItem('bunoku.level1TutorialComplete','true')}
const events=[];const game={settings:{muteAudio:false},addSettingsChangeListener(){},removeSettingsChangeListener(){}};for(const key of ['gameplayStart','gameplayStop','loadingStart','loadingStop'])game[key]=()=>events.push(key);
window.CrazyGames={SDK:{environment:'local',init:async()=>{},game,ad:{requestAd(type,cb){events.push('request:'+type);if(${JSON.stringify(mode)}==='error'){setTimeout(()=>cb.adError({code:'adsDisabled'}),100);return}setTimeout(()=>{cb.adStarted();setTimeout(()=>{cb.adFinished();cb.adFinished()},200)},100)}}}};
const NativeAudio=Audio;window.Audio=class extends NativeAudio{constructor(src){super(src);this.hidden=true;document.documentElement.appendChild(this)}};
setInterval(()=>{let report=document.getElementById('test-events');if(!report){report=document.createElement('pre');report.id='test-events';report.hidden=true;document.body.appendChild(report)}report.textContent=JSON.stringify(events)},50)
</script>`
    data = Buffer.from(data.toString().replace(/<script id="crazygames-sdk"[^>]*><\/script>/, fixture))
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(data)
}).listen(5201, '0.0.0.0', () => console.log('Rewards test server http://localhost:5201'))

