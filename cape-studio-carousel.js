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
    img:        'https://cdn.prod.website-files.com/696e3bc5b446ecf721fa3bde/6a91a227ba3b60021d7608f9_watermark-removed-Gemini_Generated_Image_jm5yh7jm5yh7jm5y.jpg'
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
    descLines = ARTWORKS.map(function(art){
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

  function fill(i){
    var art = ARTWORKS[i];

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

    chars = splitTitle(art.title);
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

    var from = dir > 0 ? 'start' : 'end';
    var prog = { t:0 };
    var tl   = gsap.timeline();

    tl.to(prog, {
      t: 1,
      duration: SLIDE_DUR,
      ease: 'none',
      onUpdate:   function(){ step(prog.t, dir); },
      onComplete: function(){ resetPage(back); }
    }, 0);

    tl.to(oldChars, {
      rotationY: TITLE_OUT_ROT * dir,
      opacity: 0,
      duration: TITLE_OUT_DUR,
      ease: 'power1.in',
      stagger: { each: TITLE_OUT_STAGGER, from: from }
    }, TITLE_OUT_AT);

    tl.to(oldLines.stats, {
      yPercent: LINES_OUT_Y, duration: LINES_OUT_DUR, ease: 'power4.inOut', stagger: LINES_OUT_STAGGER
    }, LINES_OUT_AT);

    tl.to(oldLines.info, {
      yPercent: LINES_OUT_Y, duration: LINES_OUT_DUR, ease: 'power4.inOut', stagger: LINES_OUT_STAGGER
    }, LINES_OUT_AT);

    tl.call(function(){
      fill(nextIndex);

      gsap.set(chars, {
        rotationY: TITLE_IN_ROT * dir,
        opacity: 0,
        transformPerspective: PERSPECTIVE,
        transformOrigin: '0% 50%'
      });
      gsap.set([].concat(lines.stats, lines.info), { yPercent: LINES_IN_Y, opacity: 1 });

      var back_in = gsap.timeline({
        onComplete: function(){
          index = nextIndex;
          var swap = front; front = back; back = swap;
          root.classList.remove('is-busy');
          busy = false;
        }
      });

      back_in.to(chars, {
        rotationY: 0,
        opacity: 1,
        duration: TITLE_IN_DUR,
        ease: 'power3.out',
        stagger: { each: TITLE_IN_STAGGER, from: from }
      }, 0);

      back_in.fromTo(lines.stats,
        { yPercent: LINES_IN_Y },
        { yPercent: 0, duration: LINES_IN_DUR, ease: 'power4.out', stagger: STATS_IN_STAGGER,
          immediateRender: false, overwrite: 'auto' },
        STATS_IN_AT - SWAP_AT);

      back_in.fromTo(lines.info,
        { yPercent: LINES_IN_Y },
        { yPercent: 0, duration: LINES_IN_DUR, ease: 'power4.out', stagger: INFO_IN_STAGGER,
          immediateRender: false, overwrite: 'auto' },
        INFO_IN_AT - SWAP_AT);
    }, null, SWAP_AT);

    setPager(nextIndex);
    restartAutoplay();
  }

  function restartAutoplay(){
    if(autoTimer) autoTimer.kill();
    if(fillTween) fillTween.kill();
    if(el.fill) gsap.set(el.fill, { scaleX:0 });
    if(reduced) return;

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
    ARTWORKS.forEach(function(art){
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
    if(!busy) fill(index);
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
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
