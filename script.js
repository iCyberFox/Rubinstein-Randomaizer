/* ===== ВСТАВ СВІЙ YOUTUBE DATA API KEY ТУТ (можна лишити пустим — тоді аватарки не тягнемо) ===== */
const API_KEY = "AIzaSyCCAIKjBehofzLk1TwH0-RBsaxOiCJdo60";

/* ===== Стан ===== */
let allParticipants = [];   // [{number, name, handle, url, avatar}]
let selectedWinners = [];
const avatarCache = new Map(); // handle/id -> avatarURL

/* ===== Аудіо: клік на кожному «тіку» ===== */
let audioCtx = null;
function playClick(){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = 900 + Math.random()*120;
    o.connect(g); g.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.35, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    o.start(now);
    o.stop(now + 0.055);
  }catch(e){ /* ігноруємо */ }
}

/* ===== Утиліти ===== */
const esc = s => String(s).replace(/[&<>"']/g, m => 
({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function normalizeHandle(str){
  if(!str) return "";
  let h = str.trim();
  if(!h.startsWith('@')) h = '@' + h;
  return h.replace(/\s+/g,'');
}
function extractHandleFromUrl(url){
  try{
    const u = new URL(url);
    if(u.pathname.startsWith('/@')){
      const h = u.pathname.split(/[/?#]/)[1]; // '@name'
      return normalizeHandle(h);
    }
    return "";
  }catch(_){ return ""; }
}
function extractChannelIdFromUrl(url){
  try{
    const u = new URL(url);
    if(u.pathname.startsWith('/channel/')){
      return u.pathname.split('/channel/')[1].split(/[/?#]/)[0];
    }
    return "";
  }catch(_){ return ""; }
}
function makeChannelUrl({handle, url}){
  if(url && /^https?:\/\//i.test(url)) return url;
  if(handle) return `https://www.youtube.com/${handle}`;
  return "#";
}

/* ===== Завантаження Excel ===== */
document.getElementById('fileInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (ev) {
    try{
      const data = new Uint8Array(ev.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellStyles: true });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if(!sheet || !sheet['!ref']) { alert('Порожній аркуш.'); return; }

      const range = XLSX.utils.decode_range(sheet['!ref']);
      const seen = new Map(); // ключ — handleLower або nameLower

      for (let R = range.s.r; R <= range.e.r; R++) {
        const a = sheet[XLSX.utils.encode_cell({r:R, c:0})]; // A — Number
        const b = sheet[XLSX.utils.encode_cell({r:R, c:1})]; // B — @name (може мати гіперпосилання)

        if(!b || !b.v) continue;

        const rawName = String(b.v).trim();
        // пропускаємо очевидні заголовки
        const isHeader = /^name$/i.test(rawName) || /^number$/i.test(String(a?.v||"")) || /^@?нік/i.test(rawName);
        if(isHeader && R === range.s.r) continue;

        const numberRaw = a && a.v != null ? String(a.v).trim() : "";
        const number = numberRaw !== "" ? numberRaw : "";

        // гіперпосилання
        const linkFromHyper = (b.l && b.l.Target) ? String(b.l.Target) : "";

        // handle або id
        let handle = rawName.startsWith('@') ? normalizeHandle(rawName) : "";
        if(!handle && linkFromHyper) handle = extractHandleFromUrl(linkFromHyper);

        const channelId = extractChannelIdFromUrl(linkFromHyper);

        const name = handle || rawName; // показуємо @handle, якщо є
        const url = makeChannelUrl({handle, url:linkFromHyper});

        // ключ для де-дуплікації
        const key = (handle || channelId || name).toLowerCase();
        if(!seen.has(key) && name){
          seen.set(key, { number, name, handle, url, channelId, avatar:null });
        }
      }

      allParticipants = Array.from(seen.values());
      selectedWinners = [];
      document.getElementById('winnersList').innerHTML = "";
      alert(`Знайдено ${allParticipants.length} унікальних учасників`);
    }catch(err){
      console.error(err);
      alert('Помилка читання файлу. Перевір, що перший стовпець — Number, другий — @нікнейм (з гіперпосиланням).');
    }
  };
  reader.readAsArrayBuffer(file);
});

/* ===== Завантаження аватарки з YouTube API (кеш) ===== */
async function fetchAvatar(part){
  const cacheKey = part.handle || part.channelId || part.url;
  if(avatarCache.has(cacheKey)) return avatarCache.get(cacheKey);

  if(!API_KEY){ return null; }

  try{
    let apiUrl = "";
    if(part.handle){
      const q = encodeURIComponent(part.handle);
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${q}&key=${API_KEY}`;
    }else if(part.channelId){
      const q = encodeURIComponent(part.channelId);
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${q}&key=${API_KEY}`;
    }else{
      // fallback: якщо є хоч якась URL-інфа — краще не звертатися до API
      return null;
    }

    const res = await fetch(apiUrl);
    if(!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    const thumb = item?.snippet?.thumbnails;
    const best = thumb?.high?.url || thumb?.medium?.url || thumb?.default?.url || null;

    if(best){ avatarCache.set(cacheKey, best); }
    return best || null;
  }catch(_){ return null; }
}

/* ===== UI елементи модалки ===== */
const modal       = document.getElementById('winnerModal');
const modalClose  = document.getElementById('modalClose');
const rollScreen  = document.getElementById('rollScreen');
const finalScreen = document.getElementById('finalScreen');
const rollAvatar  = document.getElementById('rollAvatar');
const rollNameEl  = document.getElementById('rollName');
const winnerAvatar= document.getElementById('winnerAvatar');
const winnerLink  = document.getElementById('winnerLink');
const winnerMeta  = document.getElementById('winnerMeta');
const loadingIndicator = document.getElementById('loadingIndicator');

modal.addEventListener('click', (e)=> { if(e.target === modal) closeModal(); });
modalClose.addEventListener('click', closeModal);
function openModal(){
  rollScreen.classList.remove('hidden');
  finalScreen.classList.add('hidden');
  rollAvatar.src = "";
  rollNameEl.textContent = "";
  modal.style.display = 'block';
  modal.setAttribute('aria-hidden','false');
}
function closeModal(){
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden','true');
}

/* ===== Попереднє завантаження аватарок ===== */
async function preloadAvatars(participants) {
  loadingIndicator.style.display = 'block';
  document.getElementById('pickOne').disabled = true;
  
  try {
    const promises = participants.map(async (participant) => {
      const cacheKey = participant.handle || participant.channelId || participant.url;
      if (!avatarCache.has(cacheKey)) {
        const avatar = await fetchAvatar(participant);
        if (avatar) {
          avatarCache.set(cacheKey, avatar);
        }
      }
    });
    await Promise.all(promises);
  } finally {
    loadingIndicator.style.display = 'none';
    document.getElementById('pickOne').disabled = false;
  }
}

/* ===== Кнопки ===== */
document.getElementById('pickOne').addEventListener('click', async () => {
  const limit = parseInt(document.getElementById('winnerCount').value || "1", 10);
  if (selectedWinners.length >= limit) {
    alert('Досягнуто максимальну кількість переможців.');
    return;
  }
  const remaining = allParticipants.filter(p =>
    !selectedWinners.some(w => (w.handle||w.channelId||w.name).toLowerCase() === (p.handle||p.channelId||p.name).toLowerCase())
  );
  if (remaining.length === 0) {
    alert('Більше немає доступних учасників.');
    return;
  }
  
  // Попередньо завантажуємо аватарки перед початком ролу
  await preloadAvatars(remaining);
  await rollAndPickInModal(remaining, 3000); // 3 секунди
});

document.getElementById('saveBtn').addEventListener('click', () => {
  if (selectedWinners.length === 0) { alert('Немає переможців для збереження.'); return; }
  const text = selectedWinners.map(w => {
    const num = (w.number !== "" && w.number != null) ? `#${w.number}: ` : "";
    return `${num}${w.name} ${makeChannelUrl(w)}`;
  }).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'winners.txt';
  a.click();
  URL.revokeObjectURL(url);
});

/* ===== Анімація прокрутки в модальному вікні + вибір ===== */
async function rollAndPickInModal(pool, durationMs){
  openModal();

  let elapsed = 0;
  let delay = 60;           // стартова затримка
  const accel = 1.12;       // коеф. уповільнення (збільшення інтервалу)

  // Плейсхолдер для аватарів
  const placeholder = "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
      <rect width='100%' height='100%' fill='#eee'/>
      <circle cx='40' cy='30' r='16' fill='#ccc'/>
      <rect x='16' y='52' width='48' height='18' rx='9' fill='#ccc'/>
    </svg>`);

  async function tick(){
    if(elapsed >= durationMs){
      // фінальний — РІВНОМІРНИЙ вибір з pool
      const winner = pool[Math.floor(Math.random() * pool.length)];
      // добираємо аватар, якщо можливо
      let ava = avatarCache.get(winner.handle || winner.channelId || winner.url) || null;
      
      // показуємо екран фіналу
      rollScreen.classList.add('hidden');
      finalScreen.classList.remove('hidden');

      winnerAvatar.src = ava || placeholder;
      winnerLink.textContent = winner.name;
      winnerLink.href = makeChannelUrl(winner);
      winnerMeta.textContent = (winner.number || winner.number === 0) ? `№ ${winner.number}` : '';

      // додаємо у список переможців
      selectedWinners.push(winner);
      updateWinnersList();
      return;
    }

    // проміжне випадкове ім'я
    const rnd = pool[Math.floor(Math.random() * pool.length)];
    rollNameEl.textContent = rnd.name;

    // відображаємо аватарку з кешу
    const cacheKey = rnd.handle || rnd.channelId || rnd.url;
    rollAvatar.src = avatarCache.get(cacheKey) || placeholder;

    // клік-звук
    playClick();

    elapsed += delay;
    delay = Math.min(360, delay * accel); // поступове уповільнення до ~360мс
    setTimeout(tick, delay);
  }
  tick();
}

/* ===== Оновлення списку переможців на сторінці ===== */
function updateWinnersList(){
  const list = document.getElementById('winnersList');
  list.innerHTML = selectedWinners.map(w => {
    const num = w.number !== "" && w.number != null ? `#${esc(w.number)}: ` : "";
    const href = makeChannelUrl(w);
    const safeName = esc(w.name);
    const a = href && href !== "#" ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${safeName}</a>` : safeName;
    return `<li>${num}${a}</li>`;
  }).join('');
}