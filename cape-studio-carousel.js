/* ============================================================================
   THE CAPE — CAROSELLO DELLE OPERE  ·  cape-studio-carousel.js

   La sezione studio mostra un'opera alla volta. Al cambio, tre cose si
   muovono insieme e non in fila: l'immagine scivola e si deforma, il titolo
   si sfoglia lettera per lettera, e le righe di testo scorrono dietro il
   proprio bordo. Il ritmo e' tutto nel blocco IMPOSTAZIONI: i numeri sono
   secondi sulla linea del tempo della transizione, non ritardi assoluti.

   COME E' FATTO
   - Due "pagine" sovrapposte (data-page="a" e "b") si scambiano il ruolo a
     ogni giro: quella dietro riceve l'immagine nuova, entra, e diventa quella
     davanti. Nessun nodo viene creato o distrutto durante il movimento.
   - Lo skew della pagina e' compensato da .studio-stage__cancel, che applica
     la trasformazione opposta: la cornice si deforma, l'immagine dentro no.
   - La deformazione non segue il tempo ma la VELOCITA' della curva: si legge
     la derivata dell'easing e la si normalizza. Il risultato e' che la pagina
     si inclina quando accelera e si raddrizza quando rallenta, come farebbe
     un foglio vero. E' il motivo per cui c'e' un bezier scritto a mano invece
     di una stringa GSAP.
   - Le righe della descrizione sono misurate sul testo reale prima di essere
     spezzate, cosi' l'a capo cade dove cadrebbe naturalmente.

   DIPENDE DA: GSAP 3 (solo core, nessun plugin).
   MARKUP: la sezione va marcata con [data-studio]. I campi sono
   [data-field="..."], il pager [data-pager="..."], le frecce [data-nav="..."].
   Se manca un elemento essenziale lo script si ferma e lo dice in console.

   prefers-reduced-motion: niente autoplay e niente sfoglio — le frecce fanno
   una dissolvenza da 0.25s e basta.
============================================================================ */

