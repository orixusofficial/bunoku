// Temporary verification server: root hosting, nested hosting and a cross-origin iframe.
// Only served test HTML is instrumented; production files are never changed.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('dist')
const prefix = '/package/bunoku/'
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
const files = walk(root).map(f => path.relative(root, f).replaceAll('\\', '/'))
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.txt': 'text/plain' }
const telemetry = `<script>
const BaseAudio=window.Audio;window.Audio=class extends BaseAudio{constructor(src){super(src);this.hidden=true;document.documentElement.appendChild(this);for(const event of ['loadedmetadata','play','pause','error'])this.addEventListener(event,()=>parent.postMessage({assetCheck:true,event,src:this.src,volume:this.volume,loop:this.loop,error:this.error?.code},'*'))}};
addEventListener('error',e=>parent.postMessage({assetCheck:true,error:e.message},'*'));
</script>`
const send = (res, body, type = 'text/html') => { res.writeHead(200, { 'Content-Type': type + (type.startsWith('text/') ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' }); res.end(body) }
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:5197')
  if (url.pathname === '/frame.html') return send(res, `<!doctype html><title>Bunoku iframe asset check</title><style>body{margin:0}iframe{width:100%;height:900px;border:0}pre{font:12px monospace}</style><iframe title="Bunoku test frame" src="http://127.0.0.1:5197${prefix}" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-modals"></iframe><pre id="events">Audio events:</pre><script>addEventListener('message',e=>{if(e.data?.assetCheck)document.getElementById('events').textContent+='\\n'+JSON.stringify(e.data)})</script>`)
  if (url.pathname === '/asset-check.html') {
    const base = url.searchParams.get('root') === 'true' ? '/' : prefix
    const images = files.filter(f => f.endsWith('.svg'))
    const audio = files.filter(f => f.endsWith('.mp3'))
    const css = files.find(f => f.endsWith('.css'))
    return send(res, `<!doctype html><title>Bunoku asset decoding check</title><link rel="stylesheet" href="${base}${css}"><style>body{padding:20px}img{width:70px;height:70px;object-fit:contain}li{margin:8px}</style><h1>Asset decoding check</h1><h2>Images</h2>${images.map(f => `<figure><img src="${base}${f}" alt="${f}"><figcaption>${f}</figcaption></figure>`).join('')}<h2>Audio metadata</h2><ul>${audio.map(f => `<li>${f}: <output>loading</output><audio preload="metadata" src="${base}${f}"></audio></li>`).join('')}</ul><h2>Nunito weights</h2>${[400,500,600,700,800].map(w => `<p style="font-weight:${w}">Nunito ${w}: Bunoku Español</p>`).join('')}<p id="font-status">Font loading</p><script>document.querySelectorAll('audio').forEach(a=>{a.addEventListener('loadedmetadata',()=>a.previousElementSibling.textContent='decoded '+a.duration.toFixed(2)+'s');a.addEventListener('error',()=>a.previousElementSibling.textContent='ERROR '+a.error?.code)});document.fonts.ready.then(()=>document.getElementById('font-status').textContent=Array.from(document.fonts).map(f=>f.family+' '+f.weight+' '+f.status).join(';'))</script>`)
  }
  const relative = decodeURIComponent(url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname.slice(1)) || 'index.html'
  const file = path.resolve(root, relative)
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { console.log('404', url.pathname); res.writeHead(404); return res.end('Not found') }
  console.log('200', url.pathname)
  const data = fs.readFileSync(file)
  send(res, relative === 'index.html' ? data.toString().replace('<head>', '<head>' + telemetry) : data, mime[path.extname(file)] || 'application/octet-stream')
}).listen(5197, '127.0.0.1', () => console.log('Asset check server http://localhost:5197'))

