'use strict';
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let savedMotion=false;try{savedMotion=sessionStorage.getItem('manifest-motion-paused')==='true'}catch(_){}
  let paused = reducedQuery.matches || savedMotion;
  let heroVisible = true;
  let awardsVisible = false;
  let awardIndex = 0;
  let lastAward = performance.now();
  let headlineIndex = 0;
  let lastHeadline = performance.now();
  let capCloseTimer;
  const hero = $('.hero');
  const heroContent = $('.hero-content');
  const headlines = $$('.headline');
  const motionButton = $('#motion-toggle');
  const capMenu = $('#cap-menu');
  const capNav = $('#cap-nav-button');
  const mobileMenu = $('#mobile-menu');
  const mobileButton = $('#mobile-menu-toggle');
  document.body.classList.add('js-motion');

  function setMotion(value) {
    paused = reducedQuery.matches || value;
    try{sessionStorage.setItem('manifest-motion-paused',String(paused))}catch(_){}
    document.body.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Play animations' : 'Pause animations');
    motionButton.disabled = reducedQuery.matches;
    $('#footer-motion').disabled = reducedQuery.matches;
    $('.pause-icon', motionButton).textContent = paused ? '▷' : 'Ⅱ';
    $('.motion-tooltip', motionButton).textContent = paused ? 'Play motion' : 'Pause motion';
    $('#footer-motion').textContent = paused ? 'Play motion' : 'Pause motion';
    if(reducedQuery.matches){motionButton.setAttribute('aria-label','Reduced motion enabled');$('.motion-tooltip',motionButton).textContent='Reduced motion';$('#footer-motion').textContent='Reduced motion enabled'}
    $$('img[data-still]').forEach(img => {
      if (!img.dataset.animated) img.dataset.animated = img.getAttribute('src');
      img.src = paused ? img.dataset.still : img.dataset.animated;
    });
    if (paused) $$('.reveal').forEach(el => el.classList.add('is-visible'));
    window.dispatchEvent(new CustomEvent('motionchange', { detail: { paused } }));
    lastHeadline = performance.now();
    queueScroll();
  }
  motionButton.addEventListener('click', () => setMotion(!paused));
  $('#footer-motion').addEventListener('click', () => setMotion(!paused));
  reducedQuery.addEventListener('change', e => setMotion(e.matches));

  const visibilityObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.target === hero) heroVisible = entry.isIntersecting;
      if (entry.target.classList.contains('awards')) awardsVisible = entry.isIntersecting;
    });
  }, {threshold:0});
  visibilityObserver.observe(hero);
  visibilityObserver.observe($('.awards'));

  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }), {threshold:.1, rootMargin:'0px 0px -25px 0px'});
  $$('.reveal').forEach(el => revealObserver.observe(el));

  const statement = $('[data-word-reveal]');
  const words = statement.textContent.trim().split(/\s+/);
  const readableCopy=document.createElement('span');readableCopy.className='sr-only';readableCopy.textContent=statement.textContent;
  const visualCopy=document.createElement('span');visualCopy.setAttribute('aria-hidden','true');
  const statementColors = ['coral', 'lilac', 'grass', 'lagoon', 'cobalt', 'sun'];
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    for (const character of word) {
      const letter = document.createElement('span');
      letter.className = 'statement-letter';
      letter.textContent = character;
      letter.style.setProperty('--letter-highlight', `var(--manifest-${statementColors[Math.floor(Math.random() * statementColors.length)]})`);
      span.append(letter);
    }
    visualCopy.append(span);
    if (i < words.length - 1) visualCopy.append(' ');
  });
  statement.replaceChildren(readableCopy,visualCopy);
  const wordEls = $$('.word', statement);
  let scrollPending = false;
  function updateScroll() {
    scrollPending = false;
    const y = scrollY;
    const vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    document.documentElement.style.setProperty('--progress', String(max > 0 ? y/max : 0));
    $('#site-header').classList.toggle('scrolled', y > 60);
    if (!paused) {
      const heroProgress = Math.max(0, Math.min(1, y / hero.offsetHeight));
      if (heroVisible) {
        heroContent.style.transform = 'translate3d(0,'+(y*.17)+'px,0)';
        heroContent.style.opacity = String(Math.max(0,1-heroProgress*1.8));
        $('#hero-art').style.transform = 'translate3d(0,'+(y*.1)+'px,0) scale('+(1+heroProgress*.09)+')';
      }
      const r = statement.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh * .88 - r.top) / (vh * .58)));
      wordEls.forEach((el,i) => el.style.setProperty('--word-opacity', String(.18 + .82 * Math.max(0,Math.min(1,p*1.35 - i/words.length*.35)))));

      if (innerWidth <= 560 || matchMedia('(pointer: coarse)').matches) {
        const cards = $$('.capability-card');
        let active = null;
        let distance = Infinity;
        cards.forEach(card => {
          const box = card.getBoundingClientRect();
          const d = Math.abs(box.top + box.height * .5 - vh * .5);
          if (box.top < vh * .8 && box.bottom > vh * .2 && d < distance) { active = card; distance = d; }
        });
        cards.forEach(card => card.classList.toggle('mobile-active', card === active));
      }
    } else {
      heroContent.style.transform='';heroContent.style.opacity='';$('#hero-art').style.transform='';
      wordEls.forEach(el => el.style.setProperty('--word-opacity','1'));
    }
  }
  function queueScroll() {if (!scrollPending) {scrollPending=true;requestAnimationFrame(updateScroll);}}
  addEventListener('scroll', queueScroll, {passive:true});
  addEventListener('resize', () => {queueScroll();if(innerWidth>800&&mobileMenu.classList.contains('open'))setMobileMenu(false)}, {passive:true});

  // A short, native-position scroll glide, matching the reference's half-second feel.
  let wheelFrame=0, wheelTarget=0, wheelLast=0;
  function stopWheel(){if(wheelFrame)cancelAnimationFrame(wheelFrame);wheelFrame=0;wheelLast=0;wheelTarget=scrollY}
  function wheelTick(time){
    const dt=wheelLast?Math.min(50,time-wheelLast):16;wheelLast=time;
    const difference=wheelTarget-scrollY;
    if(Math.abs(difference)<.7){window.scrollTo({top:wheelTarget,behavior:'instant'});wheelFrame=0;wheelLast=0;return}
    window.scrollTo({top:scrollY+difference*(1-Math.exp(-dt/75)),behavior:'instant'});
    wheelFrame=requestAnimationFrame(wheelTick);
  }
  addEventListener('wheel',e=>{
    if(paused||mobileMenu.classList.contains('open')||e.ctrlKey||e.metaKey||e.shiftKey||!matchMedia('(hover:hover) and (pointer:fine)').matches||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    e.preventDefault();
    if(!wheelFrame)wheelTarget=scrollY;
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
    wheelTarget=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,wheelTarget+delta));
    if(!wheelFrame){wheelLast=0;wheelFrame=requestAnimationFrame(wheelTick)}
  },{passive:false});
  addEventListener('pointerdown',stopWheel,{passive:true});
  addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))stopWheel()});
  addEventListener('motionchange',stopWheel);

  function nextHeadline() {
    const previous = headlines[headlineIndex];
    previous.classList.remove('is-current');previous.classList.add('is-leaving');previous.setAttribute('aria-hidden','true');
    setTimeout(() => {
      headlineIndex=(headlineIndex+1)%headlines.length;
      const next=headlines[headlineIndex];
      next.classList.remove('is-leaving');next.classList.add('is-current');next.removeAttribute('aria-hidden');
      previous.classList.remove('is-leaving');
    }, 300);
  }

  const shapeCursor = $('.shape-cursor');
  const cursorImage = $('img', shapeCursor);
  let cursorFrame = 0;
  let cursorActive = false;
  let cursorSoft = false;
  const cursor = {x:0,y:0,tx:0,ty:0};
  function cursorTick() {
    cursorFrame=0;
    const speed=cursorSoft ? .1 : .22;
    cursor.x+=(cursor.tx-cursor.x)*speed;
    cursor.y+=(cursor.ty-cursor.y)*speed;
    shapeCursor.style.transform='translate3d('+cursor.x+'px,'+cursor.y+'px,0)';
    if(cursorActive && !paused && (Math.abs(cursor.tx-cursor.x)>.1 || Math.abs(cursor.ty-cursor.y)>.1))cursorFrame=requestAnimationFrame(cursorTick);
  }
  function hideCursor(){cursorActive=false;shapeCursor.classList.remove('visible','pressed');}
  $$('.capability-card').forEach(card => {
    const activateCursor = e => {
      if(e.pointerType!=='mouse'||innerWidth<=560||paused)return;
      cursorActive=true;cursorSoft=card.dataset.capability==='1';
      cursorImage.src=$('.cap-shape img',card).src;
      cursor.x=cursor.tx=e.clientX+24;cursor.y=cursor.ty=e.clientY;
      shapeCursor.classList.add('visible');cursorTick();
    };
    card.addEventListener('pointerenter',activateCursor);
    card.addEventListener('pointermove',e=>{
      if(!cursorActive)activateCursor(e);
      if(!cursorActive)return;
      cursor.tx=e.clientX+24;cursor.ty=e.clientY;
      if(!cursorFrame)cursorFrame=requestAnimationFrame(cursorTick);
    });
    card.addEventListener('pointerleave',hideCursor);
    card.addEventListener('pointerdown',()=>shapeCursor.classList.add('pressed'));
    card.addEventListener('pointerup',()=>shapeCursor.classList.remove('pressed'));
    card.addEventListener('click',hideCursor);
  });
  addEventListener('scroll',hideCursor,{passive:true});
  addEventListener('motionchange',hideCursor);

  function setCapMenu(open) {
    clearTimeout(capCloseTimer);
    capMenu.classList.toggle('open',open);capMenu.inert=!open;capNav.setAttribute('aria-expanded',String(open));
  }
  capNav.addEventListener('click',e=>setCapMenu(e.detail>0&&matchMedia('(hover:hover)').matches?true:capNav.getAttribute('aria-expanded')!=='true'));
  $('.cap-nav-wrap').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')setCapMenu(true)});
  $('.cap-nav-wrap').addEventListener('pointerleave',()=>{capCloseTimer=setTimeout(()=>setCapMenu(false),180)});
  $('.cap-nav-wrap').addEventListener('focusout',e=>{if(!$('.cap-nav-wrap').contains(e.relatedTarget))setCapMenu(false)});
  $$('[data-cap-nav]').forEach(a=>a.addEventListener('click',()=>setCapMenu(false)));
  const langButton=$('#language-button'),langMenu=$('#language-menu');
  langButton?.addEventListener('click',()=>{const open=langButton.getAttribute('aria-expanded')!=='true';langButton.setAttribute('aria-expanded',String(open));langMenu.hidden=!open});

  function setMobileMenu(open) {
    mobileButton.setAttribute('aria-expanded',String(open));mobileButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    mobileMenu.classList.toggle('open',open);mobileMenu.inert=!open;document.body.classList.toggle('locked',open);
    if(open)setCapMenu(false);
  }
  mobileButton.addEventListener('click',()=>setMobileMenu(mobileButton.getAttribute('aria-expanded')!=='true'));
  $$('#mobile-menu a').forEach(a=>a.addEventListener('click',()=>setMobileMenu(false)));
  mobileMenu.addEventListener('keydown',e=>{
    if(e.key==='Tab'){
      const links=$$('a',mobileMenu),first=links[0],last=links[links.length-1];
      if(!e.shiftKey && document.activeElement===last){e.preventDefault();mobileButton.focus()}
      if(e.shiftKey && document.activeElement===first){e.preventDefault();mobileButton.focus()}
    }
  });
  mobileButton.addEventListener('keydown',e=>{if(e.key==='Tab'&&mobileMenu.classList.contains('open')){e.preventDefault();const links=$$('a',mobileMenu);(e.shiftKey?links[links.length-1]:links[0]).focus()}});
  document.addEventListener('click',e=>{
    if(!$('.cap-nav-wrap').contains(e.target))setCapMenu(false);
    if(langMenu && !$('.language-wrap')?.contains(e.target)){if(langMenu){langMenu.hidden=true;langButton?.setAttribute('aria-expanded','false')}}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setCapMenu(false);setMobileMenu(false);if(langMenu){langMenu.hidden=true;langButton?.setAttribute('aria-expanded','false')}}});

  const awardNames=['leadership','products','platforms','brands','data'];
  function nextAward(){
    const orbit=$('.award-orbit');
    orbit.classList.add('switching');
    setTimeout(()=>{
      awardIndex=(awardIndex+1)%awardNames.length;
      $('img',orbit).src='./assets/capability-'+awardNames[awardIndex]+'.png';
      orbit.classList.remove('switching');
    },650);
  }

  setInterval(()=>{
    if(paused||document.hidden||mobileMenu.classList.contains('open'))return;
    const now=performance.now();
    if(heroVisible&&now-lastHeadline>4700){nextHeadline();lastHeadline=now+300}
    if(awardsVisible&&now-lastAward>2700){nextAward();lastAward=now}
  },200);
  document.addEventListener('visibilitychange',()=>{lastHeadline=performance.now()});
  setMotion(paused);
  updateScroll();
})();