(function(){
'use strict';

/* ========================== IMPOSTAZIONI ================================== */

var ARTWORKS = [
  {
    title:      'WHISPER IN THE VOID',
    year:       '2024',
    dimensions: '120 × 160 CM',
    medium:     'Oil on canvas',
    desc:       'Oil and charcoal worked into near-total black, where a single pale gesture traces the delicate contour of a human profile before fading into the dark.',
    price:      '€ POA',
    cta:        'VIEW ARTWORK',
    img:        'https://cdn.prod.website-files.com/696e3bc5b446ecf721fa3bde/6a91a174e835a7629e93a0ec_watermark-removed-Gemini_Generated_Image_2fk2fv2fk2fv2fk2.jpg'
  },
  {
    title:      'TRACE OF A VISAGE',
    year:       '2023',
    dimensions: '110 × 150 CM',
    medium:     'Graphite on canvas',
    desc:       'Charcoal and thinned pigment glide across a stark white canvas, outlining the fragmented suggestion of a face — a quiet echo of a fading human presence.',
    price:      '€ POA',
    cta:        'VIEW ARTWORK',
    img:        'https://cdn.prod.website-files.com/696e3bc5b446ecf721fa3bde/6a909a5a7fa5b28295d6a1a9_WhatsApp%20Image%202026-08-27%20at%2013.39.23%20(1).png'
  },
  {
    title:      'THE CARMINE ECHO',
    year:       '2025',
    dimensions: '130 × 180 CM',
    medium:     'Oil on canvas',
    desc:       'Sweeping magenta washes create a luminous field where a fragile charcoal gesture surfaces and dissolves, anchored by a pool of deep ultramarine.',
    price:      '€ POA',
    cta:        'VIEW ARTWORK',
    img:        'https://cdn.prod.website-files.com/696e3bc5b446ecf721fa3bde/6a9adc907a2e5ceffd414de2_watermark-removed-Gemini_Generated_Image_fspiyvfspiyvfspi.jpg'
  }
];

var AUTOPLAY   = 6;      /* secondi su ogni opera prima del cambio automatico  */
var SLIDE_DUR  = 0.9;    /* durata della scivolata dell'immagine (s)           */

/* --- la deformazione del foglio ----------------------------------------- */
var SKEW       = 5;      /* skew massimo in gradi, al picco di velocita'.
                           Lo skew e' angolare: sposta di altezza*tan(SKEW),
                           quindi lo scarto in pixel NON si riduce quando la
                           colonna si stringe. Su un palco stretto lo stesso
                           angolo si legge molto piu' inclinato: se cambi la
                           larghezza della colonna, ritocca questo.           */
var IN_SCALE   = 1.45;   /* zoom dell'immagine che entra, all'inizio          */
var IN_SHIFT   = 22;     /* sfasamento dell'immagine che entra, in % di stage */
var OUT_SCALE  = 1.5;    /* zoom dell'immagine che esce, alla fine            */
var OUT_SHIFT  = -26;    /* sfasamento dell'immagine che esce, in %           */

/* --- il titolo, lettera per lettera ------------------------------------- */
var TITLE_OUT_AT      = 0.12;
var TITLE_OUT_DUR     = 0.18;
var TITLE_OUT_STAGGER = 0.016;
var TITLE_OUT_ROT     = 92;    /* gradi su Y in uscita                        */
var TITLE_IN_DUR      = 0.55;
var TITLE_IN_STAGGER  = 0.042;
var TITLE_IN_ROT      = -92;   /* gradi su Y da cui rientra                   */
var PERSPECTIVE       = 620;

/* --- le righe di testo, dietro il proprio bordo -------------------------- */
var LINES_OUT_AT      = 0.13;
var LINES_OUT_DUR     = 0.38;
var LINES_OUT_STAGGER = 0.045;
var LINES_OUT_Y       = -115;  /* yPercent verso cui escono                   */
var LINES_IN_DUR      = 0.62;
var LINES_IN_Y        = 115;   /* yPercent da cui rientrano                   */
var STATS_IN_AT       = 0.75;
var STATS_IN_STAGGER  = 0.06;
var INFO_IN_AT        = 1.15;
var INFO_IN_STAGGER   = 0.075;

var SWAP_AT           = 0.73;  /* quando i contenuti vengono sostituiti.
                                  E' il fulcro: prima di questo istante si
                                  parla della vecchia opera, dopo della nuova.
                                  STATS_IN_AT e INFO_IN_AT sono relativi a
                                  questo punto, non allo zero.                */

/* --- il markup che lo script si aspetta --------------------------------- */
var ROOT_SEL     = '[data-studio]';
var REQUIRED     = ['headline','stage','pageA','pageB','info','desc'];
var HEADLINE_MAX = 0.52;       /* quanta parte della sezione puo' occupare il
                                  titolo, su una riga. E' solo il default: se
                                  .studio-hero definisce --studio-headline-max
                                  in CSS, vince quello. Cosi' il limite si
                                  regola per breakpoint dal foglio di stile,
                                  dove stanno le decisioni di layout.        */
var HEADLINE_VAR = '--studio-headline-max';

/* ========================================================================== */


/* Bezier scritto a mano: serve la sua DERIVATA, che GSAP non espone. */
function cubicBezier(x1, y1, x2, y2){
  var ax = 3 * x1,
      bx = 3 * (x2 - x1) - ax,
      cx = 1 - ax - bx,
      ay = 3 * y1,
      by = 3 * (y2 - y1) - ay,
      cy = 1 - ay - by;

  function sampleX(t){ return ((cx * t + bx) * t + ax) * t; }
  function slopeX(t){ return (3 * cx * t + 2 * bx) * t + ax; }

  return function(x){
    if(x <= 0) return 0;
    if(x >= 1) return 1;
    var t = x;
    for(var i = 0; i < 8; i++){
      var err = sampleX(t) - x;
      if(err > -1e-7 && err < 1e-7) break;
      var slope = slopeX(t);
      if(slope > -1e-7 && slope < 1e-7) break;
      t -= err / slope;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
    }
    return ((cy * t + by) * t + ay) * t;
  };
}

var ease = cubicBezier(0.78, 0, 0.4, 1);

var EPS = 0.004;
function easeSpeed(t){
  return (ease(Math.min(1, t + EPS)) - ease(Math.max(0, t - EPS))) / (2 * EPS);
}

var MAX_SPEED = (function(){
  var top = 0;
  for(var i = 0; i <= 400; i++) top = Math.max(top, easeSpeed(i / 400));
  return top || 1;
})();

function easeInOutQuad(t){
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;


function init(){
  var root = document.querySelector(ROOT_SEL);
  if(!root || typeof gsap === 'undefined') return;

  gsap.config({ force3D:true });

  var el = {
    headline: root.querySelector('.studio-headline__row'),
    stage:    root.querySelector('.studio-stage'),
    pageA:    root.querySelector('[data-page="a"]'),
    pageB:    root.querySelector('[data-page="b"]'),
    stats:    root.querySelector('.studio-stats'),
    info:     root.querySelector('.studio-info'),
    desc:     root.querySelector('[data-field="desc"]'),
    cta:      root.querySelector('[data-field="cta"]'),
    year:     root.querySelector('[data-field="year"]'),
    dims:     root.querySelector('[data-field="dimensions"]'),
    price:    root.querySelector('[data-field="price"]'),
    medium:   root.querySelector('[data-field="medium"]') || root.querySelector('.studio-stats__value--dim2'),
    numCur:   root.querySelector('[data-pager="cur"]'),
    numNext:  root.querySelector('[data-pager="next"]'),
    fill:     root.querySelector('.studio-pager__fill'),
    prev:     root.querySelector('[data-nav="prev"]'),
    next:     root.querySelector('[data-nav="next"]')
  };

  var missing = REQUIRED.filter(function(k){ return !el[k]; });
  if(missing.length){
    console.warn('[studio] elemento mancante nella sezione:', missing.join(', '));
    return;
  }

  function makePage(node){
    return {
      page:   node,
      cancel: node.querySelector('.studio-stage__cancel'),
      img:    node.querySelector('.studio-stage__img')
    };
  }

  /* Contenuti prestati da altre sezioni della pagina: si aggiungono in coda
     alle opere e da lì in poi sono indistinguibili da una di esse — stesse
     misure, stesse righe, stesse animazioni. Vedi window.capeStudio in fondo. */
  var prestato = false;   /* il blocco e' in prestito alla sezione sotto */
  var EXTRA = [];
  function opera(i){ return i < ARTWORKS.length ? ARTWORKS[i] : EXTRA[i - ARTWORKS.length]; }
  function tutte(){ return ARTWORKS.concat(EXTRA); }

  var front = makePage(el.pageA),
      back  = makePage(el.pageB),
      index = 0,
      busy  = false,
      stageW = el.stage.offsetWidth || 1,
      chars = [],
      lines = { stats:[], info:[] },
      descLines = [],
      autoTimer = null,
      fillTween = null,
      resizeT;


  /* Misura dove il testo va a capo davvero, prima di spezzarlo in righe. */
  function measureDesc(){
    var host = el.desc;
    descLines = tutte().map(function(art){
      host.textContent = '';
      var words = art.desc.trim().split(/\s+/);
      var probes = words.map(function(word, i){
        var s = document.createElement('span');
        s.textContent = word;
        host.appendChild(s);
        if(i < words.length - 1) host.appendChild(document.createTextNode(' '));
        return s;
      });

      var rows = [], last = null;
      probes.forEach(function(s, i){
        var top = Math.round(s.offsetTop);
        if(last === null || top - last > 2){ last = top; rows.push([]); }
        rows[rows.length - 1].push(words[i]);
      });

      return rows.map(function(r){ return r.join(' '); });
    });
    host.textContent = '';
  }

  function renderDescLines(rows){
    var host = el.desc;
    host.textContent = '';
    return rows.map(function(text){
      var s = document.createElement('span');
      s.className = 'studio-line';
      s.textContent = text;
      host.appendChild(s);
      return s;
    });
  }

  /* Il titolo diventa una <span> per lettera, raggruppate per parola cosi'
     che l'a capo cada solo sugli spazi. */
  function splitTitle(text){
    var host = el.headline;
    host.textContent = '';
    host.setAttribute('aria-label', text);

    var out = [], word = null;
    for(var i = 0; i < text.length; i++){
      var ch = text[i];
      var span = document.createElement('span');
      span.setAttribute('aria-hidden', 'true');

      if(ch === ' '){
        span.className = 'studio-space';
        span.textContent = ' ';
        host.appendChild(span);
        word = null;
      } else {
        span.className = 'studio-char';
        span.textContent = ch;
        out.push(span);
        if(!word){
          word = document.createElement('span');
          word.className = 'studio-word';
          host.appendChild(word);
        }
        word.appendChild(span);
      }
    }
    return out;
  }

  /* Ogni riga viene avvolta in .studio-ln: scorre l'involucro, la riga fa da
     finestra. wrapInner per chi e' gia' un blocco, wrapOuter per il bottone,
     che ha bisogno di una finestra propria per non farsi tagliare il focus. */
  function wrapInner(node){
    if(!node) return null;
    var w = node.firstElementChild;
    if(w && w.className === 'studio-ln') return w;
    w = document.createElement('span');
    w.className = 'studio-ln';
    while(node.firstChild) w.appendChild(node.firstChild);
    node.appendChild(w);
    return w;
  }

  function wrapOuter(node){
    if(!node) return null;
    var parent = node.parentNode;
    if(parent && parent.className === 'studio-ln') return parent;
    var box = document.createElement('span');
    box.className = 'studio-win';
    var w = document.createElement('span');
    w.className = 'studio-ln';
    parent.insertBefore(box, node);
    w.appendChild(node);
    box.appendChild(w);
    return w;
  }

  function collectLines(i){
    if(el.stats){
      ['studio-stats__label--3', 'studio-stats__value--dim2'].forEach(function(cls){
        var node = el.stats.querySelector('.' + cls);
        if(node) node.classList.add('studio-line');
      });
    }

    var btn = el.info.querySelector('.white-bubble-btn, .studio-btn, a, button');

    return {
      stats: el.stats
        ? Array.prototype.slice.call(el.stats.querySelectorAll('.studio-line'))
              .map(wrapInner).filter(Boolean)
        : [],
      info:  renderDescLines(descLines[i])
                  .map(wrapInner)
                  .concat([ el.price ? wrapInner(el.price) : null,
                            btn      ? wrapOuter(btn)      : null ])
                  .filter(Boolean)
    };
  }

  function fill(i, senzaTitolo){
    var art = opera(i);
    if(!art) return;

    if(el.year) el.year.textContent = art.year;

    if(el.dims){
      el.dims.textContent = '';
      if(/²$/.test(art.dimensions)){
        el.dims.appendChild(document.createTextNode(art.dimensions.slice(0, -1)));
        var sup = document.createElement('sup');
        sup.textContent = '2';
        el.dims.appendChild(sup);
      } else {
        el.dims.textContent = art.dimensions;
      }
    }

    if(el.medium) el.medium.textContent = art.medium;
    if(el.price){ el.price.textContent = art.price; el.price.classList.add('studio-win'); }
    if(el.cta)    el.cta.textContent = art.cta;

    if(!senzaTitolo) chars = splitTitle(art.title);
    lines = collectLines(i);
  }

  function setPage(p, x, skew){
    p.page.style.transform   = 'translate3d(' + x + 'px,0,0) skewX(' + skew + 'deg)';
    p.cancel.style.transform = 'translate3d(' + (-x) + 'px,0,0) skewX(' + (-skew) + 'deg)';
  }

  function setImg(p, x, scale){
    p.img.style.transform = 'translate3d(' + x + 'px,0,0) scale(' + scale + ')';
  }

  function resetPage(p, src){
    if(src) p.img.style.backgroundImage = 'url("' + src + '")';
    setPage(p, 0, 0);
    setImg(p, 0, 1);
  }

  /* Un fotogramma della scivolata. Lo skew segue la velocita' della curva,
     non il tempo: e' qui che il foglio sembra avere una massa. */
  function step(t, dir){
    var e = ease(t);
    var speed = easeSpeed(t) / MAX_SPEED;
    var q = easeInOutQuad(t);

    setPage(back, (1 - e) * stageW * dir, SKEW * speed * dir);
    setImg(back, (1 - e) * stageW * (IN_SHIFT / 100) * dir, 1 + (IN_SCALE - 1) * (1 - e));
    setImg(front, q * stageW * (OUT_SHIFT / 100) * dir, 1 + (OUT_SCALE - 1) * q);
  }

  /* Uscita ed entrata del testo, estratte da go() perché possa chiamarle
     anche chi non sta cambiando opera. dir dà il verso: da che parte se ne
     vanno le lettere e da che parte rientrano. */
  function esce(tl, vecchiChars, vecchieLines, dir){
    var from = dir > 0 ? 'start' : 'end';

    tl.to(vecchiChars, {
      rotationY: TITLE_OUT_ROT * dir,
      opacity: 0,
      duration: TITLE_OUT_DUR,
      ease: 'power1.in',
      stagger: { each: TITLE_OUT_STAGGER, from: from }
    }, TITLE_OUT_AT);

    /* La colonna delle statistiche puo' non esserci: e' un blocco che il
       Designer puo' tenere nascosto, e Webflow gli elementi nascosti non li
       pubblica proprio. Senza questa guardia GSAP riceve un array vuoto e
       avvisa a ogni transizione — due warning per giro, che dopo qualche
       minuto di autoplay diventano una console illeggibile. Il carosello
       deve funzionare con o senza quella colonna. */
    if(vecchieLines.stats.length) tl.to(vecchieLines.stats, {
      yPercent: LINES_OUT_Y, duration: LINES_OUT_DUR, ease: 'power4.inOut', stagger: LINES_OUT_STAGGER
    }, LINES_OUT_AT);

    if(vecchieLines.info.length) tl.to(vecchieLines.info, {
      yPercent: LINES_OUT_Y, duration: LINES_OUT_DUR, ease: 'power4.inOut', stagger: LINES_OUT_STAGGER
    }, LINES_OUT_AT);
  }

  /* Va chiamata dopo fill(): legge chars e lines appena ricostruiti. */
  function entra(dir, onDone){
    var from = dir > 0 ? 'start' : 'end';

    gsap.set(chars, {
      rotationY: TITLE_IN_ROT * dir,
      opacity: 0,
      transformPerspective: PERSPECTIVE,
      transformOrigin: '0% 50%'
    });
    var allLines = [].concat(lines.stats, lines.info);
    if(allLines.length) gsap.set(allLines, { yPercent: LINES_IN_Y, opacity: 1 });

    var tl = gsap.timeline({ onComplete: onDone });

    tl.to(chars, {
      rotationY: 0,
      opacity: 1,
      duration: TITLE_IN_DUR,
      ease: 'power3.out',
      stagger: { each: TITLE_IN_STAGGER, from: from }
    }, 0);

    if(lines.stats.length) tl.fromTo(lines.stats,
      { yPercent: LINES_IN_Y },
      { yPercent: 0, duration: LINES_IN_DUR, ease: 'power4.out', stagger: STATS_IN_STAGGER,
        immediateRender: false, overwrite: 'auto' },
      STATS_IN_AT - SWAP_AT);

    if(lines.info.length) tl.fromTo(lines.info,
      { yPercent: LINES_IN_Y },
      { yPercent: 0, duration: LINES_IN_DUR, ease: 'power4.out', stagger: INFO_IN_STAGGER,
        immediateRender: false, overwrite: 'auto' },
      INFO_IN_AT - SWAP_AT);

    return tl;
  }

  function go(dir){
    if(busy) return;
    busy = true;

    var nextIndex = (index + dir + ARTWORKS.length) % ARTWORKS.length;
    var art       = ARTWORKS[nextIndex];
    var oldChars  = chars;
    var oldLines  = lines;

    resetPage(back, art.img);
    back.page.style.zIndex  = '2';
    front.page.style.zIndex = '1';
    setPage(back, stageW * dir, 0);
    setImg(back, stageW * (IN_SHIFT / 100) * dir, IN_SCALE);
    root.classList.add('is-busy');

    var prog = { t:0 };
    var tl   = gsap.timeline();

    tl.to(prog, {
      t: 1,
      duration: SLIDE_DUR,
      ease: 'none',
      onUpdate:   function(){ step(prog.t, dir); },
      onComplete: function(){ resetPage(back); }
    }, 0);

    esce(tl, oldChars, oldLines, dir);

    tl.call(function(){
      fill(nextIndex);
      entra(dir, function(){
        index = nextIndex;
        var swap = front; front = back; back = swap;
        root.classList.remove('is-busy');
        busy = false;
      });
    }, null, SWAP_AT);

    setPager(nextIndex);
    restartAutoplay();
  }

  function restartAutoplay(){
    if(autoTimer) autoTimer.kill();
    if(fillTween) fillTween.kill();
    if(el.fill) gsap.set(el.fill, { scaleX:0 });
    /* Mentre il blocco e' prestato al reel l'autoplay deve restare fermo.
       Se si carica la pagina gia' dentro il reel, il prestito avviene subito
       ma le immagini finiscono di scaricarsi dopo, e la coda del preload
       faceva ripartire l'autoplay lo stesso: sei secondi dopo arrivava
       un'opera a sovrascrivere il testo del reel. */
    if(reduced || prestato) return;

    if(el.fill) fillTween = gsap.to(el.fill, { scaleX:1, duration:AUTOPLAY, ease:'none' });
    autoTimer = gsap.delayedCall(AUTOPLAY, function(){ go(1); });
  }

  function setPager(i){
    var n = ARTWORKS.length;
    if(el.numCur)  el.numCur.textContent  = String(i + 1);
    if(el.numNext) el.numNext.textContent = String((i + 1) % n + 1);
  }

  /* Il titolo piu' lungo del set detta il corpo: cosi' non cambia da un'opera
     all'altra. Si misura fuori schermo, con gli stessi attributi tipografici. */
  function headlineMax(){
    var v = parseFloat(getComputedStyle(root).getPropertyValue(HEADLINE_VAR));
    return (v > 0 && v <= 1) ? v : HEADLINE_MAX;
  }

  function fitHeadline(){
    var host = el.headline;
    host.style.fontSize = '';

    var cs   = getComputedStyle(host);
    var size = parseFloat(cs.fontSize);

    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;'
      + 'font-family:' + cs.fontFamily
      + ';font-weight:' + cs.fontWeight
      + ';letter-spacing:' + cs.letterSpacing
      + ';font-size:' + size + 'px';
    document.body.appendChild(probe);

    var widest = 0;
    tutte().forEach(function(art){
      probe.textContent = art.title;
      widest = Math.max(widest, probe.offsetWidth);
    });
    probe.remove();

    var room = headlineMax() * root.clientWidth;
    if(widest > room) host.style.fontSize = (size * room / widest) + 'px';
  }

  function crossfade(dir){
    var i = (index + dir + ARTWORKS.length) % ARTWORKS.length;
    resetPage(back, ARTWORKS[i].img);
    back.page.style.zIndex  = '2';
    front.page.style.zIndex = '1';

    gsap.fromTo(back.page, { opacity:0 }, {
      opacity: 1, duration: 0.25, ease: 'none',
      onComplete: function(){
        var swap = front; front = back; back = swap;
        back.page.style.opacity = '1';
      }
    });

    fill(i);
    index = i;
    setPager(index);
  }

  function navigate(dir){
    if(busy) return;
    if(reduced) crossfade(dir);
    else        go(dir);
  }

  function onClick(node, dir){
    if(!node) return;
    node.addEventListener('click', function(e){
      e.preventDefault();
      navigate(dir);
    });
  }

  function remeasure(){
    stageW = el.stage.offsetWidth || 1;
    fitHeadline();
    measureDesc();
    /* index e' l'opera corrente, ma se il blocco e' prestato al reel il
       contenuto giusto e' quello prestato. Senza questa distinzione bastava
       che i font finissero di caricare — cosa che succede dopo il prestito,
       se apri la pagina gia' dentro il reel — perche' fill() riportasse su
       il testo dell'opera. */
    if(!busy) fill(prestato ? ARTWORKS.length : index);
  }

  onClick(el.next, 1);
  onClick(el.prev, -1);

  root.addEventListener('keydown', function(e){
    if(e.key === 'ArrowRight') navigate(1);
    if(e.key === 'ArrowLeft')  navigate(-1);
  });

  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      if(autoTimer) autoTimer.pause();
      if(fillTween) fillTween.pause();
    } else {
      if(autoTimer) autoTimer.resume();
      if(fillTween) fillTween.resume();
    }
  });

  window.addEventListener('resize', function(){
    clearTimeout(resizeT);
    resizeT = setTimeout(remeasure, 160);
  }, { passive:true });

  measureDesc();
  fill(0);
  gsap.set(chars, { rotationY:0, opacity:1, transformPerspective:PERSPECTIVE, transformOrigin:'0% 50%' });

  resetPage(front, ARTWORKS[0].img);
  resetPage(back,  ARTWORKS[1 % ARTWORKS.length].img);
  front.page.style.zIndex = '2';
  back.page.style.zIndex  = '1';

  setPager(0);
  fitHeadline();

  /* L'autoplay parte solo a immagini scaricate: il primo cambio non deve
     cadere su una pagina ancora vuota. */
  Promise.all(ARTWORKS.map(function(art){
    return new Promise(function(done){
      var im = new Image();
      im.onload = im.onerror = done;
      im.src = art.img;
    });
  })).then(function(){
    stageW = el.stage.offsetWidth || 1;
    if(!reduced) restartAutoplay();
  });

  if(document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);


  /* ── il blocco in prestito ────────────────────────────────────────────────
     La sezione sotto vuole lo stesso blocco di testo: stesso nodo, stesse
     animazioni, contenuto diverso. Invece di rifargliele, gliele si presta.

     Il contenuto va REGISTRATO una volta sola, da fermi: registra() rimisura
     dove va a capo la descrizione, e per farlo deve svuotare il paragrafo —
     cosa che a metà di una transizione cancellerebbe le righe in volo.
     Da lì in poi presta() e restituisci() sono solo animazione.

     Il blocco resta figlio di .studio-hero anche mentre viaggia: le regole
     .studio-hero.is-busy ... che ritagliano le finestre delle righe sono
     selettori di discendenza, e devono continuare a valere. */
  function fermaAuto(){
    if(autoTimer) autoTimer.kill();
    if(fillTween) fillTween.kill();
    autoTimer = null;
    fillTween = null;
    if(el.fill) gsap.set(el.fill, { scaleX:0 });
  }

  /* ── la tendina sul titolo ───────────────────────────────────────────────
     Nel passaggio al reel il titolo non esce per farne entrare un altro:
     cambia sul posto, lettera per lettera. Ognuna sale dietro il proprio
     bordo e la nuova la segue da sotto.

     Il punto delicato sono gli spazi. "WHISPER IN THE VOID" e "SHOP OUR
     PRODUCTS" hanno le parole in posizioni diverse, quindi accoppiare la
     lettera i della vecchia con la i della nuova infila gli spazi in mezzo
     alle parole. Invece ogni casella si allarga o si stringe passando dalla
     misura della lettera vecchia a quella della nuova: agli estremi della
     corsa le parole tornano dritte da sole. */
  var host = el.headline;   /* usata da passiDi e dalla tendina */

  var RITMO       = 1;      /* moltiplica TUTTA la consegna. 0.8 la accorcia
                               di un quinto, 1.2 la allunga. È la manopola da
                               girare per prima se sembra lenta o frettolosa. */
  var TEND_DUR    = 0.34;   /* s di corsa della singola lettera            */
  var TEND_ONDA   = 0.26;   /* sfasamento COMPLESSIVO, spalmato su tutte le
                               lettere — non per lettera. Con un ritardo
                               fisso a lettera un titolo lungo ci metteva il
                               doppio di uno corto, ed è il motivo per cui
                               sembrava partire in ritardo e a caso.        */
  var TEND_STACCO = 0.50;   /* dove finisce l'uscita e comincia l'entrata  */

  /* Le tre fasi si accavallano invece di aspettarsi: il titolo parte mentre
     le righe stanno ancora uscendo, e le righe nuove rientrano mentre
     l'ultima lettera sta ancora arrivando. Si legge lo stesso — perché a
     muoversi sono zone diverse dello schermo — e dura molto meno. */
  var TITOLO_AT   = 0.20;   /* quando parte il titolo, dentro l'uscita righe */
  var RIGHE_SOTTO = 0.12;   /* di quanto le righe nuove anticipano la fine   */

  function cl01(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function dolce(t){ return 1 - Math.pow(1 - t, 3); }   /* come power3.out */

  /* Le larghezze non si stimano carattere per carattere: si LEGGONO dal
     titolo davvero impaginato. Sommare i glifi non riproduce il kerning, il
     letter-spacing negativo né il margine fra le parole, e il titolo
     scattava di lato appena partiva la tendina.
     Qui si misura la struttura normale — quella che splitTitle() produce —
     una volta per il testo vecchio e una per il nuovo, e si prende come
     larghezza di ogni casella la distanza fra una lettera e la successiva.
     Cosi' i due estremi della corsa sono esatti per costruzione. */
  function passiDi(testo, gia){
    var lettere = gia || splitTitle(testo);
    var bordo = [], k = 0, i, r;

    for(i = 0; i < testo.length; i++){
      if(testo.charAt(i) === ' '){ bordo.push(null); continue; }
      r = lettere[k++].getBoundingClientRect();
      bordo.push(r);
    }

    /* Uno spazio prende il bordo della lettera che lo segue: cosi' la sua
       casella finisce per misurare esattamente lo stacco fra le parole. */
    var sin = new Array(testo.length), prossimo = null;
    for(i = testo.length - 1; i >= 0; i--){
      if(bordo[i]) prossimo = bordo[i].left;
      sin[i] = prossimo;
    }

    var fondo = host.getBoundingClientRect().right;
    var largo = [];
    for(i = 0; i < testo.length; i++){
      var a = sin[i];
      var b = (i + 1 < testo.length) ? sin[i + 1] : null;
      if(a === null){ largo.push(0); continue; }
      if(b === null || b < a) b = bordo[i] ? bordo[i].right : fondo;  /* fine riga o fine titolo */
      largo.push(Math.max(0, b - a));
    }
    return largo;
  }

  function corsaTendina(){ return (TEND_DUR + TEND_ONDA) * RITMO; }

  function tendinaTitolo(nuovo, onDone){
    var vecchio = host.getAttribute('aria-label') || host.textContent || '';

    /* L'altezza della finestra e' quella di UNA riga, non del blocco: se il
       titolo va a capo, il blocco ne misura due e ogni casella verrebbe alta
       il doppio, con la lettera che non esce piu' dall'inquadratura. */
    var cs0 = getComputedStyle(host);
    var alta = parseFloat(cs0.lineHeight);
    if(!alta) alta = (parseFloat(cs0.fontSize) || 0) * 1.2;

    var largoV = passiDi(vecchio, chars);   /* il vecchio e' gia' impaginato */
    var largoA = passiDi(nuovo);            /* il nuovo lo impagina qui      */

    host.textContent = '';
    host.setAttribute('aria-label', nuovo);

    var n = Math.max(vecchio.length, nuovo.length), celle = [], i;
    var parola = null;

    for(i = 0; i < n; i++){
      var v = vecchio.charAt(i), a = nuovo.charAt(i);

      if(a === ' ' || a === ''){
        parola = null;                     /* qui la riga puo' spezzarsi */
      } else if(!parola){
        parola = document.createElement('span');
        parola.className = 'studio-gruppo';
        parola.setAttribute('aria-hidden', 'true');
        host.appendChild(parola);
      }

      var box = document.createElement('span');
      box.className = 'studio-cella';
      box.setAttribute('aria-hidden', 'true');
      box.style.height = alta + 'px';

      var gv = document.createElement('span');
      gv.className = 'studio-g'; gv.textContent = v;
      var ga = document.createElement('span');
      ga.className = 'studio-g'; ga.textContent = a;

      box.appendChild(gv); box.appendChild(ga);
      (parola || host).appendChild(box);

      celle.push({
        box: box, v: gv, a: ga,
        wv: largoV[i] || 0,
        wa: largoA[i] || 0
      });
    }

    function passo(t){
      for(var k = 0; k < celle.length; k++){
        var c = celle[k];
        var q  = cl01((t - k * lag) / TEND_DUR);   /* t già in secondi di corsa */
        /* dentro la casella le due lettere non si incrociano: la vecchia
           esce tutta, la finestra resta vuota un istante, poi entra la nuova */
        var pv = dolce(cl01(q / TEND_STACCO));
        var pn = dolce(cl01((q - TEND_STACCO) / (1 - TEND_STACCO)));
        /* la larghezza invece segue la corsa intera, se no le lettere
           accanto scatterebbero di lato a meta' strada */
        var w  = dolce(q);
        c.box.style.width   = (c.wv + (c.wa - c.wv) * w).toFixed(2) + 'px';
        c.v.style.transform = 'translateY(' + (-pv * 100).toFixed(2) + '%)';
        c.a.style.transform = 'translateY(' + ((1 - pn) * 100).toFixed(2) + '%)';
      }
    }

    /* Lo sfasamento si divide fra le lettere che ci sono: la corsa totale
       del titolo è sempre la stessa, che sia lungo o corto. */
    var lag = n > 1 ? TEND_ONDA / (n - 1) : 0;
    var CORSA = TEND_DUR + TEND_ONDA;
    var prog = { t:0 };
    passo(0);

    return gsap.to(prog, {
      t: 1,
      duration: CORSA * RITMO,
      ease: 'none',
      onUpdate: function(){ passo(prog.t * CORSA); },
      onComplete: function(){
        /* si torna alla struttura di sempre: da qui in poi il titolo e' di
           nuovo fatto di .studio-char, e go() lo sa animare come prima */
        chars = splitTitle(nuovo);
        gsap.set(chars, {
          rotationY: 0, opacity: 1,
          transformPerspective: PERSPECTIVE, transformOrigin: '0% 50%'
        });
        if(onDone) onDone();
      }
    });
  }

  /* Le tre fasi si accavallano appena, invece di aspettarsi in fila: e' la
     differenza fra una consegna che dura 2,2 secondi e una che ne dura 1,4.
     Si legge lo stesso perche' a muoversi sono zone diverse dello schermo —
     prima le righe in basso, poi il titolo, poi di nuovo le righe. */
  function vaiA(i, dir, onDone, secco){
    if(busy) return null;
    busy = true;
    root.classList.add('is-busy');

    /* Al caricamento non c'e' niente da raccontare: se la pagina apre gia'
       dentro il reel, il testo giusto ci deve essere e basta. Animare un
       cambio che nessuno ha visto cominciare sembra solo un difetto. */
    if(secco){
      fill(i);
      gsap.set(chars, {
        rotationY: 0, opacity: 1,
        transformPerspective: PERSPECTIVE, transformOrigin: '0% 50%'
      });
      var subito = [].concat(lines.stats, lines.info);
      if(subito.length) gsap.set(subito, { yPercent: 0, opacity: 1 });
      root.classList.remove('is-busy');
      busy = false;
      if(onDone) onDone();
      return null;
    }

    var vecchie = lines;
    var R = RITMO;

    var tl = gsap.timeline({
      onComplete: function(){
        root.classList.remove('is-busy');
        busy = false;
        if(onDone) onDone();
      }
    });

    /* 1. le righe di adesso se ne vanno dietro il proprio bordo */
    if(vecchie.stats.length) tl.to(vecchie.stats, {
      yPercent: LINES_OUT_Y, duration: LINES_OUT_DUR * R,
      ease: 'power4.inOut', stagger: LINES_OUT_STAGGER * R
    }, 0);
    if(vecchie.info.length) tl.to(vecchie.info, {
      yPercent: LINES_OUT_Y, duration: LINES_OUT_DUR * R,
      ease: 'power4.inOut', stagger: LINES_OUT_STAGGER * R
    }, 0);

    /* 2. il titolo gira, gia' mentre le righe stanno uscendo */
    var partenza = TITOLO_AT * R;
    tl.call(function(){ tendinaTitolo(opera(i).title); }, null, partenza);

    /* 3. le righe nuove rientrano mentre l'ultima lettera sta ancora
          arrivando. Niente scarto fra colonne qui: nella consegna le
          statistiche sono nascoste, quel ritardo lascerebbe solo un buco. */
    var rientro = Math.max(0, partenza + corsaTendina() - RIGHE_SOTTO * R);

    tl.call(function(){
      fill(i, true);   /* righe nuove; il titolo l'ha gia' messo la tendina */

      var tutte = [].concat(lines.stats, lines.info);
      if(tutte.length) gsap.set(tutte, { yPercent: LINES_IN_Y, opacity: 1 });

      if(lines.stats.length) gsap.fromTo(lines.stats,
        { yPercent: LINES_IN_Y },
        { yPercent: 0, duration: LINES_IN_DUR * R, ease: 'power4.out',
          stagger: STATS_IN_STAGGER * R, immediateRender: false, overwrite: 'auto' });

      if(lines.info.length) gsap.fromTo(lines.info,
        { yPercent: LINES_IN_Y },
        { yPercent: 0, duration: LINES_IN_DUR * R, ease: 'power4.out',
          stagger: INFO_IN_STAGGER * R, immediateRender: false, overwrite: 'auto' });
    }, null, rientro);

    /* 4. la timeline resta viva finche' anche le righe sono entrate, se no
          busy tornerebbe falso a meta' e l'autoplay potrebbe rientrare */
    var coda = (LINES_IN_DUR + INFO_IN_STAGGER * 3) * R;
    tl.to({}, { duration: coda }, rientro);

    return tl;
  }

  window.capeStudio = {
    nodo:     el.info,
    occupato: function(){ return busy; },
    inPrestito: function(){ return prestato; },

    /* { title, desc, cta, price } — da chiamare a riposo, una volta. */
    registra: function(contenuto){
      if(!contenuto) return;
      EXTRA = [contenuto];
      measureDesc();
      fitHeadline();
      if(!busy) fill(index);
    },

    /* Esce l'opera, entra il contenuto registrato. */
    presta: function(dir, secco){
      if(prestato || busy || !EXTRA.length) return null;
      fermaAuto();
      prestato = true;
      return vaiA(ARTWORKS.length, dir === undefined ? 1 : dir, null, secco);
    },

    /* Esce il contenuto prestato, rientra l'opera, riparte l'autoplay. */
    restituisci: function(dir, secco){
      if(!prestato || busy) return null;
      prestato = false;
      return vaiA(index, dir === undefined ? -1 : dir, function(){
        if(!reduced) restartAutoplay();
      }, secco);
    }
  };

  document.dispatchEvent(new CustomEvent('cape:studio-ready'));
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
