/* ===== app.js v2 ===== */
(function() {
'use strict';

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function $(id) { return document.getElementById(id); }

const EDIT_PW = '00';

const App = {
  editMode: false,
  theme: 'light',
  store: null,
  obs: null,
  activeTag: '',
  activeCategory: '',
  searchWorks: '',
  searchArticles: '',
  _gvList: [],
  _gvIdx: 0,
  _ghBusy: false,
  _ghPending: false,
  _animating: false,
  _poetryIdx: 0,
  _poetryList: [],
  // 2048 game state
  _g2048board: null,
  _g2048score: 0,
  _g2048over: false,
  _g2048Started: false,
  _g2048timerSec: 0,
  _g2048timerId: null,
  _g2048running: false,
  _g2048prevBest: 0,
  _g2048milestones: [128,256,512,1024,2048],
  _g2048reached: {},
  _g2048actx: null,
  _g2048KeyHandler: null,
  _g2048TouchHandler: null,
  genId: () => 'i_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),

  defaults: {
    profile: {
      name:'Your Name', title:'Designer / Developer',
      bio:'Crafting digital experiences with code and creativity.',
      about:'热爱设计 & 开发，专注于构建美观且实用的数字产品。',
      avatar:'',
      contacts:[{icon:'✉',label:'hello@example.com'},{icon:'📍',label:'Shanghai'}],
      socials:[{icon:'🐙',label:'GitHub',url:'https://github.com'},{icon:'📺',label:'Bilibili',url:'https://bilibili.com'}],
    },
    skills:['UI/UX','Frontend','React','JavaScript','CSS'],
    works:[
      {id:'w1',title:'Project Alpha',desc:'一个融合传统文化与现代设计的数字交互项目。',tags:['Design','Frontend'],links:[{label:'GitHub',url:'https://github.com'}],order:0,featured:true},
      {id:'w2',title:'FocusTask Pro',desc:'极智任务管理工具，支持 NLP 解析、番茄钟。',tags:['Productivity','JavaScript'],links:[{label:'GitHub',url:'https://github.com'}],order:1,featured:true},
      {id:'w3',title:'Washi Portfolio',desc:'以京都和纸为灵感的全屏动画作品展示站。',tags:['CSS','Creative'],links:[{label:'View',url:'#'}],order:2,featured:false},
    ],
    articles:[
      {id:'a1',title:'从和纸美学到现代网页设计',date:'2026-05-20',url:'',category:'设计',content:'和纸（Washi）是日本传统手工纸，以其独特的纹理和温润的质感闻名。本文将探讨如何将和纸美学融入现代网页设计，从色彩、纹理到光影效果，营造出兼具传统韵味与现代感的数字体验。',featured:true},
      {id:'a2',title:'scroll-snap 全屏滚动实践',date:'2026-05-15',url:'',category:'技术',content:'CSS scroll-snap 提供了一种声明式的方式来实现滚动捕捉效果。本文记录在实际项目中使用 scroll-snap 的踩坑经历，包括兼容性处理、与 JavaScript 滚动的交互问题，以及最终的替代方案。',featured:true},
      {id:'a3',title:'CSS 入场动画技巧',date:'2026-05-10',url:'',category:'技术',content:'好的入场动画能大幅提升用户体验。本文分享几种实用的 CSS 动画技巧：使用 IntersectionObserver 触发滚动动画、stagger 延迟实现级联效果、cubic-bezier 调出自然动感。',featured:false},
    ],
    gallery:[],
    experience:[
      {id:'e1',year:'2024',title:'Senior Designer',subtitle:'Design Studio',desc:'Led product design team, shipped 10+ products.'},
      {id:'e2',year:'2022',title:'Frontend Developer',subtitle:'Tech Co.',desc:'Built web apps with React and TypeScript.'},
    ],
    education:[
      {id:'ed1',year:'2020',title:'B.Des in Design',subtitle:'University',desc:'Graduated with honors.'},
    ],
    quotes:[
      '写代码就像泡茶，水温要刚好。',
      '设计不是让它看起来怎么样，而是让它用起来怎么样。',
      'Bug 不是程序的错误，是程序在跟你开玩笑。',
    ],
    g2048Best: 0,
    g2048Theme: 'default',
  },

  init() {
    try {
      this.store = new Store('portfolio_data', this.defaults, () => {
        if (GitHubSync.isReady()) this._ghSave();
      });
      this._g2048reached = {};
      // Migrate skills from profile to global
      const d = this.store.data;
      if (d.profile && d.profile.skills && !d.skills) {
        d.skills = d.profile.skills;
      }
      // Migrate featured field for works/articles
      (d.works||[]).forEach(w => { if (w.featured === undefined) w.featured = false; });
      (d.articles||[]).forEach(a => { if (a.featured === undefined) a.featured = false; });
      this.obs = new IntersectionObserver(e=>{e.forEach(e=>{if(e.isIntersecting)e.target.classList.add('iv');})},{threshold:0.05});
      // Image lazy loading observer
      this.imgObs = new IntersectionObserver(e=>{
        e.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
              this.imgObs.unobserve(img);
            }
          }
        });
      }, {threshold:0.1, rootMargin:'50px'});
      this.render();
      this.bind();
      this.initTabVisibility();
      this.loadTheme();
      this._animating = false;  // 确保初始加载无动画
      this.switchPage('home');
      requestAnimationFrame(() => this.updateTabIndicator());
      this.initScrollEffects();
      this.generatePageDecorations();
      this._ghInit();
      this.initReadCounter();
      this.initQuotes();
      this.initKaomoji();
    } catch(e) { console.error('init error:', e); }
    // Easter eggs
    this._initEasterEggs();
  },

  initReadCounter() {
    const counter = $('readCounter');
    const numEl = $('readNum');
    if (!counter || !numEl) return;
    
    const dataCount = this.store.data.galleryReadCount || 0;
    const storedCount = parseInt(localStorage.getItem('gallery_read_count') || dataCount.toString());
    numEl.textContent = storedCount.toString();
    
    counter.addEventListener('click', () => {
      let count = parseInt(localStorage.getItem('gallery_read_count') || '0');
      count++;
      localStorage.setItem('gallery_read_count', count.toString());
      this.store.data.galleryReadCount = count;
      this.store.save();
      numEl.textContent = count.toString();
      numEl.style.transform = 'scale(1.2)';
      setTimeout(() => {
        numEl.style.transform = 'scale(1)';
      }, 200);
    });
  },

  _initEasterEggs() {
    const style = 'font-size:20px;font-weight:bold;color:#C73E3A';
    console.log('%c🍵 谢谢你看到了这里。', style);
    console.log('%c这个网站从崩溃到重生，感谢它的主人没有放弃它。', 'font-size:13px;color:#B8945C');
    console.log('%c以及，Claude 知错了。真的。', 'font-size:12px;color:#8C8884');

    // Logo 5-click → party mode
    let logoClick = 0;
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', () => {
        logoClick++;
        if (logoClick >= 5) {
          logoClick = 0;
          this._partyMode();
        }
        clearTimeout(logo._timer);
        logo._timer = setTimeout(() => { logoClick = 0; }, 2000);
      });
    }

    // Keyboard "thanks" → 🎉
    let seq = '';
    document.addEventListener('keydown', (e) => {
      if (!e.key) return;
      seq += e.key.toLowerCase();
      seq = seq.slice(-6);
      if (seq === 'thanks') {
        seq = '';
        this._partyMode();
      }
    });
  },

  _partyMode() {
    const colors = ['#C73E3A','#B8945C','#E8D5B5','#333','#F0EFEC','#4CAF50','#FF9800','#9C27B0'];
    let i = 0;
    const interval = setInterval(() => {
      document.body.style.transition = 'all 0.3s ease';
      document.body.style.background = colors[i % colors.length];
      document.body.style.color = i % 2 === 0 ? '#333' : '#F0EFEC';
      i++;
      if (i >= 16) {
        clearInterval(interval);
        document.body.style.background = '';
        document.body.style.color = '';
      }
    }, 200);
    this.toast('🎉 彩蛋触发！', 3000);
  },

  // ===== RENDER =====
  render() {
    try {
      this.renderProfile();
      this.renderWorks();
      this.renderArticles();
      this.renderSocial();
      this.renderHomePreview();
      this.renderAboutExtras();
    } catch(e) { console.error('render error:', e); }
  },

  renderProfile() {
    const d = this.store.data.profile;
    $('dispName').textContent = d.name;
    $('dispTitle').textContent = d.title;
    $('dispBio').textContent = d.bio;
    $('aboutBio').textContent = d.about;

    const avs = [$('avDisplay'), $('avAbout')];
    avs.forEach(el => {
      el.innerHTML = d.avatar ? `<img src="${esc(d.avatar)}" alt="">` : esc(d.name[0]||'👤');
    });

    $('skillsTags').innerHTML = this._skills().map((s,i)=>
      `<span class="tag" data-i="${i}">${esc(s)}</span>`
    ).join('') + (this.editMode ? '<span class="tag tag-add" id="skillAdd">+ 添加</span>' : '');

    $('contactsList').innerHTML = d.contacts.map((c,i)=>
      `<div class="contact" data-i="${i}"><span>${c.icon}</span><span>${esc(c.label)}</span></div>`
    ).join('');

    this.observeAll($('skillsTags').children);
    this.observeAll($('contactsList').children);
    this.renderHomePreview();
  },

  renderWorks() {
    const ws = this.store.data.works.sort((a,b)=>a.order-b.order);
    const g = $('wGrid');

    // Filter bar (inserted before grid)
    let fc = $('wFilterContainer');
    if (!fc) {
      fc = document.createElement('div'); fc.id = 'wFilterContainer';
      g.parentNode.insertBefore(fc, g);
    }
    const allTags = [...new Set(ws.flatMap(w=>w.tags||[]))];
    if (this.activeTag && !allTags.includes(this.activeTag)) this.activeTag = '';
    fc.innerHTML = '<div class="filter-bar" id="wFilter"><button class="filter-btn' + (!this.activeTag?' active':'') + '" data-filter="">全部</button>' + allTags.map(t => `<button class="filter-btn${this.activeTag===t?' active':''}" data-filter="${esc(t)}">${esc(t)}</button>`).join('') + '</div>';

    if (!ws.length) { $('wEmpty').style.display=''; g.innerHTML=''; return; }
    $('wEmpty').style.display='none';

    let filtered = this.activeTag ? ws.filter(w=>(w.tags||[]).includes(this.activeTag)) : ws;
    if (this.searchWorks) {
      const q=this.searchWorks.toLowerCase();
      filtered=filtered.filter(w=>w.title.toLowerCase().includes(q)||(w.desc||'').toLowerCase().includes(q)||(w.tags||[]).some(t=>t.toLowerCase().includes(q)));
    }

    let html = (filtered.length ? filtered.map((w, i)=>`
      <div class="w-card${w.featured?' w-featured':''}" data-id="${w.id}"${this.editMode?' draggable="true"':''}>
        ${!this.editMode&&w.featured?'<div class="w-featured-badge">★</div>':''}
        <div class="w-card-acts">
          ${this.editMode?`<button class="w-card-btn${w.featured?' featured':''}" data-act="fw" data-id="${w.id}">${w.featured?'★':'☆'}</button>`:''}
          <button class="w-card-btn" data-act="ew" data-id="${w.id}">✎</button>
          <button class="w-card-btn del" data-act="dw" data-id="${w.id}">✕</button>
        </div>
        ${w.image?`<div class="w-card-img"><img src="${esc(w.image)}" alt="" loading="lazy"></div>`:''}
        <div class="w-card-title">${esc(w.title)}</div>
        ${w.date?`<div class="w-card-date">${esc(w.date)}</div>`:''}
        <div class="w-card-desc">${esc(w.desc)}</div>
        ${w.tags?.length ? `<div class="w-tags">${w.tags.map(t=>`<span class="w-tag">${esc(t)}</span>`).join('')}</div>`:''}
        ${w.links?.length ? `<div class="w-links">${w.links.map(l=>`<a href="${esc(l.url)}" class="w-link" target="_blank">🔗 ${esc(l.label)}</a>`).join('')}</div>`:''}
      </div>
    `).join('') : '<div class="filter-empty">没有匹配的作品</div>');
    if (this.editMode) html += `<div class="w-add" id="wAdd">+ 添加作品</div>`;
    g.innerHTML = html;
    if (this.editMode) g.querySelectorAll('.w-card-btn, .w-link').forEach(el=>el.draggable=false);
    this.observeAll(g.querySelectorAll('.w-card'));
  },

  renderArticles() {
    const as = this.store.data.articles;
    const l = $('aList');

    // Category filter bar
    const cats = [...new Set(as.map(a=>a.category||'').filter(Boolean))];
    if (this.activeCategory && !cats.includes(this.activeCategory)) this.activeCategory = '';
    let filterHtml = '<div class="filter-bar" id="aFilter"><button class="filter-btn' + (!this.activeCategory?' active':'') + '" data-filter="">全部</button>' + cats.map(c => `<button class="filter-btn${this.activeCategory===c?' active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('') + '</div>';

    if (!as.length) { $('aEmpty').style.display=''; l.innerHTML=filterHtml; return; }
    $('aEmpty').style.display='none';

    let filtered = this.activeCategory ? as.filter(a=>(a.category||'')===this.activeCategory) : as;
    if (this.searchArticles) {
      const q=this.searchArticles.toLowerCase();
      filtered=filtered.filter(a=>a.title.toLowerCase().includes(q)||(a.category||'').toLowerCase().includes(q));
    }

    l.innerHTML = filterHtml + (filtered.length ? filtered.map(a=>
      `<div class="a-item${a.featured?' a-featured':''}" data-id="${a.id}"${this.editMode?' draggable="true"':''}>
        <span class="a-date">${a.date}</span>
        <span class="a-title">${esc(a.title)}${!this.editMode&&a.featured?' <span class="a-featured-star">★</span>':''}</span>
        ${a.url?`<a href="${esc(a.url)}" class="a-ext-link" target="_blank">Read →</a>`:''}
        <div class="a-acts">
          ${this.editMode?`<button class="a-btn${a.featured?' featured':''}" data-act="fa" data-id="${a.id}">${a.featured?'★':'☆'}</button>`:''}
          <button class="a-btn" data-act="ea" data-id="${a.id}">✎</button>
          <button class="a-btn del" data-act="da" data-id="${a.id}">✕</button>
        </div>
      </div>`
    ).join('') : '<div class="filter-empty">没有匹配的文章</div>');
    if (this.editMode) l.innerHTML += '<div class="w-add" id="aAdd">+ 添加文章</div>';
    if (this.editMode) l.querySelectorAll('.a-btn').forEach(el=>el.draggable=false);
    this.observeAll(l.querySelectorAll('.a-item'));
  },

  renderSocial() {
    const s = this.store.data.profile.socials;
    [$('heroSoc'), $('ftSoc')||null].forEach(el=>{
      if (!el) return;
      el.innerHTML = s.map(x=>`<a href="${esc(x.url)}" class="soc" target="_blank" title="${esc(x.label)}">${x.icon}</a>`).join('');
    });
  },

  renderHomePreview() {
    const d = this.store.data;
    // Works preview: featured items, fallback to top 3
    let ws = d.works.filter(w=>w.featured).sort((a,b)=>a.order-b.order);
    if (!ws.length) ws = d.works.sort((a,b)=>a.order-b.order).slice(0,3);
    if (ws.length) {
      $('hpWorks').innerHTML = ws.map(w => `
        <div class="hp-work ${w.featured ? 'featured' : ''}" data-id="${w.id}">
          ${w.featured ? '<span class="star-badge">⭐</span>' : ''}
          <span class="hp-w-date">${w.date||''}</span>
          <span class="hp-w-title">${esc(w.title)}</span>
          ${w.tags?.length ? `<div class="hp-w-tags">${w.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
      `).join('');
    } else {
      $('hpWorks').innerHTML = '<div style="color:var(--t3);font-size:0.8rem">暂无作品</div>';
    }
    // Articles preview: featured items, fallback to top 3
    let as = d.articles.filter(a=>a.featured);
    if (!as.length) as = d.articles.slice(0,3);
    if (as.length) {
      $('hpArticles').innerHTML = as.map(a => `
        <div class="hp-article ${a.featured ? 'featured' : ''}" data-id="${a.id}">
          ${a.featured ? '<span class="star-badge">⭐</span>' : ''}
          <span class="hp-a-date">${a.date||''}</span>
          <span class="hp-a-title">${esc(a.title)}</span>
        </div>
      `).join('');
    } else {
      $('hpArticles').innerHTML = '<div style="color:var(--t3);font-size:0.8rem">暂无文章</div>';
    }
    // Skills
    $('hpSkills').innerHTML = this._skills().map(s => `<span class="tag">${esc(s)}</span>`).join('');
    // Observe animations
    this.observeAll($('hpWorks').children);
    this.observeAll($('hpArticles').children);
    this.observeAll($('hpSkills').children);
  },

  observeAll(els) {
    Array.from(els).forEach(el=>{ el.classList.add('ar'); this.obs.observe(el); });
  },

  // ===== GALLERY =====
  renderGallery() {
    const g = this.store.data.gallery.sort((a,b)=> (b.date||'') < (a.date||'') ? -1 : 1);
    const grid = $('gGrid');
    if (!g.length) {
      $('gEmpty').style.display=this.editMode?'none':'';
      grid.innerHTML=this.editMode?'<div class="w-add" id="gAdd">+ 添加图片</div>':'';
      return;
    }
    $('gEmpty').style.display='none';
    let html = g.map(img => {
      const image = img.image || img.url || '';
      return `
      <div class="w-card g-card" data-id="${img.id}"${this.editMode?' draggable="true"':''}>
        ${this.editMode?`<div class="w-card-acts"><button class="w-card-btn" data-act="eg" data-id="${img.id}">✎</button><button class="w-card-btn del" data-act="dg" data-id="${img.id}">✕</button></div>`:''}
        ${image?`<div class="w-card-img"><img src="${esc(image)}" alt="" loading="lazy"></div>`:''}
        <div class="w-card-title">${esc(img.title)}</div>
        ${img.date?`<div class="w-card-date">${esc(img.date)}</div>`:''}
        <div class="w-card-desc">${esc(img.desc || img.caption || '')}</div>
        ${img.tags?.length ? `<div class="w-tags">${img.tags.map(t=>`<span class="w-tag">${esc(t)}</span>`).join('')}</div>`:''}
        ${img.links?.length ? `<div class="w-links">${img.links.map(l=>`<a href="${esc(l.url)}" class="w-link" target="_blank">🔗 ${esc(l.label)}</a>`).join('')}</div>`:''}
      </div>`;
    }).join('');
    if (this.editMode) html += '<div class="w-add" id="gAdd">+ 添加图片</div>';
    grid.innerHTML = html;
    this.observeAll(grid.querySelectorAll('.w-card'));
  },

  modalGalleryImage(id) {
    if (!this.editMode) { this.toast('请先开启编辑模式'); return; }
    const img = id ? this.store.data.gallery.find(x=>x.id===id) : null;
    const isE = !!img;
    const links = img?.links?.length ? img.links : [{label:'',url:''}];
    const image = img?.image || img?.url || '';

    this.modal({
      title: isE ? '✎ 编辑图片' : '🖼 添加图片',
      body: `
        <div class="fg"><label>标题</label><input id="gf_t" value="${esc(img?.title||'')}"></div>
        <div class="fg"><label>日期</label><input id="gf_date" type="date" value="${img?.date || new Date().toISOString().split('T')[0]}"></div>
        <div class="fg"><label>描述</label><textarea id="gf_d" rows="4">${esc(img?.desc||img?.caption||'')}</textarea></div>
        <div class="fg"><label>图片 <span style="font-weight:400;color:var(--t3)">(URL 或上传)</span></label><input id="gf_img" value="${esc(image)}" placeholder="图片 URL"><input type="file" id="gf_file" accept="image/*" style="margin-top:4px;font-size:0.8rem;color:var(--t2)"></div>
        <div class="fg"><label>标签（逗号分隔）</label><input id="gf_tags" value="${esc((img?.tags||[]).join(', '))}"></div>
        <div class="fg"><label>链接</label><div id="gf_links">${links.map(l=>`<div class="link-e"><input placeholder="名称" value="${esc(l.label)}"><input placeholder="URL" value="${esc(l.url)}"><button class="link-rm">✕</button></div>`).join('')}</div><button class="add-link" id="gf_al">+ 添加链接</button></div>
      `,
      footer: [
        {label:'取消',cls:'btn-s'},
        {label:isE?'保存':'添加',cls:'btn-p',action:()=>{
          const title=$('gf_t').value.trim()||'Untitled';
          const image=$('gf_img').value.trim();
          if(!image){this.toast('请填写图片 URL 或上传');return;}
          const data={title,desc:$('gf_d').value.trim(),image,date:$('gf_date').value,tags:$('gf_tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),links:this._glinks()};
          if(isE){Object.assign(img,data);this.store.save();this.renderGallery();this.closeModal();this.toast('✅ 已更新');}
          else{data.id=this.genId();data.order=Date.now();this.store.data.gallery.push(data);this.store.save();this.renderGallery();this.closeModal();this.toast('✅ 已添加');}
        }},
      ],
      onOpen:()=>{
        this._gbind();
        $('gf_file').onchange=function(){
          const f=this.files[0]; if(!f) return;
          const r=new FileReader();
          r.onload=e=>{$('gf_img').value=e.target.result;};
          r.readAsDataURL(f);
        };
      },
    });
  },

  delGalleryImage(id) {
    if (!confirm('确认删除此图片？')) return;
    this.store.data.gallery = this.store.data.gallery.filter(img=>img.id!==id);
    this.store.save(); this.renderGallery(); this.toast('已删除');
  },

  showGalleryDetail(id) {
    if (this.editMode) return;
    const img = this.store.data.gallery.find(x=>x.id===id);
    if (!img) return;
    const image = img.image || img.url || '';
    this.modal({
      wide: true,
      title: `🖼 ${img.title}`,
      body: `
        ${image?`<div style="margin:-14px -20px 14px;border-radius:10px 10px 0 0;overflow:hidden;max-height:300px"><img src="${esc(image)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`:''}
        ${(img.desc||img.caption)?`<div style="font-size:0.88rem;line-height:1.8;color:var(--t2)">${esc(img.desc||img.caption)}</div>`:''}
        ${img.tags?.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:12px">${img.tags.map(t=>`<span class="w-tag">${esc(t)}</span>`).join('')}</div>`:''}
        ${img.links?.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid var(--b2)">${img.links.map(l=>`<a href="${esc(l.url)}" class="w-link" target="_blank">🔗 ${esc(l.label)}</a>`).join('')}</div>`:''}
      `,
      footer: [{label:'关闭',cls:'btn-s',action:()=>this.closeModal()}],
    });
  },

  _glinks() {
    return Array.from(document.querySelectorAll('#gf_links .link-e')).map(el=>{
      const ins=el.querySelectorAll('input');
      return {label:ins[0]?.value.trim()||'',url:ins[1]?.value.trim()||''};
    }).filter(l=>l.label&&l.url);
  },
  _gbind() {
    const c=$('gf_links');
    c.addEventListener('click',e=>{
      if(e.target.closest('.link-rm')) {
        const en=e.target.closest('.link-e');
        if(c.children.length>1) en.remove(); else en.querySelectorAll('input').forEach(i=>i.value='');
      }
    });
    $('gf_al').addEventListener('click',()=>{
      const d=document.createElement('div'); d.className='link-e';
      d.innerHTML='<input placeholder="名称"><input placeholder="URL"><button class="link-rm">✕</button>';
      c.appendChild(d);
    });
  },

  // ===== DETAIL VIEWS =====
  showWorkDetail(id) {
    if (this.editMode) return;
    const w = this.store.data.works.find(x=>x.id===id);
    if (!w) return;
    this.modal({
      wide: true,
      title: `📦 ${w.title}`,
      body: `
        ${w.image?`<div style="margin:-14px -20px 14px;border-radius:10px 10px 0 0;overflow:hidden;max-height:240px;cursor:zoom-in" onclick="App.showWorkGalleryViewer('${w.id}')"><img src="${esc(w.image)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`:''}
        <div style="font-size:0.88rem;line-height:1.8;color:var(--t2)">${esc(w.desc)}</div>
        ${w.tags?.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:12px">${w.tags.map(t=>`<span class="w-tag">${esc(t)}</span>`).join('')}</div>`:''}
        ${w.links?.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid var(--b2)">${w.links.map(l=>`<a href="${esc(l.url)}" class="w-link" target="_blank">🔗 ${esc(l.label)}</a>`).join('')}</div>`:''}
      `,
      footer: [{label:'关闭',cls:'btn-s',action:()=>this.closeModal()}],
    });
  },

  showArticleDetail(id) {
    if (this.editMode) return;
    const a = this.store.data.articles.find(x=>x.id===id);
    if (!a) return;
    
    // Parse content to handle images and text
    let contentHtml = '';
    if (a.content) {
      // Match image URLs (http/https URLs ending with image extensions or base64)
      const imgPattern = /(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg))|data:image\/[^;]+;base64,[^\s<>"]+/gi;
      let lastIndex = 0;
      let match;
      const content = a.content;
      
      // Process content with images
      while ((match = imgPattern.exec(content)) !== null) {
        // Add text before image
        if (match.index > lastIndex) {
          const textBefore = content.slice(lastIndex, match.index).trim();
          if (textBefore) {
            contentHtml += `<p style="margin:12px 0;line-height:1.8">${esc(textBefore)}</p>`;
          }
        }
        // Add image
        contentHtml += `<img src="${match[0]}" alt="文章图片" class="article-detail-img" onclick="App.showLightbox(this.src)">`;
        lastIndex = match.index + match[0].length;
      }
      // Add remaining text
      if (lastIndex < content.length) {
        const remainingText = content.slice(lastIndex).trim();
        if (remainingText) {
          contentHtml += `<p style="margin:12px 0;line-height:1.8">${esc(remainingText)}</p>`;
        }
      }
      
      // If no images found, just escape and display as text
      if (!contentHtml) {
        contentHtml = `<div style="line-height:1.8;white-space:pre-wrap">${esc(a.content)}</div>`;
      }
    } else {
      contentHtml = '<div style="color:var(--t3);font-style:italic">暂无内容</div>';
    }
    
    this.modal({
      wide: true,
      title: `📝 ${a.title}`,
      body: `
        <div style="font-size:0.78rem;color:var(--t3);margin-bottom:12px">${a.date||''}${a.category?` · ${esc(a.category)}`:''}</div>
        <div style="font-size:0.88rem;color:var(--t2)">${contentHtml}</div>
        ${a.url?`<div style="margin-top:12px"><a href="${esc(a.url)}" class="w-link" target="_blank">🔗 阅读原文</a></div>`:''}
      `,
      footer: [{label:'关闭',cls:'btn-s',action:()=>this.closeModal()}],
    });
  },

  // ===== ABOUT EXTRAS =====
  renderAboutExtras() {
    const d = this.store.data;
    // Stats
    const maxN = Math.max(d.works.length, d.articles.length, d.gallery.length, this._skills().length, 1);
    $('abStats').innerHTML = `
      <div class="ab-stat" style="--pct:${d.works.length/maxN*100}%"><span class="ab-stat-icon">📦</span><span class="ab-stat-n">${d.works.length}</span><span class="ab-stat-l">作品</span></div>
      <div class="ab-stat" style="--pct:${d.articles.length/maxN*100}%"><span class="ab-stat-icon">📝</span><span class="ab-stat-n">${d.articles.length}</span><span class="ab-stat-l">文章</span></div>
      <div class="ab-stat" style="--pct:${d.gallery.length/maxN*100}%"><span class="ab-stat-icon">🖼</span><span class="ab-stat-n">${d.gallery.length}</span><span class="ab-stat-l">影像</span></div>
      <div class="ab-stat" style="--pct:${this._skills().length/maxN*100}%"><span class="ab-stat-icon">⚡</span><span class="ab-stat-n">${this._skills().length}</span><span class="ab-stat-l">技能</span></div>
    `;
    // Timeline (experience + education)
    const tl = [...(d.experience||[]), ...(d.education||[])]
      .sort((a,b)=>a.year.localeCompare(b.year));
    $('tlWrap').innerHTML = `
      ${tl.length?tl.map((item, i)=>`
        <div class="tl-item" data-tl-id="${item.id}">
          <div class="tl-dot"></div>
          <div class="tl-body">
            <span class="tl-year">${esc(item.year)}</span>
            <span class="tl-title">${esc(item.title)}</span>
            ${item.subtitle?`<span class="tl-sub">${esc(item.subtitle)}</span>`:''}
            ${item.desc?`<p class="tl-desc">${esc(item.desc)}</p>`:''}
            ${this.editMode?`<div class="tl-acts"><button class="tl-edit" data-tl-id="${item.id}">✎</button><button class="tl-del" data-tl-id="${item.id}">✕</button></div>`:''}
          </div>
        </div>
        ${i < tl.length - 1 ? '<div class="tl-arrow">▾</div>' : ''}
      `).join(''):'<div style="color:var(--t3);font-size:0.85rem;padding:8px 0">暂无记录</div>'}
      ${this.editMode?'<button class="tl-add" id="tlAdd">+ 添加经历</button>':''}
    `;
  },

  modalTimelineItem(id) {
    if (!this.editMode) return;
    const d = this.store.data;
    let item = d.experience.find(x=>x.id===id) || d.education.find(x=>x.id===id);
    let type = item ? (d.experience.includes(item)?'experience':'education') : 'experience';
    const isE = !!item;

    this.modal({
      title: isE ? '✎ 编辑经历' : '➕ 添加经历',
      body: `
        <div class="fg"><label>类型</label><select id="tl_type">${['experience','education'].map(t=>`<option value="${t}"${type===t?' selected':''}>${t==='experience'?'工作':'教育'}</option>`).join('')}</select></div>
        <div class="fg"><label>年份</label><input id="tl_year" type="number" min="1900" max="2100" step="1" placeholder="如 2012" value="${esc(item?.year||'')}"></div>
        <div class="fg"><label>标题</label><input id="tl_title" value="${esc(item?.title||'')}"></div>
        <div class="fg"><label>副标题</label><input id="tl_sub" value="${esc(item?.subtitle||'')}"></div>
        <div class="fg"><label>描述</label><textarea id="tl_desc" rows="3">${esc(item?.desc||'')}</textarea></div>
        ${isE?`<button class="btn btn-sm btn-p" id="tl_del" style="margin-top:4px">删除此记录</button>`:''}
      `,
      footer: [
        {label:'取消',cls:'btn-s'},
        {label:isE?'保存':'添加',cls:'btn-p',action:()=>{
          const year=$('tl_year').value.trim();
          const title=$('tl_title').value.trim();
          if(!year||!title){this.toast('年份和标题不能为空');return;}
          const data={id:id||this.genId(),year,title,subtitle:$('tl_sub').value.trim(),desc:$('tl_desc').value.trim()};
          const t=$('tl_type').value;
          if(isE){
            // If type changed, move item between arrays
            if(t!==type){
              if(d.experience.includes(item))d.experience=d.experience.filter(x=>x.id!==id);
              else d.education=d.education.filter(x=>x.id!==id);
              d[t].push(data);
            } else {
              Object.assign(item,data);
            }
          } else {
            d[t].push(data);
          }
          this.store.save(); this.closeModal(); this.renderAboutExtras(); this.toast('✅ 已保存');
        }},
      ],
      onOpen:()=>{
        const del=$('tl_del');
        if(del) del.onclick=()=>{
          if(!confirm('确认删除？'))return;
          d.experience=d.experience.filter(x=>x.id!==id);
          d.education=d.education.filter(x=>x.id!==id);
          this.store.save(); this.closeModal(); this.renderAboutExtras(); this.toast('已删除');
        };
      },
    });
  },

  modalQuotes() {
    if (!this.editMode) return;
    const qs = this.store.data.quotes;
    this.modal({
      title: '💬 管理语录',
      body: qs.map((q,i)=>`
        <div class="q-e"><textarea data-i="${i}" rows="2">${esc(q)}</textarea><button class="q-del" data-i="${i}">✕</button></div>
      `).join('') + `<button class="btn btn-sm btn-s" id="qAdd" style="margin-top:6px">+ 添加语录</button>
      <p style="font-size:0.75rem;color:var(--t3);margin-top:8px">首页会随机显示一条语录</p>`,
      footer: [
        {label:'取消',cls:'btn-s'},
        {label:'保存',cls:'btn-p',action:()=>{
          const newQs=[];
          document.querySelectorAll('.q-e textarea').forEach(ta=>{
            const v=ta.value.trim();
            if(v) newQs.push(v);
          });
          this.store.data.quotes=newQs;
          this.store.save(); this.closeModal(); this.renderAboutExtras(); this.toast('✅ 语录已更新');
        }},
      ],
      onOpen:()=>{
        $('qAdd').onclick=()=>{
          const c=$('modalBody');
          const d=document.createElement('div'); d.className='q-e';
          d.innerHTML='<textarea data-i="-1" rows="2"></textarea><button class="q-del">✕</button>';
          c.insertBefore(d, $('qAdd'));
        };
        document.querySelectorAll('.q-del').forEach(b=>b.onclick=function(){
          const e=this.closest('.q-e');
          if(e&&document.querySelectorAll('.q-e').length>1) e.remove();
          else this.toast('至少保留一条语录');
        });
      },
    });
  },

  // ===== SCROLL EFFECTS =====
  initScrollEffects() {
    const hpDeco = $('#page-home .p-deco');
    const nav = $('nav');
    let ticking = false;

    const handler = () => {
      const y = window.pageYOffset;
      if (hpDeco) hpDeco.style.transform = `translateY(${y*0.04}px)`;
      nav.classList.toggle('nav-scrolled', y > 60);

      // Scroll progress
      const sp = $('scrollProgress');
      if (sp) {
        const maxY = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
        const pct = maxY > 0 ? (y / maxY * 100) : 0;
        sp.style.width = pct + '%';
        sp.classList.toggle('visible', pct > 2);
      }

      // Back to top visibility (use .show class to match new CSS)
      const btt = $('backToTop');
      if (btt) btt.classList.toggle('show', y > 300);

      // Scroll animations
      document.querySelectorAll('.scroll-animate').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.85) {
          el.classList.add('in-view');
        }
      });
    };

    window.addEventListener('scroll', ()=>{
      if (!ticking) {
        requestAnimationFrame(()=>{ handler(); ticking=false; });
        ticking = true;
      }
    }, { passive: true });

    // Initial check
    handler();
  },

  // ===== DECORATIONS =====
  generatePageDecorations() {
    const items = [
      'E = mc²','φ = 1.618…','a² + b² = c²','∫ f(x) dx','∀ε > 0, ∃δ > 0',
      '∂u/∂t = α∂²u/∂x²','∇·E = ρ/ε₀','Σᵢ₌₁ⁿ xᵢ','π ≈ 3.14159',
      'e^(iπ) + 1 = 0','F = G(m₁m₂)/r²','P(A|B) = P(B|A)P(A)/P(B)',
      'λ = h/p','H = -Σ pᵢ log pᵢ','limₓ→₀ sin(x)/x = 1',
      'const fn = () => {}',"import { x } from 'y'",'class Component {}',
      'if (isReady) {}','for (let i = 0;;) {}','export default App',
      'async function load()','try {} catch(e) {}','useEffect(() => {}, [])',
      'return (<View />)',"console.log('hello')",'data.map(x => x)',
      '<div className="app">','npm run dev','git push origin main',
      'yarn add react','<Tabs />','px-4 py-2 rounded-lg',
      'flex flex-col gap-4','@media (max-width: 768px)','body { margin: 0 }',
      'typeof NaN === "number"','[] == ![]','closure (x => y => x + y)',
      'O(n log n)','Promise.all()','async await',
      'box-shadow: var(--shadow)','border-radius: 99px',
      ':root { --red: #C73E3A }','@keyframes fadeIn',
      'tong','TONG','tong','TONG','tong',
      'liyu','LIYU','liyu','LIYU','liyu',
      'tong.liyu','TL','tong_liyu','TL.dev',
    ];
    const colors = ['var(--gold)','var(--red)','var(--t3)'];
    const sizes = [0.65, 0.75, 0.85, 0.95, 1.05];
    document.querySelectorAll('.p-deco').forEach(deco => {
      if (deco.children.length) return; // already generated
      const frag = document.createDocumentFragment();
      const pool = [...items].sort(()=>Math.random()-0.5).slice(0, 35);
      pool.forEach((txt, i) => {
        const el = document.createElement('span');
        const isWatermark = ['tong','TONG','liyu','LIYU','tong.liyu','TL','tong_liyu','TL.dev'].includes(txt);
        el.className = isWatermark ? 'pf pf-watermark' : 'pf';
        el.textContent = txt;
        el.style.left = (Math.random() * 82 + 5) + '%';
        el.style.top = (Math.random() * 85 + 5) + '%';
        el.style.fontSize = sizes[Math.floor(Math.random()*sizes.length)] + 'rem';
        el.style.color = colors[Math.floor(Math.random()*colors.length)];
        el.style.opacity = (Math.random() * 0.12 + 0.10);
        el.style.setProperty('--rot', (Math.random() * 12 - 6) + 'deg');
        el.style.setProperty('--i', i);
        frag.appendChild(el);
      });
      deco.appendChild(frag);
    });
  },

  // ===== LIGHTBOX =====
  showLightbox(url) {
    $('lightboxImg').src = url;
    $('lightbox').style.display = '';
  },
  hideLightbox() {
    $('lightbox').style.display = 'none';
    $('lightboxImg').src = '';
  },

  // ===== GALLERY VIEWER =====
  showGalleryViewer(id) {
    if (this.editMode) return;
    const gallery = this.store.data.gallery.slice().sort((a,b)=> (b.date||'') < (a.date||'') ? -1 : 1);
    this._gvList = gallery;
    this._gvIdx = gallery.findIndex(g => g.id === id);
    if (this._gvIdx === -1) { this.toast('未找到图片'); return; }
    this._renderGalleryViewer();
    $('galleryViewer').style.display = '';
  },

  showWorkGalleryViewer(id) {
    if (this.editMode) return;
    const works = this.store.data.works.filter(w => w.image).sort((a,b)=> a.order - b.order);
    if (!works.length) return;
    this._gvList = works;
    this._gvIdx = works.findIndex(w => w.id === id);
    if (this._gvIdx === -1) { this.toast('未找到图片'); return; }
    this._renderGalleryViewer();
    $('galleryViewer').style.display = '';
  },

  _renderGalleryViewer() {
    const g = this._gvList[this._gvIdx];
    if (!g) return;
    const image = g.image || g.url || '';
    $('gvImg').src = image;
    $('gvTitle').textContent = g.title || '';
    $('gvDate').textContent = g.date || '';
    $('gvDesc').textContent = g.desc || g.caption || '';
    $('gvTags').innerHTML = g.tags?.length ? g.tags.map(t=>`<span>${esc(t)}</span>`).join('') : '';
    $('gvLinks').innerHTML = g.links?.length ? g.links.map(l=>`<a href="${esc(l.url)}" target="_blank">🔗 ${esc(l.label)}</a>`).join('') : '';
    $('gvCounter').textContent = `${this._gvIdx + 1} / ${this._gvList.length}`;
    $('gvPrev').style.display = this._gvIdx > 0 ? '' : 'none';
    $('gvNext').style.display = this._gvIdx < this._gvList.length - 1 ? '' : 'none';
  },

  _gvNav(delta) {
    const idx = this._gvIdx + delta;
    if (idx < 0 || idx >= this._gvList.length) return;
    this._gvIdx = idx;
    this._renderGalleryViewer();
  },

  hideGalleryViewer() {
    $('galleryViewer').style.display = 'none';
    $('gvImg').src = '';
  },

  initTabVisibility() {
    this._originalTitle = document.title;
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        document.title = '你怎么走了喵？';
      } else {
        document.title = this._originalTitle;
      }
    });
    
    document.addEventListener('blur', () => {
      if (document.hidden) {
        document.title = '你怎么走了喵？';
      }
    });
    
    document.addEventListener('focus', () => {
      document.title = this._originalTitle;
    });
  },

  // ===== PAGES =====
  switchPage(name) {
    if (this._animating) return;
    const cur = document.querySelector('.page.active');
    if (!cur || cur.id === 'page-'+name) return;

    this._animating = true;

    // Swap pages instantly
    cur.classList.remove('active');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    const pg = $('page-'+name);
    if (pg) {
      pg.classList.add('active');
      pg.classList.add('page-enter');
    }

    // Update UI immediately (tabs, mobile menu)
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
    document.querySelectorAll('.mobile-tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
    this.closeMobileMenu();
    this.updateTabIndicator();

    // Enter animation cleanup + page-specific init
    setTimeout(() => {
      if (pg) pg.classList.remove('page-enter');
      this._animating = false;

      // Page-specific init AFTER transition
      if (name === 'gallery') {
        this.renderGallery();
        this.initPoetryCarousel();
      }
      if (name === 'about') this.renderAboutExtras();
      if (name === 'calendar') this.initCalendar();
      if (name === 'game2048') {
        if (!this._g2048Started) this.initGame2048();
        this._g2048BindEvents();
      }
    }, 200);
  },

  // ===== 2048 Game =====
  initGame2048() {
    this._g2048prevBest = this.store.data.g2048Best || 0;
    this._g2048board = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    this._g2048AddTile();
    this._g2048AddTile();
    this._g2048over = false;
    this._g2048score = 0;
    this._g2048running = false;
    this._g2048Started = true;
    if (this._g2048timerId) clearInterval(this._g2048timerId);
    this._g2048timerSec = 0;
    $('g2048-timer').textContent = '00:00';
    for (let i = 0; i < this._g2048milestones.length; i++) {
      this._g2048reached[this._g2048milestones[i]] = false;
    }
    $('g2048-best').textContent = this._g2048prevBest || '0';
    this._g2048ApplyTheme(this.store.data.g2048Theme || 'default');
    this._g2048InitThemeUI();
    this._g2048Draw();
    this._g2048BindEvents();
  },

  _g2048Blank() {
    return [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  },

  _g2048Fmt(s) {
    const m = Math.floor(s/60), sec = s%60;
    return (m<10?'0':'')+m+':'+(sec<10?'0':'')+sec;
  },

  _g2048AddTile() {
    const empty = [];
    for (let y=0; y<4; y++) for (let x=0; x<4; x++) {
      if (!this._g2048board[y][x]) empty.push({x,y});
    }
    if (!empty.length) return;
    const p = empty[Math.floor(Math.random()*empty.length)];
    this._g2048board[p.y][p.x] = Math.random()<0.9 ? 2 : 4;
  },

  _g2048Draw() {
    const boardEl = $('g2048-board');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let y=0; y<4; y++) for (let x=0; x<4; x++) {
      const c = document.createElement('div');
      c.className = 'cell';
      const val = this._g2048board[y][x];
      if (val) { c.textContent = val; c.classList.add('c-'+val); }
      boardEl.appendChild(c);
    }
    $('g2048-score').textContent = this._g2048score;
    $('g2048-best').textContent = this._g2048prevBest || '0';
  },

  _g2048PlayMerge(val) {
    if (!this._g2048actx) this._g2048actx = new (window.AudioContext||window.webkitAudioContext)();
    const osc = this._g2048actx.createOscillator();
    const gain = this._g2048actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300+Math.log2(val)*40, this._g2048actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600+Math.log2(val)*60, this._g2048actx.currentTime+0.12);
    gain.gain.setValueAtTime(0.18, this._g2048actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._g2048actx.currentTime+0.12);
    osc.connect(gain); gain.connect(this._g2048actx.destination);
    osc.start(); osc.stop(this._g2048actx.currentTime+0.12);
  },

  _g2048PlayMilestone() {
    if (!this._g2048actx) this._g2048actx = new (window.AudioContext||window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i=0; i<notes.length; i++) {
      const osc = this._g2048actx.createOscillator();
      const gain = this._g2048actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], this._g2048actx.currentTime+i*0.1);
      gain.gain.setValueAtTime(0.15, this._g2048actx.currentTime+i*0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this._g2048actx.currentTime+i*0.1+0.25);
      osc.connect(gain); gain.connect(this._g2048actx.destination);
      osc.start(this._g2048actx.currentTime+i*0.1);
      osc.stop(this._g2048actx.currentTime+i*0.1+0.25);
    }
  },

  _g2048Move(dir) {
    if (this._g2048over) return;
    let moved = false;
    const nb = this._g2048Blank();

    if (dir==='up' || dir==='down') {
      for (let x=0; x<4; x++) {
        let col = [];
        for (let y=0; y<4; y++) if (this._g2048board[y][x]) col.push(this._g2048board[y][x]);
        if (dir==='down') col.reverse();
        col = this._g2048Merge(col);
        if (dir==='down') col.reverse();
        for (let y=0; y<4; y++) { nb[y][x]=col[y]; if (nb[y][x]!==this._g2048board[y][x]) moved=true; }
      }
    } else {
      for (let y=0; y<4; y++) {
        let row = [];
        for (let x=0; x<4; x++) if (this._g2048board[y][x]) row.push(this._g2048board[y][x]);
        if (dir==='right') row.reverse();
        row = this._g2048Merge(row);
        if (dir==='right') row.reverse();
        for (let x=0; x<4; x++) { nb[y][x]=row[x]; if (nb[y][x]!==this._g2048board[y][x]) moved=true; }
      }
    }

    if (!moved) return;
    if (!this._g2048running) {
      this._g2048running = true;
      this._g2048timerId = setInterval(() => {
        this._g2048timerSec++;
        $('g2048-timer').textContent = this._g2048Fmt(this._g2048timerSec);
      }, 1000);
    }
    this._g2048board = nb;
    this._g2048AddTile();
    this._g2048Draw();
    this._g2048Check();
  },

  _g2048Merge(arr) {
    for (let i=0; i<arr.length-1; i++) {
      if (arr[i]===arr[i+1]) {
        const val = arr[i]*2;
        arr[i] = val;
        this._g2048score += val;
        arr.splice(i+1, 1);
        this._g2048PlayMerge(val);
        for (let m=0; m<this._g2048milestones.length; m++) {
          if (val>=this._g2048milestones[m] && !this._g2048reached[this._g2048milestones[m]]) {
            this._g2048reached[this._g2048milestones[m]] = true;
            this._g2048PlayMilestone();
            this.toast('🎉 达到 '+this._g2048milestones[m]+' 分！', 'success');
          }
        }
      }
    }
    while (arr.length < 4) arr.push(0);
    return arr;
  },

  _g2048Check() {
    for (let y=0; y<4; y++) for (let x=0; x<4; x++) if (!this._g2048board[y][x]) return;
    for (let y=0; y<4; y++) for (let x=0; x<4; x++) {
      if (x<3 && this._g2048board[y][x]===this._g2048board[y][x+1]) return;
      if (y<3 && this._g2048board[y][x]===this._g2048board[y+1][x]) return;
    }
    this._g2048over = true;
    if (this._g2048timerId) clearInterval(this._g2048timerId);
    const finalScore = this._g2048score;
    const isNewRecord = finalScore > this._g2048prevBest;
    if (isNewRecord) {
      this.store.data.g2048Best = finalScore;
      this.store.save();
      this._g2048prevBest = finalScore;
    }
    this._g2048ShowOverlay(finalScore, isNewRecord);
  },

  _g2048ShowOverlay(score, isNewRecord) {
    const oldOv = document.querySelector('.game2048-overlay');
    if (oldOv) oldOv.remove();

    const board = $('g2048-board');
    if (!board) return;
    const ov = document.createElement('div');
    ov.className = 'game2048-overlay show';
    ov.innerHTML =
      '<div class="game2048-overlay-box">'+
      '<div class="game2048-overlay-title">游戏结束 🎯</div>'+
      (isNewRecord ? '<div class="game2048-overlay-newrecord">🎉 新纪录！</div>' : '')+
      '<div class="game2048-overlay-score">得分：<strong>'+score+'</strong></div>'+
      '<div class="game2048-overlay-time">用时：'+this._g2048Fmt(this._g2048timerSec)+'</div>'+
      '<div class="game2048-overlay-best">🏆 最高分：'+this._g2048prevBest+'</div>'+
      '<button class="btn btn-p ripple" id="g2048-retryBtn">再来一局</button>'+
      '</div>';
    board.appendChild(ov);
    $('g2048-retryBtn').onclick = () => this.initGame2048();
  },

  _g2048ApplyTheme(theme) {
    this._g2048Theme = theme;
    const wrap = document.querySelector('.game2048-wrap');
    if (!wrap) return;
    // Remove all theme classes
    ['default','dark','forest','ocean','rose'].forEach(t => {
      wrap.classList.remove('g2048-theme-'+t);
    });
    wrap.classList.add('g2048-theme-'+theme);

    // Update dropdown active state
    document.querySelectorAll('.g2048-theme-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === theme);
    });

    // Persist
    this.store.data.g2048Theme = theme;
    this.store.save();
  },

  _g2048InitThemeUI() {
    if (this._g2048ThemeInited) return;

    // Theme button toggle
    const btn = $('g2048-themeBtn');
    const dd = $('g2048-themeDropdown');
    if (btn && dd) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dd.classList.toggle('show');
      });
      // Close on click outside
      document.addEventListener('click', () => dd.classList.remove('show'), { once: false });
      dd.addEventListener('click', (e) => e.stopPropagation());

      // Theme option clicks
      dd.querySelectorAll('.g2048-theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
          this._g2048ApplyTheme(opt.dataset.theme);
          dd.classList.remove('show');
        });
      });
    }

    this._g2048ThemeInited = true;
  },

  _g2048BindEvents() {
    // Keyboard — only when game2048 is active
    const handler = (e) => {
      if (!document.getElementById('page-game2048')?.classList.contains('active')) return;
      const map = {
        'w':'up','ArrowUp':'up',
        's':'down','ArrowDown':'down',
        'a':'left','ArrowLeft':'left',
        'd':'right','ArrowRight':'right'
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); this._g2048Move(dir); }
    };
    document.removeEventListener('keydown', this._g2048KeyHandler);
    this._g2048KeyHandler = handler;
    document.addEventListener('keydown', handler);

    // Touch swipe
    const boardEl = $('g2048-board');
    boardEl.removeEventListener('touchstart', this._g2048TouchHandler);
    let sx=0, sy=0;
    this._g2048TouchHandler = (e) => {
      if (e.type === 'touchstart') {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      } else if (e.type === 'touchend') {
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        if (Math.max(ax, ay) < 20) return;
        if (ax > ay) this._g2048Move(dx > 0 ? 'right' : 'left');
        else this._g2048Move(dy > 0 ? 'down' : 'up');
      }
    };
    boardEl.addEventListener('touchstart', this._g2048TouchHandler);
    boardEl.addEventListener('touchend', this._g2048TouchHandler);

    // New game button
    $('g2048-newBtn').onclick = () => this.initGame2048();

    // End game button
    $('g2048-endBtn').onclick = () => {
      if (this._g2048over || !this._g2048Started) return;
      this._g2048over = true;
      if (this._g2048timerId) clearInterval(this._g2048timerId);
      this._g2048running = false;
      const finalScore = this._g2048score;
      const isNewRecord = finalScore > this._g2048prevBest;
      if (isNewRecord) {
        this.store.data.g2048Best = finalScore;
        this.store.save();
        this._g2048prevBest = finalScore;
      }
      this._g2048ShowOverlay(finalScore, isNewRecord);
    };
  },

  closeMobileMenu() {
    const menu = $('mobileMenu');
    const toggle = $('menuToggle');
    if (menu && menu.classList.contains('show')) {
      menu.classList.remove('show');
      if (toggle) toggle.classList.remove('active');
      document.body.style.overflow = '';
      document.querySelector('html')?.classList.remove('no-scroll');
    }
  },

  updateTabIndicator() {
    const indicator = $('tabIndicator');
    const activeTab = document.querySelector('.tab.active');
    if (!indicator || !activeTab) return;
    indicator.style.left = activeTab.offsetLeft + 'px';
    indicator.style.width = activeTab.offsetWidth + 'px';
  },

  // ===== GAME SELECTOR =====
  bindGameNav() {
    document.querySelectorAll('.game-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        this.switchPage(page);
      });
    });
  },

  

  // ===== DINO GAME =====
  _dinoCanvas: null,
  _dinoCtx: null,
  _dinoScore: 0,
  _dinoHighscore: 0,
  _dinoRunning: false,
  _dinoPaused: false,
  
  _dinoX: 50,
  _dinoY: 130,
  _dinoWidth: 40,
  _dinoHeight: 50,
  _dinoVelocityY: 0,
  _dinoGravity: 0.5,
  _dinoJumpForce: -12,
  _dinoOnGround: true,
  
  _dinoObstacles: [],
  _dinoObstacleSpeed: 4,
  _dinoObstacleInterval: 2000,
  _dinoLastObstacle: 0,
  
  _dinoGroundY: 180,
  _dinoClouds: [],
  
  initDinoGame() {
    this._dinoCanvas = $('dinoCanvas');
    this._dinoCtx = this._dinoCanvas.getContext('2d');
    this._dinoCanvas.width = 500;
    this._dinoCanvas.height = 200;
    
    this._dinoHighscore = parseInt(localStorage.getItem('dino_highscore') || '0');
    $('dinoHighscore').textContent = this._dinoHighscore.toString();
    
    this.bindDinoEvents();
    this.dinoGameLoop();
  },

  resetDinoGame() {
    this._dinoScore = 0;
    this._dinoRunning = false;
    this._dinoPaused = false;
    this._dinoX = 50;
    this._dinoY = 130;
    this._dinoVelocityY = 0;
    this._dinoOnGround = true;
    this._dinoObstacles = [];
    this._dinoClouds = [];
    this._dinoObstacleSpeed = 4;
    $('dinoScore').textContent = '0';
    $('dinoOverlay').classList.remove('hidden');
  },

  bindDinoEvents() {
    const canvas = this._dinoCanvas;
    canvas.removeEventListener('click', this._dinoCanvasHandler);
    this._dinoCanvasHandler = () => {
      if (!this._dinoRunning) {
        this.startDinoGame();
      } else if (this._dinoOnGround) {
        this.dinoJump();
      }
    };
    canvas.addEventListener('click', this._dinoCanvasHandler);
    
    document.removeEventListener('keydown', this._dinoKeyHandler);
    this._dinoKeyHandler = (e) => {
      if (!document.querySelector('#page-dino.active')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this._dinoRunning) {
          this.startDinoGame();
        } else if (this._dinoOnGround) {
          this.dinoJump();
        }
      }
    };
    document.addEventListener('keydown', this._dinoKeyHandler);
    
    const helpBtn = $('dinoHelp');
    if (helpBtn) {
      helpBtn.removeEventListener('click', this._dinoHelpHandler);
      this._dinoHelpHandler = (e) => {
        e.stopPropagation();
        this.modal({
          title: '🦖 恐龙游戏教程',
          body: `
            <p style="line-height:1.8;margin-bottom:12px"><strong>🎯 游戏目标：</strong></p>
            <p style="line-height:1.8;font-size:0.9rem">躲避障碍物，尽可能跑得更远！</p>
            
            <p style="line-height:1.8;margin:16px 0 12px;font-weight:600"><strong>🎮 操作说明：</strong></p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>空格键</strong> 或 <strong>点击画布</strong> 跳跃</p>
            
            <p style="line-height:1.8;margin:16px 0 12px;font-weight:600"><strong>🌵 障碍物：</strong></p>
            <p style="line-height:1.8;font-size:0.9rem">• 仙人掌 - 从地面生长，需要跳跃躲避</p>
            <p style="line-height:1.8;font-size:0.9rem">• 飞鸟 - 在空中飞行，需要在恰当时机跳跃</p>
            
            <p style="line-height:1.8;margin:16px 0 12px;font-weight:600"><strong>💡 技巧提示：</strong></p>
            <p style="line-height:1.8;font-size:0.85rem">• 观察障碍物出现的节奏</p>
            <p style="line-height:1.8;font-size:0.85rem">• 尽量跳跃到空白区域</p>
            <p style="line-height:1.8;font-size:0.85rem">• 难度会随分数增加</p>
          `,
          footer: [{label:'开始游戏', cls:'btn-p'}]
        });
      };
      helpBtn.addEventListener('click', this._dinoHelpHandler);
    }
  },

  startDinoGame() {
    this._dinoRunning = true;
    $('dinoOverlay').classList.add('hidden');
    this._dinoLastObstacle = Date.now();
  },

  dinoJump() {
    if (this._dinoOnGround) {
      this._dinoVelocityY = this._dinoJumpForce;
      this._dinoOnGround = false;
    }
  },

  dinoGameLoop() {
    this.dinoUpdate();
    this.dinoRender();
    requestAnimationFrame(() => this.dinoGameLoop());
  },

  dinoUpdate() {
    if (!this._dinoRunning || this._dinoPaused) return;
    
    this._dinoScore++;
    $('dinoScore').textContent = this._dinoScore.toString();
    
    if (this._dinoScore > this._dinoHighscore) {
      this._dinoHighscore = this._dinoScore;
      localStorage.setItem('dino_highscore', this._dinoHighscore.toString());
      $('dinoHighscore').textContent = this._dinoHighscore.toString();
    }
    
    if (this._dinoScore % 500 === 0) {
      this._dinoObstacleSpeed += 0.5;
    }
    
    this._dinoVelocityY += this._dinoGravity;
    this._dinoY += this._dinoVelocityY;
    
    if (this._dinoY >= this._dinoGroundY - this._dinoHeight) {
      this._dinoY = this._dinoGroundY - this._dinoHeight;
      this._dinoVelocityY = 0;
      this._dinoOnGround = true;
    }
    
    const now = Date.now();
    if (now - this._dinoLastObstacle > this._dinoObstacleInterval) {
      this.dinoSpawnObstacle();
      this._dinoLastObstacle = now;
    }
    
    this._dinoObstacles.forEach(obs => {
      obs.x -= this._dinoObstacleSpeed;
    });
    
    this._dinoObstacles = this._dinoObstacles.filter(obs => obs.x > -50);
    
    if (now % 3000 < 100) {
      this._dinoClouds.push({
        x: 500,
        y: Math.random() * 60 + 20,
        size: Math.random() * 20 + 30
      });
    }
    
    this._dinoClouds.forEach(cloud => {
      cloud.x -= 0.5;
    });
    
    this._dinoClouds = this._dinoClouds.filter(cloud => cloud.x > -60);
    
    if (this.dinoCheckCollision()) {
      this.dinoGameOver();
    }
  },

  dinoSpawnObstacle() {
    const type = Math.random() < 0.7 ? 'cactus' : 'bird';
    const obstacle = {
      x: 500,
      type: type,
      width: type === 'cactus' ? 25 : 35,
      height: type === 'cactus' ? 40 : 25,
      y: type === 'cactus' ? this._dinoGroundY - 40 : this._dinoGroundY - 100 - Math.random() * 30
    };
    this._dinoObstacles.push(obstacle);
  },

  dinoCheckCollision() {
    const dinoRect = {
      x: this._dinoX + 5,
      y: this._dinoY + 5,
      width: this._dinoWidth - 10,
      height: this._dinoHeight - 5
    };
    
    for (const obs of this._dinoObstacles) {
      const obsRect = {
        x: obs.x + 5,
        y: obs.y + 5,
        width: obs.width - 10,
        height: obs.height - 5
      };
      
      if (this.dinoRectIntersect(dinoRect, obsRect)) {
        return true;
      }
    }
    return false;
  },

  dinoRectIntersect(r1, r2) {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
  },

  dinoGameOver() {
    this._dinoRunning = false;
    $('dinoOverlay').classList.remove('hidden');
    const overlayContent = $('dinoOverlay').querySelector('.dino-overlay-content');
    overlayContent.innerHTML = `
      <div class="dino-title">🦖 GAME OVER</div>
      <div class="dino-subtitle">得分: ${this._dinoScore}</div>
      <div class="dino-hint">按 空格键 或 点击 重新开始</div>
    `;
  },

  dinoRender() {
    this._dinoCtx.fillStyle = '#000';
    this._dinoCtx.fillRect(0, 0, 500, 200);
    
    this._dinoCtx.fillStyle = '#333';
    this._dinoCtx.fillRect(0, this._dinoGroundY, 500, 20);
    
    this._dinoCtx.fillStyle = '#fff';
    this._dinoCtx.fillRect(0, this._dinoGroundY + 20, 500, 2);
    
    this._dinoCtx.fillStyle = '#666';
    this._dinoClouds.forEach(cloud => {
      this.dinoDrawCloud(cloud.x, cloud.y, cloud.size);
    });
    
    this._dinoCtx.fillStyle = '#fff';
    this.dinoDrawDino(this._dinoX, this._dinoY);
    
    this._dinoCtx.fillStyle = '#fff';
    this._dinoObstacles.forEach(obs => {
      if (obs.type === 'cactus') {
        this.dinoDrawCactus(obs.x, obs.y);
      } else {
        this.dinoDrawBird(obs.x, obs.y);
      }
    });
  },

  dinoDrawDino(x, y) {
    this._dinoCtx.fillRect(x, y + 10, 20, 8);
    this._dinoCtx.fillRect(x + 5, y, 10, 15);
    this._dinoCtx.fillRect(x + 20, y + 5, 25, 35);
    this._dinoCtx.fillRect(x + 25, y + 40, 8, 10);
    this._dinoCtx.fillRect(x + 35, y + 40, 8, 10);
    this._dinoCtx.fillRect(x + 35, y + 15, 8, 15);
    this._dinoCtx.fillRect(x + 35, y + 10, 5, 5);
    this._dinoCtx.fillStyle = '#000';
    this._dinoCtx.fillRect(x + 37, y + 12, 2, 2);
    this._dinoCtx.fillStyle = '#fff';
  },

  dinoDrawCactus(x, y) {
    this._dinoCtx.fillRect(x + 5, y + 20, 8, 20);
    this._dinoCtx.fillRect(x, y + 10, 8, 15);
    this._dinoCtx.fillRect(x + 12, y + 5, 8, 15);
    this._dinoCtx.fillRect(x + 6, y, 6, 12);
  },

  dinoDrawBird(x, y) {
    this._dinoCtx.fillRect(x, y + 5, 25, 15);
    this._dinoCtx.fillRect(x + 20, y + 8, 15, 7);
    this._dinoCtx.fillRect(x - 5, y + 3, 8, 6);
    this._dinoCtx.fillStyle = '#000';
    this._dinoCtx.fillRect(x + 5, y + 8, 2, 2);
    this._dinoCtx.fillStyle = '#fff';
  },

  dinoDrawCloud(x, y, size) {
    this._dinoCtx.beginPath();
    this._dinoCtx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    this._dinoCtx.arc(x + size * 0.25, y - size * 0.1, size * 0.25, 0, Math.PI * 2);
    this._dinoCtx.arc(x + size * 0.5, y, size * 0.3, 0, Math.PI * 2);
    this._dinoCtx.arc(x + size * 0.25, y + size * 0.1, size * 0.2, 0, Math.PI * 2);
    this._dinoCtx.fill();
  },

  // ===== TETRIS GAME =====
  _tetrisCanvas: null,
  _tetrisCtx: null,
  _tetrisNextCanvas: null,
  _tetrisNextCtx: null,
  _tetrisBoard: [],
  _tetrisCurrentPiece: null,
  _tetrisNextPiece: null,
  _tetrisScore: 0,
  _tetrisLevel: 1,
  _tetrisLines: 0,
  _tetrisRunning: false,
  _tetrisPaused: false,
  
  _tetrisCOLS: 10,
  _tetrisROWS: 20,
  _tetrisCELL: 20,
  
  _tetrisSHAPES: [
    [[1,1,1,1]],
    [[1,1],[1,1]],
    [[1,1,0],[0,1,1]],
    [[0,1,1],[1,1,0]],
    [[1,1,1],[0,1,0]],
    [[1,1,1],[1,0,0]],
    [[1,1,1],[0,0,1]]
  ],
  
  _tetrisCOLORS: ['#00ffff', '#ffff00', '#ff00ff', '#00ff00', '#ff6b6b', '#4ecdc4', '#45b7d1'],

  resetTetrisGame() {
    this._tetrisScore = 0;
    this._tetrisLevel = 1;
    this._tetrisLines = 0;
    this._tetrisRunning = false;
    this._tetrisPaused = false;
    this._tetrisBoard = Array(this._tetrisROWS).fill(null).map(() => Array(this._tetrisCOLS).fill(0));
    this._tetrisCurrentPiece = null;
    this._tetrisNextPiece = null;
    $('tetrisScore').textContent = '0';
    $('tetrisLevel').textContent = '1';
    $('tetrisLines').textContent = '0';
    this.tetrisDrawBoard();
    this.tetrisDrawNext(null);
  },

  initTetrisGame() {
    this._tetrisCanvas = $('tetrisCanvas');
    this._tetrisCtx = this._tetrisCanvas.getContext('2d');
    this._tetrisCanvas.width = this._tetrisCOLS * this._tetrisCELL;
    this._tetrisCanvas.height = this._tetrisROWS * this._tetrisCELL;
    
    this._tetrisNextCanvas = $('tetrisNext');
    this._tetrisNextCtx = this._tetrisNextCanvas.getContext('2d');
    this._tetrisNextCanvas.width = 120;
    this._tetrisNextCanvas.height = 120;
    
    this.resetTetrisGame();
    this.bindTetrisEvents();
  },

  bindTetrisEvents() {
    const startBtn = $('tetrisStart');
    if (startBtn) {
      startBtn.removeEventListener('click', this._tetrisStartHandler);
      this._tetrisStartHandler = () => {
        if (!this._tetrisRunning) {
          this.startTetris();
        }
      };
      startBtn.addEventListener('click', this._tetrisStartHandler);
    }
    
    const pauseBtn = $('tetrisPause');
    if (pauseBtn) {
      pauseBtn.removeEventListener('click', this._tetrisPauseHandler);
      this._tetrisPauseHandler = () => {
        this._tetrisPaused = !this._tetrisPaused;
        pauseBtn.textContent = this._tetrisPaused ? '继续' : '暂停';
      };
      pauseBtn.addEventListener('click', this._tetrisPauseHandler);
    }
    
    const helpBtn = $('tetrisHelp');
    if (helpBtn) {
      helpBtn.removeEventListener('click', this._tetrisHelpHandler);
      this._tetrisHelpHandler = () => {
        this.modal({
          title: '🧱 俄罗斯方块教程',
          body: `
            <p style="line-height:1.8;margin-bottom:12px"><strong>🎯 游戏目标：</strong></p>
            <p style="line-height:1.8;font-size:0.9rem">消除完整行，获得更高分数！</p>
            
            <p style="line-height:1.8;margin:16px 0 12px;font-weight:600"><strong>🎮 操作说明：</strong></p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>←</strong> 向左移动</p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>→</strong> 向右移动</p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>↑</strong> 旋转方块</p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>↓</strong> 加速下落</p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>空格</strong> 直接落到底部</p>
            
            <p style="line-height:1.8;margin:16px 0 12px;font-weight:600"><strong>💡 技巧提示：</strong></p>
            <p style="line-height:1.8;font-size:0.85rem">• 尽量堆满整行再消除</p>
            <p style="line-height:1.8;font-size:0.85rem">• 不要让方块堆得太高</p>
            <p style="line-height:1.8;font-size:0.85rem">• 一次消除多行得分更高</p>
          `,
          footer: [{label:'开始游戏', cls:'btn-p'}]
        });
      };
      helpBtn.addEventListener('click', this._tetrisHelpHandler);
    }
    
    document.removeEventListener('keydown', this._tetrisKeyHandler);
    this._tetrisKeyHandler = (e) => {
      if (!document.querySelector('#page-tetris.active')) return;
      if (!this._tetrisRunning || this._tetrisPaused) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.tetrisMoveLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.tetrisMoveRight();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.tetrisMoveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.tetrisRotate();
          break;
        case ' ':
          e.preventDefault();
          this.tetrisHardDrop();
          break;
      }
    };
    document.addEventListener('keydown', this._tetrisKeyHandler);
  },

  startTetris() {
    this._tetrisRunning = true;
    this._tetrisBoard = Array(this._tetrisROWS).fill(null).map(() => Array(this._tetrisCOLS).fill(0));
    this._tetrisScore = 0;
    this._tetrisLevel = 1;
    this._tetrisLines = 0;
    this._tetrisCurrentPiece = this.tetrisCreatePiece();
    this._tetrisNextPiece = this.tetrisCreatePiece();
    this.tetrisDrawNext(this._tetrisNextPiece);
    this.tetrisGameLoop();
  },

  tetrisCreatePiece() {
    const shapeIndex = Math.floor(Math.random() * this._tetrisSHAPES.length);
    return {
      shape: this._tetrisSHAPES[shapeIndex],
      color: this._tetrisCOLORS[shapeIndex],
      x: Math.floor((this._tetrisCOLS - this._tetrisSHAPES[shapeIndex][0].length) / 2),
      y: 0
    };
  },

  tetrisGameLoop() {
    if (!this._tetrisRunning) return;
    
    if (!this._tetrisPaused) {
      setTimeout(() => {
        if (this._tetrisRunning && !this._tetrisPaused) {
          this.tetrisMoveDown();
        }
      }, Math.max(100, 1000 - (this._tetrisLevel - 1) * 100));
    }
    
    requestAnimationFrame(() => this.tetrisGameLoop());
  },

  tetrisMoveLeft() {
    this._tetrisCurrentPiece.x--;
    if (!this.tetrisIsValidPosition()) {
      this._tetrisCurrentPiece.x++;
    } else {
      this.tetrisDrawBoard();
    }
  },

  tetrisMoveRight() {
    this._tetrisCurrentPiece.x++;
    if (!this.tetrisIsValidPosition()) {
      this._tetrisCurrentPiece.x--;
    } else {
      this.tetrisDrawBoard();
    }
  },

  tetrisMoveDown() {
    this._tetrisCurrentPiece.y++;
    if (!this.tetrisIsValidPosition()) {
      this._tetrisCurrentPiece.y--;
      this.tetrisLockPiece();
      this.tetrisClearLines();
      this.tetrisSpawnPiece();
    } else {
      this.tetrisDrawBoard();
    }
  },

  tetrisHardDrop() {
    while (this.tetrisIsValidPosition()) {
      this._tetrisCurrentPiece.y++;
    }
    this._tetrisCurrentPiece.y--;
    this.tetrisLockPiece();
    this.tetrisClearLines();
    this.tetrisSpawnPiece();
  },

  tetrisRotate() {
    const shape = this._tetrisCurrentPiece.shape;
    const rotated = shape[0].map((_, i) => shape.map(row => row[i]).reverse());
    const oldShape = this._tetrisCurrentPiece.shape;
    this._tetrisCurrentPiece.shape = rotated;
    
    if (!this.tetrisIsValidPosition()) {
      this._tetrisCurrentPiece.shape = oldShape;
    } else {
      this.tetrisDrawBoard();
    }
  },

  tetrisIsValidPosition() {
    const piece = this._tetrisCurrentPiece;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardX = piece.x + x;
          const boardY = piece.y + y;
          if (boardX < 0 || boardX >= this._tetrisCOLS || boardY >= this._tetrisROWS) {
            return false;
          }
          if (boardY >= 0 && this._tetrisBoard[boardY][boardX]) {
            return false;
          }
        }
      }
    }
    return true;
  },

  tetrisLockPiece() {
    const piece = this._tetrisCurrentPiece;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardY = piece.y + y;
          const boardX = piece.x + x;
          if (boardY >= 0) {
            this._tetrisBoard[boardY][boardX] = piece.color;
          }
        }
      }
    }
  },

  tetrisClearLines() {
    let cleared = 0;
    for (let y = this._tetrisROWS - 1; y >= 0; y--) {
      if (this._tetrisBoard[y].every(cell => cell !== 0)) {
        this._tetrisBoard.splice(y, 1);
        this._tetrisBoard.unshift(Array(this._tetrisCOLS).fill(0));
        cleared++;
        y++;
      }
    }
    
    if (cleared > 0) {
      this._tetrisLines += cleared;
      this._tetrisScore += cleared * 100 * this._tetrisLevel;
      this._tetrisLevel = Math.floor(this._tetrisLines / 10) + 1;
      $('tetrisScore').textContent = this._tetrisScore.toString();
      $('tetrisLevel').textContent = this._tetrisLevel.toString();
      $('tetrisLines').textContent = this._tetrisLines.toString();
    }
  },

  tetrisSpawnPiece() {
    this._tetrisCurrentPiece = this._tetrisNextPiece;
    this._tetrisNextPiece = this.tetrisCreatePiece();
    this.tetrisDrawNext(this._tetrisNextPiece);
    
    if (!this.tetrisIsValidPosition()) {
      this.tetrisGameOver();
    } else {
      this.tetrisDrawBoard();
    }
  },

  tetrisGameOver() {
    this._tetrisRunning = false;
    this.modal({
      title: '🧱 GAME OVER',
      body: `<p>得分: ${this._tetrisScore}</p><p>等级: ${this._tetrisLevel}</p><p>消除行数: ${this._tetrisLines}</p>`,
      footer: [{label: '再来一局', cls: 'btn-p'}]
    });
  },

  tetrisDrawBoard() {
    this._tetrisCtx.fillStyle = '#0a0a0a';
    this._tetrisCtx.fillRect(0, 0, this._tetrisCanvas.width, this._tetrisCanvas.height);
    
    for (let y = 0; y < this._tetrisROWS; y++) {
      for (let x = 0; x < this._tetrisCOLS; x++) {
        if (this._tetrisBoard[y][x]) {
          this.tetrisDrawCell(x, y, this._tetrisBoard[y][x]);
        }
      }
    }
    
    const piece = this._tetrisCurrentPiece;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          this.tetrisDrawCell(piece.x + x, piece.y + y, piece.color);
        }
      }
    }
    
    this._tetrisCtx.strokeStyle = '#333';
    for (let y = 0; y <= this._tetrisROWS; y++) {
      this._tetrisCtx.beginPath();
      this._tetrisCtx.moveTo(0, y * this._tetrisCELL);
      this._tetrisCtx.lineTo(this._tetrisCanvas.width, y * this._tetrisCELL);
      this._tetrisCtx.stroke();
    }
    for (let x = 0; x <= this._tetrisCOLS; x++) {
      this._tetrisCtx.beginPath();
      this._tetrisCtx.moveTo(x * this._tetrisCELL, 0);
      this._tetrisCtx.lineTo(x * this._tetrisCELL, this._tetrisCanvas.height);
      this._tetrisCtx.stroke();
    }
  },

  tetrisDrawCell(x, y, color) {
    this._tetrisCtx.fillStyle = color;
    this._tetrisCtx.fillRect(x * this._tetrisCELL + 1, y * this._tetrisCELL + 1, this._tetrisCELL - 2, this._tetrisCELL - 2);
    this._tetrisCtx.shadowColor = color;
    this._tetrisCtx.shadowBlur = 10;
    this._tetrisCtx.fillRect(x * this._tetrisCELL + 1, y * this._tetrisCELL + 1, this._tetrisCELL - 2, this._tetrisCELL - 2);
    this._tetrisCtx.shadowBlur = 0;
  },

  tetrisDrawNext(piece) {
    this._tetrisNextCtx.fillStyle = '#0a0a0a';
    this._tetrisNextCtx.fillRect(0, 0, 120, 120);
    
    if (!piece) return;
    
    const offsetX = (120 - piece.shape[0].length * 24) / 2;
    const offsetY = (120 - piece.shape.length * 24) / 2;
    
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          this._tetrisNextCtx.fillStyle = piece.color;
          this._tetrisNextCtx.shadowColor = piece.color;
          this._tetrisNextCtx.shadowBlur = 10;
          this._tetrisNextCtx.fillRect(offsetX + x * 24 + 2, offsetY + y * 24 + 2, 20, 20);
          this._tetrisNextCtx.shadowBlur = 0;
        }
      }
    }
  },

  // ===== BREAKOUT GAME =====
  _breakoutCanvas: null,
  _breakoutCtx: null,
  _breakoutScore: 0,
  _breakoutLives: 3,
  _breakoutRunning: false,
  
  _breakoutBall: { x: 200, y: 250, dx: 4, dy: -4, radius: 6 },
  _breakoutPaddle: { x: 150, y: 280, width: 100, height: 10 },
  _breakoutBricks: [],
  _breakoutParticles: [],
  
  _breakoutCOLS: 10,
  _breakoutROWS: 5,
  _breakoutBRICK_WIDTH: 35,
  _breakoutBRICK_HEIGHT: 15,
  _breakoutBRICK_PADDING: 5,
  _breakoutBRICK_OFFSET_TOP: 30,
  _breakoutBRICK_OFFSET_LEFT: 10,

  _breakoutCOLORS: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'],

  resetBreakoutGame() {
    this._breakoutScore = 0;
    this._breakoutLives = 3;
    this._breakoutRunning = false;
    this._breakoutParticles = [];
    $('breakoutScore').textContent = '0';
    $('breakoutLives').textContent = '3';
    this.initBreakoutBricks();
    this._breakoutBall = { x: 200, y: 250, dx: 4, dy: -4, radius: 6 };
    this._breakoutPaddle = { x: 150, y: 280, width: 100, height: 10 };
    $('breakoutOverlay').classList.remove('hidden');
    this.breakoutUpdateOverlay('breakout');
    this.breakoutDraw();
  },

  initBreakoutGame() {
    this._breakoutCanvas = $('breakoutCanvas');
    if (!this._breakoutCanvas) return;
    this._breakoutCtx = this._breakoutCanvas.getContext('2d');
    this._breakoutCanvas.width = 400;
    this._breakoutCanvas.height = 300;
    
    this.initBreakoutBricks();
    this.bindBreakoutEvents();
    this.breakoutUpdateOverlay('start');
    this.breakoutDraw();
  },

  breakoutUpdateOverlay(type) {
    const overlay = $('breakoutOverlay');
    if (!overlay) return;
    
    const content = overlay.querySelector('.breakout-overlay-content');
    if (!content) return;
    
    if (type === 'start') {
      content.innerHTML = `
        <div class="breakout-title">🎯 BREAKOUT</div>
        <div class="breakout-subtitle">按 空格键 或 点击 开始</div>
        <div class="breakout-hint">← → 移动挡板 · 击碎所有砖块</div>
      `;
    }
  },

  initBreakoutBricks() {
    this._breakoutBricks = [];
    for (let row = 0; row < this._breakoutROWS; row++) {
      for (let col = 0; col < this._breakoutCOLS; col++) {
        this._breakoutBricks.push({
          x: col * (this._breakoutBRICK_WIDTH + this._breakoutBRICK_PADDING) + this._breakoutBRICK_OFFSET_LEFT,
          y: row * (this._breakoutBRICK_HEIGHT + this._breakoutBRICK_PADDING) + this._breakoutBRICK_OFFSET_TOP,
          width: this._breakoutBRICK_WIDTH,
          height: this._breakoutBRICK_HEIGHT,
          color: this._breakoutCOLORS[row],
          visible: true
        });
      }
    }
  },

  bindBreakoutEvents() {
    const canvas = this._breakoutCanvas;
    if (!canvas) return;
    
    canvas.removeEventListener('click', this._breakoutCanvasHandler);
    this._breakoutCanvasHandler = () => {
      if (!this._breakoutRunning) {
        this.startBreakout();
      }
    };
    canvas.addEventListener('click', this._breakoutCanvasHandler);
    
    const overlay = $('breakoutOverlay');
    if (overlay) {
      overlay.removeEventListener('click', this._breakoutOverlayHandler);
      this._breakoutOverlayHandler = () => {
        if (!this._breakoutRunning) {
          this.startBreakout();
        }
      };
      overlay.addEventListener('click', this._breakoutOverlayHandler);
    }
    
    document.removeEventListener('keydown', this._breakoutKeyHandler);
    this._breakoutKeyHandler = (e) => {
      if (!document.querySelector('#page-breakout.active')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this._breakoutRunning) {
          this.startBreakout();
        }
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (this._breakoutRunning) {
          this._breakoutPaddle.x -= 30;
          if (this._breakoutPaddle.x < 0) this._breakoutPaddle.x = 0;
        }
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (this._breakoutRunning) {
          this._breakoutPaddle.x += 30;
          if (this._breakoutPaddle.x > 400 - this._breakoutPaddle.width) {
            this._breakoutPaddle.x = 400 - this._breakoutPaddle.width;
          }
        }
      }
    };
    document.addEventListener('keydown', this._breakoutKeyHandler);
    
    const helpBtn = $('breakoutHelp');
    if (helpBtn) {
      helpBtn.removeEventListener('click', this._breakoutHelpHandler);
      this._breakoutHelpHandler = (e) => {
        e.stopPropagation();
        this.modal({
          title: '🎯 打砖块游戏教程',
          body: `
            <p style="line-height:1.8;margin-bottom:12px"><strong>🎯 游戏目标：</strong></p>
            <p style="line-height:1.8;font-size:0.9rem">用挡板反弹球，击碎所有砖块！</p>
            
            <p style="line-height:1.8;margin:16px 0 12px;font-weight:600"><strong>🎮 操作说明：</strong></p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>空格键</strong> 或 <strong>点击</strong> 开始游戏</p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>←</strong> 向左移动挡板</p>
            <p style="line-height:1.8;font-size:0.9rem"><strong>→</strong> 向右移动挡板</p>
            
            <p style="line-height:1.8;margin:16px 0 12px;font-weight:600"><strong>💡 技巧提示：</strong></p>
            <p style="line-height:1.8;font-size:0.85rem">• 控制挡板击球角度</p>
            <p style="line-height:1.8;font-size:0.85rem">• 击中砖块中间会垂直反弹</p>
            <p style="line-height:1.8;font-size:0.85rem">• 击中边缘会产生斜向反弹</p>
            <p style="line-height:1.8;font-size:0.85rem">• 每击碎一个砖块得10分</p>
          `,
          footer: [{label:'开始游戏', cls:'btn-p'}]
        });
      };
      helpBtn.addEventListener('click', this._breakoutHelpHandler);
    }
  },

  startBreakout() {
    this._breakoutRunning = true;
    $('breakoutOverlay').classList.add('hidden');
    this.breakoutGameLoop();
  },

  breakoutGameLoop() {
    if (!this._breakoutRunning) return;
    
    this.breakoutUpdate();
    this.breakoutDraw();
    
    requestAnimationFrame(() => this.breakoutGameLoop());
  },

  breakoutUpdate() {
    this._breakoutBall.x += this._breakoutBall.dx;
    this._breakoutBall.y += this._breakoutBall.dy;
    
    if (this._breakoutBall.x - this._breakoutBall.radius <= 0 || 
        this._breakoutBall.x + this._breakoutBall.radius >= 400) {
      this._breakoutBall.dx = -this._breakoutBall.dx;
    }
    
    if (this._breakoutBall.y - this._breakoutBall.radius <= 0) {
      this._breakoutBall.dy = -this._breakoutBall.dy;
    }
    
    if (this._breakoutBall.y + this._breakoutBall.radius >= 300) {
      this._breakoutLives--;
      $('breakoutLives').textContent = this._breakoutLives.toString();
      
      if (this._breakoutLives <= 0) {
        this.breakoutGameOver();
        return;
      }
      
      this._breakoutBall = { x: 200, y: 250, dx: 4, dy: -4, radius: 6 };
      this._breakoutPaddle = { x: 150, y: 280, width: 100, height: 10 };
    }
    
    if (this._breakoutBall.y + this._breakoutBall.radius >= this._breakoutPaddle.y &&
        this._breakoutBall.x >= this._breakoutPaddle.x &&
        this._breakoutBall.x <= this._breakoutPaddle.x + this._breakoutPaddle.width) {
      this._breakoutBall.dy = -Math.abs(this._breakoutBall.dy);
      const hitPos = (this._breakoutBall.x - this._breakoutPaddle.x) / this._breakoutPaddle.width;
      this._breakoutBall.dx = (hitPos - 0.5) * 8;
    }
    
    for (let brick of this._breakoutBricks) {
      if (!brick.visible) continue;
      
      if (this._breakoutBall.x + this._breakoutBall.radius > brick.x &&
          this._breakoutBall.x - this._breakoutBall.radius < brick.x + brick.width &&
          this._breakoutBall.y + this._breakoutBall.radius > brick.y &&
          this._breakoutBall.y - this._breakoutBall.radius < brick.y + brick.height) {
        
        brick.visible = false;
        this._breakoutScore += 10;
        $('breakoutScore').textContent = this._breakoutScore.toString();
        
        this._breakoutBall.dy = -this._breakoutBall.dy;
        
        for (let i = 0; i < 8; i++) {
          this._breakoutParticles.push({
            x: this._breakoutBall.x,
            y: this._breakoutBall.y,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            color: brick.color,
            life: 1
          });
        }
        
        break;
      }
    }
    
    this._breakoutParticles = this._breakoutParticles.filter(p => {
      p.x += p.dx;
      p.y += p.dy;
      p.life -= 0.02;
      return p.life > 0;
    });
    
    if (this._breakoutBricks.every(b => !b.visible)) {
      this.breakoutWin();
    }
  },

  breakoutGameOver() {
    this._breakoutRunning = false;
    const overlay = $('breakoutOverlay');
    overlay.classList.remove('hidden');
    const content = overlay.querySelector('.breakout-overlay-content');
    content.innerHTML = `
      <div class="breakout-title">💔 GAME OVER</div>
      <div class="breakout-subtitle">得分: ${this._breakoutScore}</div>
      <div class="breakout-hint">按 空格键 或 点击 重新开始</div>
    `;
  },

  breakoutWin() {
    this._breakoutRunning = false;
    const overlay = $('breakoutOverlay');
    overlay.classList.remove('hidden');
    const content = overlay.querySelector('.breakout-overlay-content');
    content.innerHTML = `
      <div class="breakout-title" style="color:#4ecdc4">🎉 WIN!</div>
      <div class="breakout-subtitle">得分: ${this._breakoutScore}</div>
      <div class="breakout-hint">按 空格键 或 点击 再玩一次</div>
    `;
  },

  breakoutDraw() {
    this._breakoutCtx.fillStyle = '#0a0a0a';
    this._breakoutCtx.fillRect(0, 0, 400, 300);
    
    for (let brick of this._breakoutBricks) {
      if (!brick.visible) continue;
      
      this._breakoutCtx.fillStyle = brick.color;
      this._breakoutCtx.shadowColor = brick.color;
      this._breakoutCtx.shadowBlur = 15;
      this._breakoutCtx.fillRect(brick.x, brick.y, brick.width, brick.height);
      this._breakoutCtx.shadowBlur = 0;
      
      this._breakoutCtx.fillStyle = 'rgba(255,255,255,0.3)';
      this._breakoutCtx.fillRect(brick.x, brick.y, brick.width, 3);
    }
    
    this._breakoutCtx.fillStyle = '#ff6b6b';
    this._breakoutCtx.shadowColor = '#ff6b6b';
    this._breakoutCtx.shadowBlur = 15;
    this._breakoutCtx.fillRect(this._breakoutPaddle.x, this._breakoutPaddle.y, this._breakoutPaddle.width, this._breakoutPaddle.height);
    this._breakoutCtx.shadowBlur = 0;
    
    this._breakoutCtx.beginPath();
    this._breakoutCtx.arc(this._breakoutBall.x, this._breakoutBall.y, this._breakoutBall.radius, 0, Math.PI * 2);
    this._breakoutCtx.fillStyle = '#fff';
    this._breakoutCtx.shadowColor = '#fff';
    this._breakoutCtx.shadowBlur = 20;
    this._breakoutCtx.fill();
    this._breakoutCtx.shadowBlur = 0;
    
    for (let p of this._breakoutParticles) {
      this._breakoutCtx.beginPath();
      this._breakoutCtx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
      this._breakoutCtx.fillStyle = p.color;
      this._breakoutCtx.globalAlpha = p.life;
      this._breakoutCtx.fill();
      this._breakoutCtx.globalAlpha = 1;
    }
  },

  // ===== CALENDAR =====
  _calYear: new Date().getFullYear(),
  _calMonth: new Date().getMonth(),
  _calSelectedDate: null,
  _calMoods: {},
  _calTodos: [],

  initCalendar() {
    this.loadCalendarData();
    this.renderCalendar();
    this.bindCalendarEvents();
    this.updateTodoDateDisplay();
  },

  loadCalendarData() {
    const saved = localStorage.getItem('calendar_data');
    if (saved) {
      const data = JSON.parse(saved);
      this._calMoods = data.moods || {};
      this._calTodos = data.todos || [];
    }
  },

  saveCalendarData() {
    localStorage.setItem('calendar_data', JSON.stringify({
      moods: this._calMoods,
      todos: this._calTodos
    }));
  },

  renderCalendar() {
    const year = this._calYear;
    const month = this._calMonth;
    
    $('calTitle').textContent = `${year}年${month + 1}月`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    let html = '';
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      html += this.renderCalendarDay(day, true, dateKey);
    }
    
    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      html += this.renderCalendarDay(day, false, dateKey, isToday);
    }
    
    // Next month days
    const remaining = 42 - (firstDay + daysInMonth);
    for (let day = 1; day <= remaining; day++) {
      const dateKey = `${year}-${String(month + 2).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      html += this.renderCalendarDay(day, true, dateKey);
    }
    
    $('calendarGrid').innerHTML = html;
    this.renderTodoList();
  },

  renderCalendarDay(day, isOtherMonth, dateKey, isToday = false) {
    const mood = this._calMoods[dateKey];
    const moodEmoji = this.getMoodEmoji(mood);
    const isSelected = this._calSelectedDate === dateKey;
    
    let classes = 'calendar-day';
    if (isOtherMonth) classes += ' other-month';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    if (mood) classes += ' has-mood';
    
    return `
      <div class="${classes}" data-date="${dateKey}">
        ${day}
        ${moodEmoji ? `<span class="mood-indicator">${moodEmoji}</span>` : ''}
      </div>
    `;
  },

  getMoodEmoji(mood) {
    const emojis = {
      happy: '😄',
      good: '😊',
      neutral: '😐',
      sad: '😔',
      angry: '😠'
    };
    return emojis[mood] || '';
  },

  renderTodoList() {
    const list = $('todoList');
    if (this._calTodos.length === 0) {
      list.innerHTML = '<div class="empty-todo">暂无待办事项 ✨</div>';
      return;
    }
    
    list.innerHTML = this._calTodos.map((todo, index) => {
      const dateStr = todo.date ? this.formatDateLabel(todo.date) : '';
      return `
      <div class="todo-item ${todo.completed ? 'completed' : ''}" data-index="${index}">
        <div class="todo-checkbox ${todo.completed ? 'checked' : ''}"></div>
        <div class="todo-content">
          <span class="todo-text">${esc(todo.text)}</span>
          ${dateStr ? `<span class="todo-date">${dateStr}</span>` : ''}
        </div>
        <button class="todo-delete">✕</button>
      </div>
    `}).join('');
  },

  formatDateLabel(dateStr) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    if (dateStr === today) return '今天';
    if (dateStr === tomorrow) return '明天';
    
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  },

  addTodo(text) {
    if (!text.trim()) return;
    this._calTodos.push({
      id: Date.now(),
      text: text.trim(),
      completed: false,
      date: this._calSelectedDate || new Date().toISOString().split('T')[0]
    });
    this.saveCalendarData();
    this.renderTodoList();
  },

  toggleTodo(index) {
    this._calTodos[index].completed = !this._calTodos[index].completed;
    this.saveCalendarData();
    this.renderTodoList();
  },

  deleteTodo(index) {
    this._calTodos.splice(index, 1);
    this.saveCalendarData();
    this.renderTodoList();
  },

  setMood(dateKey, mood) {
    if (mood) {
      this._calMoods[dateKey] = mood;
    } else {
      delete this._calMoods[dateKey];
    }
    this.saveCalendarData();
    this.renderCalendar();
  },

  prevMonth() {
    if (this._calMonth === 0) {
      this._calMonth = 11;
      this._calYear--;
    } else {
      this._calMonth--;
    }
    this.renderCalendar();
  },

  nextMonth() {
    if (this._calMonth === 11) {
      this._calMonth = 0;
      this._calYear++;
    } else {
      this._calMonth++;
    }
    this.renderCalendar();
  },

  selectDate(dateKey) {
    this._calSelectedDate = dateKey;
    this.renderCalendar();
    this.updateTodoDateDisplay();
  },

  updateTodoDateDisplay() {
    const display = $('todoSelectedDate');
    if (!display) return;
    
    if (this._calSelectedDate) {
      display.textContent = `📅 ${this.formatDateLabel(this._calSelectedDate)}`;
    } else {
      display.textContent = '📅 今天';
    }
  },

  bindCalendarEvents() {
    $('calPrev')?.addEventListener('click', () => this.prevMonth());
    $('calNext')?.addEventListener('click', () => this.nextMonth());

    $('calendarGrid')?.addEventListener('click', (e) => {
      const day = e.target.closest('.calendar-day');
      if (day) {
        this.selectDate(day.dataset.date);
      }
    });

    document.querySelectorAll('.mood-card').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this._calSelectedDate) {
          this.toast('请先选择日期');
          return;
        }
        document.querySelectorAll('.mood-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setMood(this._calSelectedDate, btn.dataset.mood);
      });
    });

    $('todoInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.addTodo(e.target.value);
        e.target.value = '';
      }
    });

    $('todoList')?.addEventListener('click', (e) => {
      const checkbox = e.target.closest('.todo-checkbox');
      const deleteBtn = e.target.closest('.todo-delete');
      const item = e.target.closest('.todo-item');
      
      if (!item) return;
      const index = parseInt(item.dataset.index);
      
      if (checkbox) {
        this.toggleTodo(index);
      } else if (deleteBtn) {
        this.deleteTodo(index);
      }
    });
  },

  // ===== EVENTS =====
  bind() {
    // Tab switching
    $('tabs').addEventListener('click', e=>{
      const tab = e.target.closest('.tab');
      if (tab) this.switchPage(tab.dataset.page);
    });

    // Theme
    $('themeBtn').addEventListener('click', ()=>this.toggleTheme());

    // Backup
    $('backupBtn').addEventListener('click', ()=>this.showBackupModal());

    // Back to top
    const backToTop = $('backToTop');
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('resize', ()=>this.updateTabIndicator());

    // Edit mode (password protected)
    $('editBtn').addEventListener('click', ()=>this.tryToggleEdit());

    // Mobile menu - click items auto close
    $('menuToggle')?.addEventListener('click', ()=>this.toggleMobileMenu());
    $('mobileMenuClose')?.addEventListener('click', ()=>this.toggleMobileMenu());
    document.querySelectorAll('.mobile-tab').forEach(tab => {
      tab.addEventListener('click', ()=>{
        if (tab.dataset.page) {
          this.switchPage(tab.dataset.page);
        } else {
          this.closeMobileMenu();
        }
      });
    });
    $('mobileEditBtn')?.addEventListener('click', ()=>{
      this.tryToggleEdit();
      this.closeMobileMenu();
    });
    $('mobileThemeBtn')?.addEventListener('click', ()=>{
      this.toggleTheme();
      this.closeMobileMenu();
    });

    // Password modal
    $('pwConfirm').addEventListener('click', ()=>this.checkPw());
    $('pwInput').addEventListener('keydown', e=>{ if (e.key==='Enter') this.checkPw(); });
    document.querySelectorAll('.pw-close').forEach(b=>b.addEventListener('click',()=>$('pwModal').style.display='none'));

    // Close password modal on overlay click
    $('pwModal').addEventListener('click', e=>{ if(e.target===e.currentTarget) $('pwModal').style.display='none'; });

    // Poetry carousel navigation
    $('poetryPrev').addEventListener('click', ()=>this.poetryNav(-1));
    $('poetryNext').addEventListener('click', ()=>this.poetryNav(1));

    // Delegated clicks
    document.addEventListener('click', e=>{
      const t=e.target;

      // FAB
      if (t.closest('#fab')) {
        if (!this.editMode) return;
        $('fab').classList.toggle('open');
        $('fabM').classList.toggle('open');
        return;
      }

      // FAB options
      const fo = t.closest('.fab-m button');
      if (fo) {
        $('fab').classList.remove('open'); $('fabM').classList.remove('open');
        if (fo.dataset.type==='work') this.modalWork();
        else if (fo.dataset.type==='article') this.modalArticle();
        else if (fo.dataset.type==='gallery') this.modalGalleryImage();
        return;
      }

      // Actions
      const act = t.closest('[data-act]');
      if (act) {
        const id = act.dataset.id;
        if (act.dataset.act==='ew') { this.modalWork(id); return; }
        if (act.dataset.act==='dw') { this.delWork(id); return; }
        if (act.dataset.act==='fw') { this.toggleFeaturedWork(id); return; }
        if (act.dataset.act==='ea') { this.modalArticle(id); return; }
        if (act.dataset.act==='da') { this.delArticle(id); return; }
        if (act.dataset.act==='fa') { this.toggleFeaturedArticle(id); return; }
        if (act.dataset.act==='eg') { this.modalGalleryImage(id); return; }
        if (act.dataset.act==='dg') { this.delGalleryImage(id); return; }
      }

      // Add placeholder
      if (t.closest('#wAdd')) { this.modalWork(); return; }
      if (t.closest('#aAdd')) { this.modalArticle(); return; }
      if (t.closest('#gAdd')) { this.modalGalleryImage(); return; }

      // Image click → gallery viewer (non-edit mode)
      const imgEl = t.closest('.w-card-img');
      if (imgEl && !this.editMode) {
        const card = imgEl.closest('.w-card');
        if (card) {
          if (card.classList.contains('g-card')) {
            this.showGalleryViewer(card.dataset.id); return;
          }
          this.showWorkGalleryViewer(card.dataset.id); return;
        }
        return;
      }

      // Card → detail (non-edit mode)
      const wc = t.closest('.w-card');
      if (wc && !this.editMode && !t.closest('.w-card-btn') && !t.closest('.w-link') && !t.closest('.w-card-desc') && !t.closest('.w-card-img')) {
        if (wc.classList.contains('g-card')) { this.showGalleryViewer(wc.dataset.id); return; }
        this.showWorkDetail(wc.dataset.id); return;
      }
      const ai = t.closest('.a-item');
      if (ai && !this.editMode && !t.closest('.a-btn') && !t.closest('.a-ext-link')) {
        this.showArticleDetail(ai.dataset.id); return;
      }

      // Timeline edit/del
      const te = t.closest('.tl-edit');
      if (te) { this.modalTimelineItem(te.dataset.tlId); return; }
      const td = t.closest('.tl-del');
      if (td) {
        if (!confirm('确认删除？')) return;
        const id = td.dataset.tlId;
        this.store.data.experience = this.store.data.experience.filter(x=>x.id!==id);
        this.store.data.education = this.store.data.education.filter(x=>x.id!==id);
        this.store.save(); this.renderAboutExtras(); this.toast('已删除');
        return;
      }

      // Quotes edit
      if (t.closest('#qEdit')) { this.modalQuotes(); return; }
      if (t.closest('#tlAdd')) { this.modalTimelineItem(null); return; }


      // Home preview → detail
      const hpw = t.closest('.hp-work');
      if (hpw) {
        const wid = hpw.dataset.id;
        if (wid) { this.switchPage('works'); this.showWorkDetail(wid); }
        return;
      }
      const hpa = t.closest('.hp-article');
      if (hpa) {
        const aid = hpa.dataset.id;
        if (aid) { this.switchPage('articles'); this.showArticleDetail(aid); }
        return;
      }

      // Expand description
      const dc = t.closest('.w-card-desc');
      if (dc) { dc.classList.toggle('expanded'); return; }
    });

    // Filter clicks
    document.addEventListener('click', e=>{
      const wb = e.target.closest('#wFilter .filter-btn');
      if (wb) { this.activeTag = wb.dataset.filter; this.renderWorks(); return; }
      const ab = e.target.closest('#aFilter .filter-btn');
      if (ab) { this.activeCategory = ab.dataset.filter; this.renderArticles(); }
    });

    // Search inputs
    $('wSearch').addEventListener('input', e=>{ this.searchWorks=e.target.value; this.renderWorks(); });
    $('aSearch').addEventListener('input', e=>{ this.searchArticles=e.target.value; this.renderArticles(); });
    // Drag & Drop — Works
    (()=>{
      const g = $('wGrid');
      let d = null;
      g.addEventListener('dragstart', e=>{
        if (!this.editMode) return;
        const c = e.target.closest('.w-card'); if(!c) return;
        d = c.dataset.id; c.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d);
      });
      g.addEventListener('dragover', e=>{ if(d) e.preventDefault(); });
      g.addEventListener('dragenter', e=>{
        e.preventDefault(); if(!d) return;
        const c = e.target.closest('.w-card');
        if(c && c.dataset.id !== d) c.classList.add('drag-over');
      });
      g.addEventListener('dragleave', e=>{
        const c = e.target.closest('.w-card');
        if(c && (!e.relatedTarget || !c.contains(e.relatedTarget))) c.classList.remove('drag-over');
      });
      g.addEventListener('drop', e=>{
        e.preventDefault(); if(!d) return;
        const t = e.target.closest('.w-card'); if(!t || t.dataset.id === d) return;
        const ws = this.store.data.works;
        const fi = ws.findIndex(w=>w.id===d), ti = ws.findIndex(w=>w.id===t.dataset.id);
        if(fi===-1 || ti===-1) return;
        const [it] = ws.splice(fi,1); ws.splice(fi<ti?ti-1:ti,0,it);
        ws.forEach((w,i)=>w.order=i); this.store.save(); this.renderWorks();
      });
      g.addEventListener('dragend', ()=>{
        d = null; document.querySelectorAll('.w-card.dragging,.w-card.drag-over').forEach(c=>c.classList.remove('dragging','drag-over'));
      });
    })();

    // Drag & Drop — Articles
    (()=>{
      const l = $('aList');
      let d = null;
      l.addEventListener('dragstart', e=>{
        if (!this.editMode) return;
        const it = e.target.closest('.a-item'); if(!it) return;
        d = it.dataset.id; it.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d);
      });
      l.addEventListener('dragover', e=>{ if(d) e.preventDefault(); });
      l.addEventListener('dragenter', e=>{
        e.preventDefault(); if(!d) return;
        const it = e.target.closest('.a-item');
        if(it && it.dataset.id !== d) it.classList.add('drag-over');
      });
      l.addEventListener('dragleave', e=>{
        const it = e.target.closest('.a-item');
        if(it && (!e.relatedTarget || !it.contains(e.relatedTarget))) it.classList.remove('drag-over');
      });
      l.addEventListener('drop', e=>{
        e.preventDefault(); if(!d) return;
        const t = e.target.closest('.a-item'); if(!t || t.dataset.id === d) return;
        const as = this.store.data.articles;
        const fi = as.findIndex(a=>a.id===d), ti = as.findIndex(a=>a.id===t.dataset.id);
        if(fi===-1 || ti===-1) return;
        const [it] = as.splice(fi,1); as.splice(fi<ti?ti-1:ti,0,it);
        this.store.save(); this.renderArticles();
      });
      l.addEventListener('dragend', ()=>{
        d = null; document.querySelectorAll('.a-item.dragging,.a-item.drag-over').forEach(c=>c.classList.remove('dragging','drag-over'));
      });
    })();

    // Drag & Drop — Gallery
    (()=>{
      const g = $('gGrid');
      if (!g) return;
      let d = null;
      g.addEventListener('dragstart', e=>{
        if (!this.editMode) return;
        const it = e.target.closest('.g-card'); if(!it) return;
        d = it.dataset.id; it.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d);
      });
      g.addEventListener('dragover', e=>{ if(d) e.preventDefault(); });
      g.addEventListener('dragenter', e=>{
        e.preventDefault(); if(!d) return;
        const it = e.target.closest('.g-card');
        if(it && it.dataset.id !== d) it.classList.add('drag-over');
      });
      g.addEventListener('dragleave', e=>{
        const it = e.target.closest('.g-card');
        if(it && (!e.relatedTarget || !it.contains(e.relatedTarget))) it.classList.remove('drag-over');
      });
      g.addEventListener('drop', e=>{
        e.preventDefault(); if(!d) return;
        const t = e.target.closest('.g-card'); if(!t || t.dataset.id === d) return;
        const gs = this.store.data.gallery;
        const fi = gs.findIndex(img=>img.id===d), ti = gs.findIndex(img=>img.id===t.dataset.id);
        if(fi===-1 || ti===-1) return;
        const [it] = gs.splice(fi,1); gs.splice(fi<ti?ti-1:ti,0,it);
        gs.forEach((img,i)=>img.order=i); this.store.save(); this.renderGallery();
      });
      g.addEventListener('dragend', ()=>{
        d = null; document.querySelectorAll('.g-card.dragging,.g-card.drag-over').forEach(c=>c.classList.remove('dragging','drag-over'));
      });
    })();
    $('skillsTags').addEventListener('click', e=>{
      if (!this.editMode) return;
      const tag = e.target.closest('.tag');
      if (!tag) return;
      if (tag.id === 'skillAdd') {
        this._skills().push('新技能');
        this.store.save();
        this.renderProfile();
        const idx = this._skills().length - 1;
        this.modalSkill(idx);
        return;
      }
      this.modalSkill(parseInt(tag.dataset.i));
    });

    // Contacts click
    $('contactsList').addEventListener('click', e=>{
      if (!this.editMode) return;
      const ct = e.target.closest('.contact');
      if (ct) this.modalContact(parseInt(ct.dataset.i));
    });

    // Social links click (edit mode)
    document.addEventListener('click', e=>{
      if (!this.editMode) return;
      const soc = e.target.closest('.soc');
      if (!soc) return;
      e.preventDefault();
      const p = soc.closest('#heroSoc')||soc.closest('#ftSoc');
      if (!p) return;
      this.modalSocial(Array.from(p.children).indexOf(soc));
    });

    // Double-click profile editable fields
    document.addEventListener('dblclick', e=>{
      const m = {
        'dispName':'name','dispTitle':'title','dispBio':'bio','aboutBio':'about'
      };
      for (const [id,field] of Object.entries(m)) {
        if (e.target.closest('#'+id)) { this.editField(field); return; }
      }
      // Avatar double-click
      if (e.target.closest('#avDisplay')||e.target.closest('#avAbout')) { this.modalAvatar(); }
    });

    // Lightbox
    $('lightbox').addEventListener('click', e=>{
      if (e.target === e.currentTarget) this.hideLightbox();
    });
    $('lightbox').querySelector('.lightbox-close').addEventListener('click', ()=>this.hideLightbox());

    // Gallery Viewer
    $('galleryViewer').addEventListener('click', e=>{
      if (e.target === e.currentTarget) this.hideGalleryViewer();
    });
    $('gvClose').addEventListener('click', ()=>this.hideGalleryViewer());
    $('gvPrev').addEventListener('click', ()=>this._gvNav(-1));
    $('gvNext').addEventListener('click', ()=>this._gvNav(1));
    document.addEventListener('keydown', e=>{
      if ($('galleryViewer').style.display !== 'none') {
        if (e.key === 'ArrowLeft') { this._gvNav(-1); return; }
        if (e.key === 'ArrowRight') { this._gvNav(1); return; }
      }
    });

    // Close modal
    $('modalClose').addEventListener('click', ()=>this.closeModal());
    $('modal').addEventListener('click', e=>{ if(e.target===e.currentTarget) this.closeModal(); });
    document.addEventListener('keydown', e=>{
      if(e.key==='Escape'){ this.closeModal(); $('pwModal').style.display='none'; this.hideLightbox(); this.hideGalleryViewer(); }
      // Keyboard shortcuts — skip when typing or modals open
      if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if($('modal').style.display!=='none'||$('pwModal').style.display!=='none'||$('galleryViewer').style.display!=='none') return;
      if(e.key==='e'||e.key==='E'){ e.preventDefault(); this.tryToggleEdit(); }
      const pages={1:'home',2:'works',3:'articles',4:'about',5:'gallery'};
      if(pages[e.key]) this.switchPage(pages[e.key]);
    });
  },

  // ===== PASSWORD & EDIT MODE =====
  tryToggleEdit() {
    if (this.editMode) {
      // Turning off — no password needed
      this.setEditMode(false);
    } else {
      // Turning on — require password
      $('pwInput').value = '';
      $('pwModal').style.display = '';
      $('pwInput').focus();
    }
  },

  checkPw() {
    if ($('pwInput').value === EDIT_PW) {
      $('pwModal').style.display = 'none';
      this.setEditMode(true);
    } else {
      $('pwInput').value = '';
      $('pwInput').focus();
      this.modal({
        title: '❌ 密码错误',
        body: `<div class="pw-error-msg">想要密码就去找乐乐同学喵 <span class="pw-kaomoji">(｡>ㅅ<｡)♡</span></div>`,
        footer: [{ label: '知道啦', cls: 'btn-p', action: () => this.closeModal() }]
      });
    }
  },

  setEditMode(on) {
    this.editMode = on;
    document.body.classList.toggle('edit-mode', on);
    $('fab').style.display = on ? '' : 'none';
    $('backupBtn').style.display = on ? '' : 'none';
    $('editBtn').textContent = on ? '🔓' : '✎';
    $('editBtn').classList.toggle('edit-on', on);
    $('editBtn').title = on ? '关闭编辑' : '编辑模式';
    this.toast(on ? '✎ 编辑模式已开启' : '编辑模式已关闭');
    this.renderWorks();
    this.renderArticles();
    this.renderProfile();
    this.renderHomePreview();
    this.renderAboutExtras();
    if ($('page-gallery').classList.contains('active')) this.renderGallery();
  },

  // ===== FIELD EDIT =====
  editField(field) {
    if (!this.editMode) return;
    const labels = {name:'姓名',title:'头衔',bio:'一句话介绍',about:'关于我'};
    const val = this.store.data.profile[field]||'';
    this.modal({
      title: `✎ 编辑${labels[field]||field}`,
      body: `<div class="fg"><label>${labels[field]||field}</label><textarea id="fv" rows="${field==='about'?4:2}">${esc(val)}</textarea></div>`,
      footer: [
        {label:'取消',cls:'btn-s'},
        {label:'保存',cls:'btn-p',action:()=>{
          const v=$('fv').value.trim();
          if(v){this.store.data.profile[field]=v;this.store.save();this.closeModal();this.renderProfile();this.toast('✅ 已更新');}
        }},
      ],
    });
  },

  modalAvatar() {
    if (!this.editMode) return;
    const cur = this.store.data.profile.avatar||'';
    this.modal({
      title: '✎ 更换头像',
      body: `<div class="fg"><label>图片 URL</label><input id="avUrl" value="${esc(cur)}" placeholder="https://..."></div><p style="font-size:0.8rem;color:var(--t3)">留空使用首字母</p>`,
      footer: [
        {label:'取消',cls:'btn-s'},
        {label:'保存',cls:'btn-p',action:()=>{
          this.store.data.profile.avatar=$('avUrl').value.trim();this.store.save();this.closeModal();this.renderProfile();this.toast('✅ 头像已更新');
        }},
      ],
    });
  },

  // ===== CRUD WORKS =====
  modalWork(id) {
    if (!this.editMode&&!id) { this.toast('请先开启编辑模式'); return; }
    const w = id ? this.store.data.works.find(x=>x.id===id) : null;
    const isE = !!w;
    const links = w?.links?.length ? w.links : [{label:'',url:''}];

    this.modal({
      title: isE ? '✎ 编辑作品' : '📦 添加作品',
      body: `
        <div class="fg"><label>标题</label><input id="wf_t" value="${esc(w?.title||'')}"></div>
        <div class="fg"><label>日期</label><input id="wf_date" type="date" value="${w?.date || new Date().toISOString().split('T')[0]}"></div>
        <div class="fg"><label>描述 <button type="button" class="btn-expand" id="wf_expand" title="展开编辑">⛶</button></label><textarea id="wf_d" rows="5">${esc(w?.desc||'')}</textarea></div>
        <div class="fg"><label>图片</label><input id="wf_img" value="${esc(w?.image||'')}" placeholder="图片 URL"><input type="file" id="wf_img_file" accept="image/*" style="margin-top:4px;font-size:0.8rem;color:var(--t2)"></div>
        <div class="fg"><label>标签（逗号分隔）</label><input id="wf_tags" value="${esc((w?.tags||[]).join(', '))}"></div>
        <div class="fg"><label>链接</label><div id="wf_links">${links.map(l=>`<div class="link-e"><input placeholder="名称" value="${esc(l.label)}"><input placeholder="URL" value="${esc(l.url)}"><button class="link-rm">✕</button></div>`).join('')}</div><button class="add-link" id="wf_al">+ 添加链接</button></div>
      `,
      footer: [
        {label:'取消',cls:'btn-s'},
        {label:isE?'保存':'添加',cls:'btn-p',action:()=>{
          const title=$('wf_t').value.trim();
          if(!title){this.toast('请输入标题');return;}
          const data={title,desc:$('wf_d').value.trim(),image:$('wf_img').value.trim(),date:$('wf_date').value,tags:$('wf_tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),links:this._clinks()};
          if(isE){Object.assign(w,data);this.store.save();this.renderWorks();this.renderHomePreview();this.closeModal();this.toast('✅ 已更新');}
          else{data.id=this.genId();data.order=Date.now();this.store.data.works.push(data);this.store.save();this.renderWorks();this.renderHomePreview();this.closeModal();this.toast('✅ 已添加');}
        }},
      ],
      onOpen:()=>{
        this._lbind();
        // Description expand toggle
        $('wf_expand').onclick=()=>$('wf_d').classList.toggle('expanded');
        // File upload → data URL
        $('wf_img_file').onchange=function(){
          const f=this.files[0]; if(!f) return;
          const r=new FileReader();
          r.onload=e=>{$('wf_img').value=e.target.result;};
          r.readAsDataURL(f);
        };
      },
    });
  },

  delWork(id) {
    if (!confirm('确认删除此作品？')) return;
    this.store.data.works = this.store.data.works.filter(w=>w.id!==id);
    this.store.save(); this.renderWorks(); this.renderHomePreview(); this.toast('已删除');
  },

  // ===== CRUD ARTICLES =====
  modalArticle(id) {
    if (!this.editMode&&!id) { this.toast('请先开启编辑模式'); return; }
    const a = id ? this.store.data.articles.find(x=>x.id===id) : null;
    const isE = !!a;
    this.modal({
      title: isE ? '✎ 编辑文章' : '📝 添加文章',
      body: `
        <div class="fg"><label>标题</label><input id="af_t" value="${esc(a?.title||'')}"></div>
        <div class="fg"><label>日期</label><input id="af_d" type="date" value="${a?.date||new Date().toISOString().split('T')[0]}"></div>
        <div class="fg"><label>分类</label><input id="af_c" value="${esc(a?.category||'')}" placeholder="如: 技术、设计、随笔"></div>
        <div class="fg"><label>外部链接（可选）</label><input id="af_u" value="${esc(a?.url||'')}" placeholder="https://..."></div>
        <div class="fg"><label>内容 <button type="button" class="btn-expand" id="af_expand" title="展开编辑">⛶</button></label><textarea id="af_content" rows="6">${esc(a?.content||'')}</textarea></div>
      `,
      footer: [
        {label:'取消',cls:'btn-s'},
        {label:isE?'保存':'添加',cls:'btn-p',action:()=>{
          const t=$('af_t').value.trim();
          if(!t){this.toast('请输入标题');return;}
          const data={title:t,date:$('af_d').value,category:$('af_c').value.trim(),url:$('af_u').value.trim(),content:$('af_content').value.trim()};
          if(isE){Object.assign(a,data);this.store.save();this.renderArticles();this.renderHomePreview();this.closeModal();this.toast('✅已更新');}
          else{data.id=this.genId();this.store.data.articles.push(data);this.store.save();this.renderArticles();this.renderHomePreview();this.closeModal();this.toast('✅已添加');}
        }},
      ],
      onOpen:()=>{
        $('af_expand').onclick=()=>$('af_content').classList.toggle('expanded');
      },
    });
  },

  delArticle(id) {
    if (!confirm('确认删除此文章？')) return;
    this.store.data.articles = this.store.data.articles.filter(a=>a.id!==id);
    this.store.save(); this.renderArticles(); this.renderHomePreview(); this.toast('已删除');
  },

  toggleFeaturedWork(id) {
    const w = this.store.data.works.find(x=>x.id===id);
    if (!w) return;
    w.featured = !w.featured;
    this.store.save();
    this.renderWorks();
    this.renderHomePreview();
    this.toast(w.featured ? '⭐ 已设为精选' : '已取消精选');
  },

  toggleFeaturedArticle(id) {
    const a = this.store.data.articles.find(x=>x.id===id);
    if (!a) return;
    a.featured = !a.featured;
    this.store.save();
    this.renderArticles();
    this.renderHomePreview();
    this.toast(a.featured ? '⭐ 已设为精选' : '已取消精选');
  },

  // ===== CONTACT / SOCIAL / SKILL =====
  modalSkill(idx) {
    const skills = this._skills();
    const val = skills[idx]||'';
    this.modal({
      title:'✎ 编辑技能',
      body:`<div class="fg"><label>技能名</label><input id="sk_i" value="${esc(val)}"></div>
        <button class="btn btn-sm btn-p" id="sk_del" style="margin-top:4px">删除</button>`,
      footer:[
        {label:'取消',cls:'btn-s'},
        {label:'保存',cls:'btn-p',action:()=>{
          const v=$('sk_i').value.trim();
          if(v){skills[idx]=v;this.store.save();this.closeModal();this.renderProfile();this.toast('✅ 已更新');}
          else{this.toast('技能名不能为空');}
        }},
      ],
      onOpen:()=>{$('sk_del').onclick=()=>{if(!confirm('确认删除？'))return;skills.splice(idx,1);this.store.save();this.closeModal();this.renderProfile();this.toast('已删除');}},
    });
  },

  modalContact(idx) {
    const c = this.store.data.profile.contacts[idx];
    if (!c) return;
    this.modal({
      title:'✎ 联系方式',
      body:`<div class="fg"><label>图标</label><input id="c_i" value="${c.icon}"></div>
        <div class="fg"><label>内容</label><input id="c_l" value="${esc(c.label)}"></div>
        <button class="btn btn-sm btn-p" id="c_del" style="margin-top:4px">删除</button>`,
      footer:[
        {label:'取消',cls:'btn-s'},
        {label:'保存',cls:'btn-p',action:()=>{
          c.icon=$('c_i').value||'📌';c.label=$('c_l').value.trim()||c.label;this.store.save();this.closeModal();this.renderProfile();this.toast('✅ 已更新');
        }},
      ],
      onOpen:()=>{$('c_del').onclick=()=>{if(!confirm('确认删除？'))return;this.store.data.profile.contacts.splice(idx,1);this.store.save();this.closeModal();this.renderProfile();this.toast('已删除');}},
    });
  },

  modalSocial(idx) {
    const s = this.store.data.profile.socials[idx];
    if (!s) return;
    this.modal({
      title:'✎ 社交链接',
      body:`<div class="fg"><label>图标</label><input id="s_i" value="${s.icon}"></div>
        <div class="fg"><label>名称</label><input id="s_l" value="${esc(s.label)}"></div>
        <div class="fg"><label>URL</label><input id="s_u" value="${esc(s.url)}"></div>
        <button class="btn btn-sm btn-p" id="s_del" style="margin-top:4px">删除</button>`,
      footer:[
        {label:'取消',cls:'btn-s'},
        {label:'保存',cls:'btn-p',action:()=>{
          s.icon=$('s_i').value||'🔗';s.label=$('s_l').value.trim()||s.label;s.url=$('s_u').value.trim()||s.url;this.store.save();this.closeModal();this.renderProfile();this.renderSocial();this.toast('✅ 已更新');
        }},
      ],
      onOpen:()=>{$('s_del').onclick=()=>{if(!confirm('确认删除？'))return;this.store.data.profile.socials.splice(idx,1);this.store.save();this.closeModal();this.renderProfile();this.renderSocial();this.toast('已删除');}},
    });
  },

  // ===== THEME =====
  loadTheme() {
    const s = localStorage.getItem('portfolio_theme');
    if (s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme:dark)').matches)) {
      document.body.classList.add('dark'); this.theme='dark'; $('themeBtn').textContent='☀️';
    }
  },
  toggleTheme() {
    this.theme=this.theme==='dark'?'light':'dark';
    document.body.classList.toggle('dark',this.theme==='dark');
    localStorage.setItem('portfolio_theme',this.theme);
    $('themeBtn').textContent=this.theme==='dark'?'☀️':'🌙';
  },

  toggleMobileMenu() {
    const menu = $('mobileMenu');
    const toggle = $('menuToggle');
    if (!menu || !toggle) return;
    
    menu.classList.toggle('show');
    toggle.classList.toggle('active');
    
    if (menu.classList.contains('show')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  },

  _quoteIdx: 0,
  _quoteList: [],
  
  initQuotes() {
    const data = this.store.data;
    this._quoteList = data.quotes || ['写代码就像泡茶，水温要刚好。', '设计不是让它看起来怎么样，而是让它用起来怎么样。', 'Bug 不是程序的错误，是程序在跟你开玩笑。'];
    this._quoteIdx = 0;
    this.renderQuote();
    this.startQuoteCarousel();
  },
  
  startQuoteCarousel() {
    this._quoteTimer = setInterval(() => {
      this._quoteIdx++;
      if (this._quoteIdx >= this._quoteList.length) this._quoteIdx = 0;
      this.renderQuote();
    }, 5000);
  },
  
  renderQuote() {
    const quoteEl = $('quoteText');
    const contentEl = $('quoteContent');
    if (!quoteEl || !contentEl) return;
    
    contentEl.style.opacity = '0';
    contentEl.style.transform = 'translateY(5px)';
    
    setTimeout(() => {
      quoteEl.textContent = this._quoteList[this._quoteIdx] || '';
      contentEl.style.opacity = '1';
      contentEl.style.transform = 'translateY(0)';
    }, 300);
  },

  initKaomoji() {
  },

  // ===== MODAL =====
  modal(config) {
    $('modalTitle').textContent=config.title||'';
    $('modalBody').innerHTML=config.body||'';
    $('modalFoot').innerHTML='';
    $('modal').querySelector('.modal-box').classList.toggle('modal-wide', !!config.wide);
    if (config.footer) {
      config.footer.forEach(f=>{
        const b=document.createElement('button');
        b.className=`btn ${f.cls}`;
        b.textContent=f.label;
        b.onclick=f.action||(()=>this.closeModal());
        $('modalFoot').appendChild(b);
      });
    }
    $('modal').style.display='';
    requestAnimationFrame(()=>{
      const fi=$('modalBody').querySelector('input,textarea,select');
      if(fi) fi.focus();
    });
    if (config.onOpen) setTimeout(config.onOpen, 50);
  },

  closeModal() { $('modal').style.display='none'; $('modal').querySelector('.modal-box').classList.remove('modal-wide'); },

  // ===== GITHUB SYNC =====
  _ghInit() {
    // 如果是访客（没有配置 GitHub），尝试从 raw 拉取
    if (!GitHubSync.isReady()) {
      this._ghLoadPublic();
      return;
    }
    this._ghLoad();
  },

  // 从公共 Pages 地址拉取（访客模式）
  async _ghLoadPublic() {
    if (!navigator.onLine) return;
    try {
      var data = await GitHubSync.pullPublic('yangshanle', 'todo1');
      if (data && data.profile) {
        this.store.d = data;
        try { localStorage.setItem(this.store.key, JSON.stringify(data)); } catch(e) {}
        this.render();
        console.log('[gh] loaded public data');
      }
    } catch(e) {
      console.log('[gh] public load skipped:', e.message);
    }
  },

  // 从 GitHub 拉取数据（已配置 token）
  async _ghLoad() {
    if (!navigator.onLine) return;
    try {
      const data = await GitHubSync.pull();
      if (data && data.profile) {
        this.store.d = data;
        try { localStorage.setItem(this.store.key, JSON.stringify(data)); } catch(e) {}
        this.render();
        console.log('[gh] loaded data');
      }
    } catch(e) {
      console.warn('[gh] load error:', e.message);
    }
  },

  // 保存到 GitHub（带队列，避免并发冲突）
  async _ghSave() {
    if (this._ghBusy) {
      // 有保存进行中，排队等待
      this._ghPending = true;
      return;
    }
    this._ghBusy = true;
    this._ghPending = false;
    try {
      await GitHubSync.push(this.store.data);
      this._showSyncIndicator(true);
      console.log('[gh] save OK');
      // 如果排队中有新的保存请求，继续处理
      if (this._ghPending) {
        this._ghBusy = false;
        this._ghSave();
      }
    } catch(e) {
      console.warn('[gh] save failed:', e.message);
      this._showSyncIndicator(false);
      this.toast('❌ 同步失败: '+e.message);
    }
    this._ghBusy = false;
  },

  _connectGH() {
    const owner = $('gh_owner')?.value?.trim();
    const repo = $('gh_repo')?.value?.trim();
    const token = $('gh_token')?.value?.trim();
    if (!owner||!repo||!token) { this.toast('请填写所有字段'); return; }
    GitHubSync.init(owner, repo, token);
    this.toast('✅ 已连接');
    this.closeModal();
    this._ghSave();
    setTimeout(() => this.showBackupModal(), 800);
  },

  _disconnectGH() {
    if (!confirm('断开同步连接？本地数据不会丢失。')) return;
    GitHubSync.disconnect();
    this.closeModal();
    this.toast('已断开同步');
    setTimeout(() => this.showBackupModal(), 500);
  },

  _showSyncIndicator(ok) {
    let el = $('syncInd');
    if (!el) {
      el = document.createElement('div');
      el.id = 'syncInd';
      document.body.appendChild(el);
    }
    el.textContent = ok ? '☁️ 已同步' : '☁️ 失败';
    el.className = 'show';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = ''; }, 2000);
  },

  _showSyncIndicator(ok) {
    let el = $('syncInd');
    if (!el) {
      el = document.createElement('div');
      el.id = 'syncInd';
      document.body.appendChild(el);
    }
    el.textContent = ok ? '☁️ 已同步' : '☁️ 失败';
    el.className = 'show';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = ''; }, 2000);
  },

  // ===== BACKUP & RESTORE =====
  showBackupModal() {
    const connected = GitHubSync.isReady();
    const syncCfg = GitHubSync.config();
    const lastSync = GitHubSync.lastSync();
    let syncHtml;
    if (connected) {
      syncHtml = `
        <div style="margin:14px 0;padding:12px;border-radius:8px;background:var(--alt);border:1px solid var(--b2)">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="color:#4CAF50">✅</span>
            <span style="font-size:0.85rem;font-weight:600">🐙 GitHub 同步已连接</span>
          </div>
          <div style="font-size:0.72rem;color:var(--t3);margin-bottom:4px">${esc(syncCfg.owner)}/${esc(syncCfg.repo)}</div>
          ${lastSync?'<div style="font-size:0.72rem;color:var(--t3);margin-bottom:10px">上次同步: '+esc(lastSync)+'</div>':''}
          <button class="btn btn-sm btn-p" id="syncNowBtn" style="width:100%;margin-bottom:4px">🔄 立即同步</button>
          <button class="btn btn-sm" id="syncDisBtn" style="width:100%;background:var(--tag-bg);color:var(--red)">🔌 断开连接</button>
        </div>
      `;
    } else {
      syncHtml = `
        <div style="margin:14px 0;padding:12px;border-radius:8px;background:var(--alt);border:1px solid var(--b2)">
          <div style="font-size:0.82rem;font-weight:600;margin-bottom:8px">🐙 GitHub 自动同步</div>
          <p style="font-size:0.75rem;color:var(--t3);margin-bottom:8px;line-height:1.5">开启后每次修改自动同步 data.json 到 GitHub 仓库。<br>需要在 <a href="https://github.com/settings/tokens" target="_blank" style="color:var(--gold)">GitHub Token 设置</a> 创建 <b>repo</b> 作用域的 token：</p>
          <div class="fg" style="margin-bottom:6px"><label>Owner（用户名）</label><input id="gh_owner" value="${syncCfg?esc(syncCfg.owner):'yangshanle'}" placeholder="GitHub 用户名"></div>
          <div class="fg" style="margin-bottom:6px"><label>仓库名称</label><input id="gh_repo" value="${syncCfg?esc(syncCfg.repo):''}" placeholder="你的仓库名"></div>
          <div class="fg" style="margin-bottom:6px"><label>Personal Token</label><input id="gh_token" type="password" placeholder="ghp_..."></div>
          <button class="btn btn-sm btn-p" id="syncConnBtn" style="width:100%">🔗 连接</button>
        </div>
      `;
    }
    this.modal({
      title: '💾 数据备份',
      body: `
        <p style="font-size:0.85rem;color:var(--t2);margin-bottom:12px;line-height:1.6">数据存储在浏览器本地，清除缓存会丢失。<br>GitHub 同步让手机电脑数据互通。</p>
        <button class="btn btn-p" id="exportBtn" style="width:100%;margin-bottom:8px">📥 导出数据（下载 JSON）</button>
        <button class="btn btn-s" id="importBtn" style="width:100%">📤 导入数据（恢复备份）</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
        ${syncHtml}
        <p style="font-size:0.75rem;color:var(--t3);margin-top:10px">导入会覆盖当前所有数据，建议先导出备份。</p>
      `,
      footer: [{label:'关闭',cls:'btn-s'}],
      onOpen: () => {
        $('exportBtn').onclick = () => this.exportData();
        $('importBtn').onclick = () => $('importFile').click();
        $('importFile').onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          this.importData(file);
        };
        if (connected) {
          $('syncNowBtn').onclick = () => { this._ghSave(); this.toast('🔄 同步中...'); };
          $('syncDisBtn').onclick = () => this._disconnectGH();
        } else {
          $('syncConnBtn').onclick = () => this._connectGH();
        }
      },
    });
  },

  exportData() {
    try {
      const json = JSON.stringify(this.store.data, null, 2);
      const blob = new Blob([json], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.closeModal();
      this.toast('✅ 导出成功');
    } catch(e) {
      this.toast('❌ 导出失败: ' + e.message);
    }
  },

  importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.profile || !Array.isArray(data.works)) {
          this.toast('❌ 无效的备份文件');
          return;
        }
        if (!confirm('导入将覆盖现有所有数据，确认继续？')) return;
        this.store.d = data;
        this.store.save();
        this.closeModal();
        this.render();
        this.toast('✅ 数据恢复成功');
      } catch(err) {
        this.toast('❌ 导入失败: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  // ===== TOAST =====
  toast(msg, type='info', dur=3000) {
    const c = $('toastC');
    if (!c) return;

    // Limit to 3 visible toasts
    while (c.children.length >= 3) {
      const old = c.firstChild;
      old.classList.remove('show');
      setTimeout(() => old.remove(), 300);
    }

    const el = document.createElement('div');
    el.className = 'toast toast-'+type;
    const icons = { success:'✓', error:'✗', info:'●' };
    el.innerHTML = '<span class="toast-icon">'+(icons[type]||'●')+'</span><span class="toast-text">'+esc(msg)+'</span><span class="toast-progress" style="width:100%"></span>';
    c.appendChild(el);

    requestAnimationFrame(() => el.classList.add('show'));

    const prog = el.querySelector('.toast-progress');
    const start = Date.now();
    const tick = () => {
      const pct = Math.max(0, 100 - (Date.now() - start) / dur * 100);
      if (prog) prog.style.width = pct + '%';
      if (pct > 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, dur);
  },

  // ===== LINK HELPERS =====
  _clinks() {
    return Array.from(document.querySelectorAll('#wf_links .link-e')).map(el=>{
      const ins=el.querySelectorAll('input');
      return {label:ins[0]?.value.trim()||'',url:ins[1]?.value.trim()||''};
    }).filter(l=>l.label&&l.url);
  },
  _lbind() {
    const c=$('wf_links');
    c.addEventListener('click',e=>{
      if(e.target.closest('.link-rm')) {
        const en=e.target.closest('.link-e');
        if(c.children.length>1) en.remove(); else en.querySelectorAll('input').forEach(i=>i.value='');
      }
    });
    $('wf_al').addEventListener('click',()=>{
      const d=document.createElement('div'); d.className='link-e';
      d.innerHTML='<input placeholder="名称"><input placeholder="URL"><button class="link-rm">✕</button>';
      c.appendChild(d);
    });
  },
  _skills() {
    const sk = this.store.data.skills;
    if (sk) return sk;
    // Fallback for old data with skills inside profile
    return this.store.data.profile?.skills || [];
  },

  // ===== POETRY CAROUSEL =====
  _defaultPoetry: [
    { text: '寻寻觅觅，冷冷清清，凄凄惨惨戚戚。乍暖还寒时候，最难将息。', author: '李清照《声声慢》', char: '📜' },
    { text: '明月几时有？把酒问青天。不知天上宫阙，今夕是何年。', author: '苏轼《水调歌头》', char: '🍶' },
    { text: '众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。', author: '辛弃疾《青玉案》', char: '✨' },
    { text: '寒蝉凄切，对长亭晚，骤雨初歇。都门帐饮无绪，留恋处，兰舟催发。', author: '柳永《雨霖铃》', char: '🌧️' },
    { text: '无可奈何花落去，似曾相识燕归来。小园香径独徘徊。', author: '晏殊《浣溪沙》', char: '🦋' },
    { text: '庭院深深深几许？杨柳堆烟，帘幕无重数。', author: '欧阳修《蝶恋花》', char: '🌿' },
    { text: '伫倚危楼风细细，望极春愁，黯黯生天际。', author: '柳永《蝶恋花》', char: '🍃' },
    { text: '十年生死两茫茫，不思量，自难忘。千里孤坟，无处话凄凉。', author: '苏轼《江城子》', char: '🌙' },
    { text: '红藕香残玉簟秋。轻解罗裳，独上兰舟。', author: '李清照《一剪梅》', char: '🪷' },
    { text: '醉里挑灯看剑，梦回吹角连营。八百里分麾下炙，五十弦翻塞外声。', author: '辛弃疾《破阵子》', char: '⚔️' },
    { text: '君不见黄河之水天上来，奔流到海不复回。君不见高堂明镜悲白发，朝如青丝暮成雪。', author: '李白《将进酒》', char: '🌊' },
    { text: '人生得意须尽欢，莫使金樽空对月。天生我材必有用，千金散尽还复来。', author: '李白《将进酒》', char: '🥂' },
    { text: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', author: '李白《静夜思》', char: '🌙' },
    { text: '大漠孤烟直，长河落日圆。', author: '王维《使至塞上》', char: '🏜️' },
    { text: '海内存知己，天涯若比邻。', author: '王勃《送杜少府之任蜀州》', char: '🤝' },
    { text: '独在异乡为异客，每逢佳节倍思亲。', author: '王维《九月九日忆山东兄弟》', char: '🏮' },
    { text: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', author: '孟浩然《春晓》', char: '🌸' },
    { text: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。', author: '柳宗元《江雪》', char: '❄️' },
    { text: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', author: '李白《望庐山瀑布》', char: '💦' },
    { text: '两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。', author: '杜甫《绝句》', char: '🦅' },
    { text: '好雨知时节，当春乃发生。随风潜入夜，润物细无声。', author: '杜甫《春夜喜雨》', char: '☔' },
    { text: '慈母手中线，游子身上衣。临行密密缝，意恐迟迟归。', author: '孟郊《游子吟》', char: '🧵' },
    { text: '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。', author: '李绅《悯农》', char: '🌾' },
    { text: '昨夜星辰昨夜风，画楼西畔桂堂东。身无彩凤双飞翼，心有灵犀一点通。', author: '李商隐《无题》', char: '💫' },
    { text: '相见时难别亦难，东风无力百花残。春蚕到死丝方尽，蜡炬成灰泪始干。', author: '李商隐《无题》', char: '🕯️' },
    { text: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。', author: '白居易《赋得古原草送别》', char: '🌱' },
    { text: '小荷才露尖尖角，早有蜻蜓立上头。', author: '杨万里《小池》', char: '🪰' },
    { text: '接天莲叶无穷碧，映日荷花别样红。', author: '杨万里《晓出净慈寺送林子方》', char: '🪷' },
    { text: '山重水复疑无路，柳暗花明又一村。', author: '陆游《游山西村》', char: '🌸' },
    { text: '死去元知万事空，但悲不见九州同。王师北定中原日，家祭无忘告乃翁。', author: '陆游《示儿》', char: '🗡️' },
    { text: '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。', author: '苏轼《定风波》', char: '🎋' },
    { text: '人生如逆旅，我亦是行人。', author: '苏轼《临江仙》', char: '🚶' },
    { text: '此情可待成追忆，只是当时已惘然。', author: '李商隐《锦瑟》', char: '💭' },
    { text: '问君能有几多愁？恰似一江春水向东流。', author: '李煜《虞美人》', char: '🌊' },
    { text: '落红不是无情物，化作春泥更护花。', author: '龚自珍《己亥杂诗》', char: '🌹' },
    { text: '但愿人长久，千里共婵娟。', author: '苏轼《水调歌头》', char: '🌕' },
    { text: '长风破浪会有时，直挂云帆济沧海。', author: '李白《行路难》', char: '⛵' },
    { text: '举杯邀明月，对影成三人。', author: '李白《月下独酌》', char: '🌙' },
    { text: '采菊东篱下，悠然见南山。', author: '陶渊明《饮酒》', char: '🏔️' },
    { text: '关关雎鸠，在河之洲。窈窕淑女，君子好逑。', author: '《诗经·关雎》', char: '💘' },
  ],

  initPoetryCarousel() {
    // Load poetry from data.json if available, otherwise use defaults
    this._poetryList = this.store.data.poetry || this._defaultPoetry;
    
    // Initialize index
    this._poetryIdx = 0;
    
    // Render first poem
    this._renderPoetry();
    
    // Render indicator dots
    this._renderPoetryIndicator();
  },

  _renderPoetry() {
    const poem = this._poetryList[this._poetryIdx];
    if (!poem) return;

    const textEl = $('poetryText');
    const authorEl = $('poetryAuthor');
    const charEl = $('poetryCharacter');

    // Add fade out animation
    textEl.style.opacity = '0';
    authorEl.style.opacity = '0';
    charEl.style.opacity = '0';

    setTimeout(() => {
      // Update content
      textEl.textContent = poem.text || '';
      authorEl.textContent = poem.author || '';
      charEl.textContent = poem.char || '👘';
      charEl.style.animation = 'none';
      
      // Reset and trigger fade in
      textEl.style.animation = 'none';
      authorEl.style.animation = 'none';
      
      requestAnimationFrame(() => {
        charEl.style.animation = 'characterFloat 3s ease-in-out forwards';
        textEl.style.animation = 'poetryFadeIn 0.6s ease-out forwards';
        authorEl.style.animation = 'poetryFadeIn 0.6s ease-out 0.1s forwards';
      });
    }, 200);
  },

  _renderPoetryIndicator() {
    const indicator = $('poetryIndicator');
    const total = this._poetryList.length;
    const MAX_VISIBLE = 7;

    let html = '';
    if (total <= MAX_VISIBLE) {
      html = this._poetryList.map((_, i) =>
        `<span class="dot ${i === this._poetryIdx ? 'active' : ''}" data-idx="${i}"></span>`
      ).join('');
    } else {
      const sideCount = 2;
      let start = this._poetryIdx - sideCount;
      let end = this._poetryIdx + sideCount;

      if (start < 1) { end += (1 - start); start = 1; }
      if (end > total - 2) { start -= (end - (total - 2)); end = total - 2; }
      start = Math.max(1, start);
      end = Math.min(total - 2, end);

      // First dot
      html += `<span class="dot ${this._poetryIdx === 0 ? 'active' : ''}" data-idx="0"></span>`;
      // Left ellipsis
      if (start > 1) html += `<span class="dot-ellipsis">⋯</span>`;
      // Middle dots
      for (let i = start; i <= end; i++) {
        html += `<span class="dot ${i === this._poetryIdx ? 'active' : ''}" data-idx="${i}"></span>`;
      }
      // Right ellipsis
      if (end < total - 2) html += `<span class="dot-ellipsis">⋯</span>`;
      // Last dot
      html += `<span class="dot ${this._poetryIdx === total - 1 ? 'active' : ''}" data-idx="${total - 1}"></span>`;
    }

    indicator.innerHTML = html;

    indicator.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', () => {
        this._poetryIdx = parseInt(dot.dataset.idx);
        this._renderPoetry();
        this._renderPoetryIndicator();
      });
    });
  },

  poetryNav(delta) {
    const newIdx = this._poetryIdx + delta;
    
    // Loop around
    if (newIdx < 0) {
      this._poetryIdx = this._poetryList.length - 1;
    } else if (newIdx >= this._poetryList.length) {
      this._poetryIdx = 0;
    } else {
      this._poetryIdx = newIdx;
    }
    
    this._renderPoetry();
    this._renderPoetryIndicator();
  },
};

// ===== STORE =====
class Store {
  constructor(key, defs, onSave) {
    this.key = key;
    this.defs = defs;
    this.onSave = onSave || null;
    this.d = this._load();
  }
  get data() { return this.d; }
  _load() {
    try {
      const r = localStorage.getItem(this.key);
      if (!r) return JSON.parse(JSON.stringify(this.defs));
      return this._m(JSON.parse(JSON.stringify(this.defs)), JSON.parse(r));
    } catch {
      return JSON.parse(JSON.stringify(this.defs));
    }
  }
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) { console.warn('Store.save error:', e); }
    if (typeof this.onSave === 'function') {
      try { this.onSave(); } catch (e) { console.warn('Store.onSave error:', e); }
    }
  }
  _m(t, s) {
    const r = { ...t };
    for (const k of Object.keys(s)) {
      if (r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]) && r[k] !== null)
        r[k] = this._m(r[k], s[k]);
      else
        r[k] = s[k];
    }
    return r;
  }
}

