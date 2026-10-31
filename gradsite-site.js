/* Public site: renders everything from the content JSON the server embeds in the page.
   Each section is a small function ("component") that returns DOM, so it is easy to change. */
(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v; // only used with trusted, built-in SVG strings
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  const paras = (list, cls) => (list || []).filter(Boolean).map((t) => h('p', { class: cls }, t));
  const safeImg = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : '');

  const ICON = {
    cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 10v6"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    heart: '<svg class="heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 2.9 5 6.3 5c2 0 3.4 1.1 4.2 2.4h3C14.3 6.1 15.7 5 17.7 5c3.4 0 5.3 3.6 3.9 6.8C19.5 16.4 12 21 12 21z"/></svg>',
    ornament: '<svg class="ornament" viewBox="0 0 90 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 7h30M58 7h30"/><path d="M45 1l5 6-5 6-5-6z" fill="currentColor"/></svg>'
  };
  const svg = (name) => { const t = document.createElement('template'); t.innerHTML = ICON[name]; return t.content.firstChild; };

  const initials = (name) => (name || '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  /* Inline SVG placeholder so the lightbox works before real photos exist */
  function placeholderSrc(caption) {
    const label = (caption || 'Your photo here').replace(/[<>&"]/g, '');
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1e7f5c"/><stop offset="1" stop-color="#0e3b2c"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><g fill="none" stroke="#e9d9ae" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(340 230) scale(5)"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2.5 9 2.5 12 0v-5"/></g><text x="400" y="440" fill="#fff" font-family="Georgia,serif" font-size="30" text-anchor="middle">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  /* ---------- components ---------- */
  function Placeholder(kind, light) {
    return h('div', { class: 'ph' + (light ? ' light' : '') }, svg(kind), h('span', null, kind === 'cap' ? 'Graduation photo' : 'Photo coming soon'));
  }

  function Hero(c) {
    const hero = c.hero;
    const photo = safeImg(hero.photo);
    return h('div', { class: 'hero-inner' },
      h('div', { class: 'hero-text' },
        h('p', { class: 'hero-name hero-reveal' }, hero.name),
        h('h1', { id: 'hero-name', class: 'hero-reveal d1' }, hero.headline),
        h('p', { class: 'hero-sub hero-reveal d2' }, hero.subheading),
        h('ul', { class: 'hero-facts hero-reveal d3' },
          h('li', null, '🎓 ' + hero.degree), h('li', null, '🏛️ ' + hero.school), h('li', null, '📅 ' + hero.year)),
        h('a', { class: 'btn hero-reveal d4', href: '#about', id: 'cta' }, hero.button || 'Explore My Journey', h('span', { class: 'chev', 'aria-hidden': 'true' }, '↓'))
      ),
      h('div', { class: 'arch-wrap hero-reveal d2' },
        h('div', { class: 'arch' }, photo ? h('img', { src: photo, alt: 'Graduation portrait of ' + hero.name, fetchpriority: 'high' }) : Placeholder('cap')))
    );
  }

  const SectionHead = (id, title, intro) => h('div', { class: 'section-head reveal' }, h('h2', { id }, title), intro ? h('p', null, intro) : null);

  function About(c) {
    const photo = safeImg(c.bio.photo);
    return h('div', { class: 'wrap' },
      SectionHead('about-title', 'About Me'),
      h('div', { class: 'about-grid' },
        h('div', { class: 'about-text reveal' }, photo ? h('div', { class: 'about-photo' }, h('img', { src: photo, alt: 'Portrait of ' + c.hero.name, loading: 'lazy' })) : null, paras(c.bio.paragraph.split(/\n+/))),
        h('dl', { class: 'facts reveal' }, (c.bio.facts || []).map((f) => h('div', null, h('dt', null, f.label), h('dd', null, f.value))))
      ));
  }

  const AchievementCard = (a) => h('article', { class: 'card reveal' }, h('span', { class: 'tag' }, a.category), h('h3', null, a.title), h('p', null, a.text));
  function Achievements(c) {
    const groups = {};
    c.achievements.forEach((a) => { (groups[a.category || 'Other'] = groups[a.category || 'Other'] || []).push(a); });
    return h('div', { class: 'wrap' },
      SectionHead('ach-title', 'Achievements and Leadership', 'Milestones earned through study, service and responsibility.'),
      Object.entries(groups).map(([name, list]) => h('div', null, h('h3', { class: 'group-title reveal' }, name === 'Academic' ? 'Academic Achievements' : name === 'Leadership' ? 'Leadership Experience' : name), h('div', { class: 'cards' }, list.map(AchievementCard)))));
  }

  function Skills(c) {
    return h('div', { class: 'wrap' },
      SectionHead('skills-title', 'Skills, Interests and Future Goals'),
      h('div', { class: 'skills-grid' },
        h('ul', { class: 'chips reveal', 'aria-label': 'Interests' }, c.skills.map((s) => h('li', null, s))),
        h('div', { class: 'goal reveal' }, h('h3', null, 'Future Goals'), h('p', null, '“' + c.goals + '”'))));
  }

  function Timeline(c) {
    return h('div', { class: 'wrap' },
      SectionHead('journey-title', 'My Academic Journey', 'Five years, five chapters.'),
      h('ol', { class: 'timeline' }, c.timeline.map((t) => h('li', { class: 'tl-item reveal' },
        h('span', { class: 'tl-dot', 'aria-hidden': 'true' }, (t.year || '').slice(-4)),
        h('div', { class: 'tl-body' }, h('h3', null, t.year + ' — ' + t.title), h('p', null, t.text))))));
  }

  /* Gallery + lightbox */
  const lightbox = { items: [], index: 0, opener: null };
  function Gallery(c) {
    lightbox.items = c.gallery.map((g) => ({ src: safeImg(g.src), caption: g.caption || '' }));
    return h('div', { class: 'wrap' },
      SectionHead('gallery-title', 'Graduation Gallery', 'Moments worth keeping. Tap any photo to view it full screen.'),
      h('div', { class: 'gallery reveal' }, c.gallery.map((g, i) => {
        const src = safeImg(g.src);
        return h('button', { class: 'g-item', type: 'button', 'aria-label': 'Open photo ' + (i + 1) + (g.caption ? ': ' + g.caption : ''), onclick: (e) => openLightbox(i, e.currentTarget) },
          src ? h('img', { src, alt: g.caption || 'Graduation photo ' + (i + 1), loading: 'lazy' }) : Placeholder('camera', true),
          g.caption ? h('span', { class: 'g-cap' }, g.caption) : null);
      })));
  }
  function showLightbox() {
    const it = lightbox.items[lightbox.index];
    if (!it) return;
    const img = $('#lb-img');
    img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    img.src = it.src || placeholderSrc(it.caption);
    img.alt = it.caption || 'Graduation photo ' + (lightbox.index + 1);
    $('#lb-cap').textContent = it.caption;
  }
  function openLightbox(i, opener) {
    lightbox.index = i; lightbox.opener = opener;
    $('#lightbox').hidden = false; document.body.style.overflow = 'hidden';
    showLightbox(); $('.lb-close').focus();
  }
  function closeLightbox() { $('#lightbox').hidden = true; document.body.style.overflow = ''; if (lightbox.opener) lightbox.opener.focus(); }
  function stepLightbox(d) { const n = lightbox.items.length; lightbox.index = (lightbox.index + d + n) % n; showLightbox(); }
  function initLightbox() {
    $('.lb-close').onclick = closeLightbox;
    $('.lb-prev').onclick = () => stepLightbox(-1);
    $('.lb-next').onclick = () => stepLightbox(1);
    $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if ($('#lightbox').hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
      else if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...document.querySelectorAll('#lightbox .lb-btn')];
        const i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    let x0 = null; // swipe on touch screens
    $('#lightbox').addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    $('#lightbox').addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1); x0 = null; });
  }

  /* Appreciation: category cards + special individuals (photo is optional) */
  function PersonCard(p) {
    const photo = safeImg(p.photo);
    return h('article', { class: 'person glass reveal' },
      photo ? h('div', { class: 'person-photo' }, h('img', { src: photo, alt: p.name, loading: 'lazy' })) : null,
      h('div', { class: 'person-body' },
        photo ? null : svg('heart'),
        h('h3', null, p.name),
        p.relation ? h('p', { class: 'role' }, p.relation) : null,
        p.message ? h('p', { class: 'msg' }, p.message) : null,
        p.prayer ? h('p', { class: 'prayer' }, p.prayer) : null));
  }
  function Appreciation(c) {
    const a = c.appreciation;
    const people = (a.people || []).filter((p) => p.name);
    return h('div', { class: 'wrap' },
      SectionHead('gratitude-title', a.title),
      h('div', { class: 'passage reveal' }, paras(a.intro)),
      h('div', { class: 'cards' }, a.categories.map((cat) => h('article', { class: 'card glass reveal' }, svg('heart'), h('h3', null, cat.title), h('p', null, cat.text)))),
      people.length ? h('div', null, h('h3', { class: 'group-title people-title reveal' }, a.peopleTitle || 'Special Individuals'), h('div', { class: 'people' }, people.map(PersonCard))) : null);
  }

  function Thanks(c) {
    return h('div', { class: 'wrap' }, h('div', { class: 'thanks reveal' }, svg('ornament'), h('h2', { id: 'thanks-title' }, c.thanks.title), paras(c.thanks.paragraphs)));
  }

  function Quotes(c) {
    return h('div', { class: 'wrap' },
      h('blockquote', { class: 'quote-main reveal' }, c.quotes.main),
      c.quotes.extra ? h('p', { class: 'quote-extra reveal' }, c.quotes.extra) : null);
  }

  const SOCIAL = {
    facebook: ['Facebook', '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>'],
    instagram: ['Instagram', '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>'],
    whatsapp: ['WhatsApp', '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .7c-1-.4-1.8-1.200-2.200-2.200l.7-1-1-2z"/>'],
    linkedin: ['LinkedIn', '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>'],
    github: ['GitHub', '<path d="M9 19c-5 1.500-5-2.500-7-3m14 6v-3.900a3.400 3.400 0 0 0-.9-2.600c3.100-.3 6.400-1.500 6.400-7a5.400 5.400 0 0 0-1.500-3.800 5 5 0 0 0-.1-3.700s-1.200-.3-3.900 1.500a13.400 13.400 0 0 0-7 0C6.300 1.500 5.100 1.800 5.100 1.800a5 5 0 0 0-.1 3.700A5.400 5.400 0 0 0 3.500 9.300c0 5.400 3.300 6.600 6.400 7a3.400 3.400 0 0 0-.9 2.600V22"/>'],
    email: ['Email', '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>']
  };
  function socialHref(key, v) {
    v = (v || '').trim(); if (!v) return '';
    if (key === 'email') return /^[^\s@]+@[^\s@]+$/.test(v) ? 'mailto:' + v : '';
    if (key === 'whatsapp' && /^[+\d\s()-]{7,}$/.test(v)) return 'https://wa.me/' + v.replace(/\D/g, '');
    return /^https?:\/\//i.test(v) ? v : '';
  }
  function Footer(c) {
    const links = Object.keys(SOCIAL).map((k) => [k, socialHref(k, c.social[k])]).filter(([, href]) => href);
    return h('div', { class: 'wrap' },
      links.length ? h('ul', { class: 'social', 'aria-label': 'Social links' }, links.map(([k, href]) => h('li', null,
        h('a', { href, 'aria-label': SOCIAL[k][0], target: k === 'email' ? null : '_blank', rel: 'noopener noreferrer', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SOCIAL[k][1]}</svg>` })))) : null,
      h('p', null, c.footer.copyright), h('p', null, c.footer.line2),
      c.site.motto ? h('p', null, '💚 “' + c.site.motto.replace(/^["“]|["”]$/g, '') + '”') : null,
      h('p', { class: 'closing' }, '“' + c.footer.closing + '”'));
  }

  /* Visitor messages: new messages stay hidden until the owner approves them in the dashboard */
  function Messages(c) {
    const m = c.messages || {};
    const thanksMsg = 'Thank you! Your message was sent and will appear once it is approved.';
    const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
    const name = h('input', { id: 'msg-name', type: 'text', maxlength: '80', required: true, autocomplete: 'name' });
    const text = h('textarea', { id: 'msg-text', rows: '4', maxlength: '600', required: true });
    const trap = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', class: 'trap', 'aria-hidden': 'true' });
    const btn = h('button', { class: 'btn', type: 'submit' }, 'Send message');
    const form = h('form', { class: 'msg-form glass reveal', onsubmit: async (e) => {
      e.preventDefault();
      if (trap.value) { status.textContent = thanksMsg; form.reset(); return; } // bots fill the hidden box
      let last = 0; try { last = Number(localStorage.getItem('grad-msg-last')) || 0; } catch (_) { /* ignore */ }
      if (Date.now() - last < 60000) { status.textContent = 'Please wait a minute before sending another message.'; return; }
      if (!configured) { status.textContent = 'Messages are not available yet.'; return; }
      btn.disabled = true; status.textContent = 'Sending…';
      try {
        const r = await fetch(CFG.SUPABASE_URL + '/rest/v1/messages', { method: 'POST',
          headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ name: name.value.trim(), message: text.value.trim() }) });
        if (!r.ok) throw new Error('failed');
        try { localStorage.setItem('grad-msg-last', String(Date.now())); } catch (_) { /* ignore */ }
        form.reset(); status.textContent = thanksMsg;
      } catch (_) { status.textContent = 'Sorry, your message could not be sent. Please try again.'; }
      finally { btn.disabled = false; }
    } },
      h('label', { class: 'field', for: 'msg-name' }, h('span', null, 'Your name'), name),
      h('label', { class: 'field', for: 'msg-text' }, h('span', null, 'Your message'), text),
      trap, btn, status);
    return h('div', { class: 'wrap' },
      SectionHead('messages-title', m.title || 'Leave Me a Message', m.intro),
      h('div', { class: 'msg-grid' }, form, h('div', { class: 'msg-list', id: 'msg-list', 'aria-live': 'polite' })));
  }
  async function loadMessages() {
    const box = $('#msg-list'); if (!box || !configured) return;
    try {
      const r = await fetch(CFG.SUPABASE_URL + '/rest/v1/messages?approved=eq.true&select=id,name,message&order=created_at.desc&limit=60',
        { headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY } });
      if (!r.ok) return;
      const rows = await r.json();
      box.replaceChildren(...(rows.length ? rows.map((row) => h('article', { class: 'msg-card glass' }, h('p', { class: 'msg-text' }, row.message), h('p', { class: 'msg-by' }, '— ' + row.name)))
        : [h('p', { class: 'msg-empty' }, 'Be the first to leave a message.')]));
    } catch (_) { /* leave empty */ }
  }

  /* ---------- page assembly ---------- */
  function render(c) {
    document.title = c.site.title;
    const put = (sel, node) => { const t = $(sel); t.replaceChildren(...(Array.isArray(node) ? node : [node])); };
    put('#hero', Hero(c));
    put('#about', About(c)); put('#achievements', Achievements(c)); put('#skills', Skills(c));
    put('#journey', Timeline(c)); put('#gallery', Gallery(c)); put('#gratitude', Appreciation(c));
    put('#thanks', Thanks(c)); put('#messages', Messages(c)); put('#quotes', Quotes(c)); put('#footer', Footer(c));
    $('#cta').addEventListener('click', () => confetti(60));
    observeReveals();
    loadMessages();
  }

  function observeReveals() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((e, i) => { e.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(e); });
  }

  function initNav() {
    const header = $('.site-header'), toggle = $('.nav-toggle'), links = $('#nav-links');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    toggle.addEventListener('click', () => { const open = links.classList.toggle('open'); toggle.setAttribute('aria-expanded', open); });
    links.addEventListener('click', (e) => { if (e.target.closest('a')) { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });
  }

  /* Subtle confetti: small green, white and gold pieces; respects reduced motion */
  function confetti(count) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = $('#confetti'), ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ['#1e7f5c', '#ffffff', '#b8913a', '#e9d9ae', '#0e3b2c'];
    const bits = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5,
      w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, vy: 1.6 + Math.random() * 2, vx: (Math.random() - 0.5) * 1.2,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.15, c: colors[(Math.random() * colors.length) | 0]
    }));
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach((b) => {
        b.x += b.vx + Math.sin(b.y / 40) * 0.5; b.y += b.vy; b.r += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.globalAlpha = 0.85; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      });
      if (++frames < 260) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })();
  }

  /* ---------- loading content from Supabase (read-only, public) ---------- */
  const CFG = window.SITE_CONFIG || {};
  const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) && !/YOUR/.test(CFG.SUPABASE_URL);
  const CACHE_KEY = 'grad-site-content-v1';
  const withDefaults = (c) => Object.assign({}, window.DEFAULT_CONTENT, c || {});

  async function fetchPublished() {
    if (!configured) return null;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(CFG.SUPABASE_URL + '/rest/v1/site_content?id=eq.published&select=data', {
        headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY }, signal: ctl.signal });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows[0] ? rows[0].data : null;
    } catch (_) { return null; } finally { clearTimeout(t); }
  }
  /* Preview: only works for the signed-in admin (the database refuses everyone else) */
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
  async function fetchDraft() {
    if (!configured) return null;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
      const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
      const { data } = await sb.from('site_content').select('data').eq('id', 'draft').maybeSingle();
      return data ? data.data : null;
    } catch (_) { return null; }
  }

  async function start() {
    initNav(); initLightbox();
    if (new URLSearchParams(location.search).get('preview') === '1') {
      const draft = await fetchDraft();
      if (draft) $('#preview-banner').hidden = false;
      render(withDefaults(draft));
    } else {
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) { /* none */ }
      if (cached) { // instant on repeat visits, then quietly update
        render(withDefaults(cached));
        const fresh = await fetchPublished();
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(cached)) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch (_) { /* full */ } render(withDefaults(fresh)); }
      } else {
        const fresh = await fetchPublished();
        if (fresh) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch (_) { /* full */ } }
        render(withDefaults(fresh));
      }
    }
    setTimeout(() => confetti(70), 900);
  }
  start();
})();