// ===== ANIMATION STYLES =====
const st=document.createElement('style');
st.textContent=`
.ar{opacity:0;transform:translateY(18px);transition:opacity 0.5s cubic-bezier(0.22,1,0.36,1),transform 0.5s cubic-bezier(0.22,1,0.36,1);}
.ar.iv{opacity:1;transform:translateY(0);}
.w-card.ar,.a-item.ar{transition-delay:calc(var(--i,0)*0.08s);}
.w-card:nth-child(1),.a-item:nth-child(1){--i:0;}
.w-card:nth-child(2),.a-item:nth-child(2){--i:1;}
.w-card:nth-child(3),.a-item:nth-child(3){--i:2;}
.w-card:nth-child(4),.a-item:nth-child(4){--i:3;}
.w-card:nth-child(5),.a-item:nth-child(5){--i:4;}
.w-card:nth-child(6),.a-item:nth-child(6){--i:5;}
#syncInd{position:fixed;top:12px;right:12px;z-index:500;padding:4px 12px;border-radius:99px;background:var(--card);color:var(--text);font-size:0.75rem;box-shadow:var(--shadow);pointer-events:none;opacity:0;transform:translateY(-6px);transition:all 0.35s cubic-bezier(0.22,1,0.36,1);}
#syncInd.show{opacity:1;transform:translateY(0);}
`;
document.head.appendChild(st);

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', ()=>{
  App.init();
  window.app = App;
});
})();
