# The Cape — carosello delle opere

Il carosello della sezione studio di **The Cape Studio**. Mostra un'opera alla
volta: al cambio, l'immagine scivola e si deforma, il titolo si sfoglia lettera
per lettera e le righe di testo scorrono dietro il proprio bordo — tutto
insieme, non in fila.

Un file solo. Dipende da **GSAP 3** (solo il core, nessun plugin).

| File | Cosa è | Peso |
|---|---|---|
| `cape-studio-carousel.js` | dati delle opere, timeline, pager | ~21 KB |

---

## Come si include

In fondo al footer — Pages → The Cape Studio → Settings → Custom code →
*Before `</body>` tag*, **dopo** GSAP:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/cash9086/cape-studio-carousel@v1.0.0/cape-studio-carousel.js"></script>
```

Senza GSAP lo script non fa niente e non dà errore.

---

## Il markup che si aspetta

La sezione va marcata con `[data-studio]`. Se manca uno degli elementi
obbligatori lo script si ferma e scrive in console quale.

| Selettore | Obbligatorio | A cosa serve |
|---|---|---|
| `[data-studio]` | sì | la sezione. Riceve `.is-busy` durante la transizione |
| `.studio-headline__row` | sì | contenitore del titolo, riempito lettera per lettera |
| `.studio-stage` | sì | il palco. La sua larghezza è l'unità di misura della scivolata |
| `[data-page="a"]` / `[data-page="b"]` | sì | le due pagine che si scambiano il ruolo |
| `.studio-stage__cancel` | sì (dentro ogni pagina) | annulla lo skew: la cornice si deforma, l'immagine no |
| `.studio-stage__img` | sì (dentro ogni cancel) | riceve l'immagine come `background-image` |
| `.studio-stats` | sì | blocco anno / tecnica / dimensioni |
| `.studio-info` | sì | blocco descrizione / prezzo / bottone |
| `[data-field="desc"]` | sì | la descrizione, spezzata in righe vere |
| `[data-field="year"]`, `[data-field="dimensions"]`, `[data-field="medium"]`, `[data-field="price"]`, `[data-field="cta"]` | no | campi di testo |
| `[data-pager="cur"]` / `[data-pager="next"]` | no | numeri del pager |
| `.studio-pager__fill` | no | barra che si riempie durante l'attesa |
| `[data-nav="prev"]` / `[data-nav="next"]` | no | le frecce |

Le classi `.studio-char`, `.studio-word`, `.studio-space`, `.studio-line`,
`.studio-ln`, `.studio-win` sono **create dallo script**: non esistono nel
Designer e vanno stilate nel custom code della head.

---

## Le manopole

Tutte in cima al file, nel blocco `IMPOSTAZIONI`. I numeri della transizione
sono **secondi sulla linea del tempo**, non ritardi assoluti: `0.13` vuol dire
"a 130 ms dall'inizio della transizione".

### Le opere

`ARTWORKS` — array di oggetti `{title, year, dimensions, medium, desc, price, cta, img}`.
Se `dimensions` finisce con `²` il carattere diventa un vero `<sup>2</sup>`.

### Il ritmo

| Manopola | Default | Cosa fa |
|---|---|---|
| `AUTOPLAY` | `6` | secondi su ogni opera prima del cambio automatico |
| `SLIDE_DUR` | `0.9` | durata della scivolata dell'immagine |
| `SWAP_AT` | `0.73` | **il fulcro**: l'istante in cui i contenuti vengono sostituiti. Prima si parla della vecchia opera, dopo della nuova. `STATS_IN_AT` e `INFO_IN_AT` sono relativi a questo punto, non allo zero |

### La deformazione del foglio

| Manopola | Default | Cosa fa |
|---|---|---|
| `SKEW` | `8` | skew massimo in gradi, **al picco di velocità** |
| `IN_SCALE` / `IN_SHIFT` | `1.45` / `22` | zoom e sfasamento dell'immagine che entra |
| `OUT_SCALE` / `OUT_SHIFT` | `1.5` / `-26` | zoom e sfasamento dell'immagine che esce |

Lo skew non segue il tempo ma la **velocità** della curva: si legge la derivata
dell'easing e la si normalizza sul suo massimo. La pagina si inclina quando
accelera e si raddrizza quando rallenta, come farebbe un foglio vero. È il
motivo per cui nel file c'è un bezier scritto a mano invece di una stringa
GSAP: a GSAP la derivata non si può chiedere.

Alzare `SKEW` sopra ~14 fa sembrare la pagina di gomma. Sotto 4 la
deformazione non si legge e tanto vale togliere il `cancel`.

### Il titolo, lettera per lettera

| Manopola | Default | Cosa fa |
|---|---|---|
| `TITLE_OUT_AT` / `TITLE_OUT_DUR` / `TITLE_OUT_STAGGER` | `0.12` / `0.18` / `0.016` | quando, quanto dura, quanto sfalsa in uscita |
| `TITLE_OUT_ROT` / `TITLE_IN_ROT` | `92` / `-92` | gradi su Y. Il segno è invertito fra uscita ed entrata: escono da un lato, rientrano dall'altro |
| `TITLE_IN_DUR` / `TITLE_IN_STAGGER` | `0.55` / `0.042` | l'entrata è **più lenta** dell'uscita: si legge la parola nuova, non la vecchia che sparisce |
| `PERSPECTIVE` | `620` | prospettiva. Più basso = rotazione più violenta |

Lo stagger parte da `start` andando avanti e da `end` andando indietro: le
lettere si sfogliano nel verso in cui stai navigando.

### Le righe di testo

| Manopola | Default | Cosa fa |
|---|---|---|
| `LINES_OUT_AT` / `LINES_OUT_DUR` / `LINES_OUT_STAGGER` | `0.13` / `0.38` / `0.045` | uscita di stats e info |
| `LINES_OUT_Y` / `LINES_IN_Y` | `-115` / `115` | escono in su, rientrano dal basso. Oltre 100 perché il bordo non deve mai mostrare un mezzo carattere |
| `LINES_IN_DUR` | `0.62` | durata del rientro |
| `STATS_IN_AT` / `INFO_IN_AT` | `0.75` / `1.15` | **relativi a `SWAP_AT`**. Le info arrivano 0.4s dopo le stats: l'occhio le legge in ordine |
| `STATS_IN_STAGGER` / `INFO_IN_STAGGER` | `0.06` / `0.075` | sfalsamento fra righe |

Le righe della descrizione sono **misurate sul testo reale** prima di essere
spezzate: si impaginano le parole una per una, si legge dove cambia
`offsetTop`, e solo allora si ricompongono le righe. L'a capo cade dove
cadrebbe naturalmente, a qualunque larghezza.

### Il titolo che non balla

`HEADLINE_MAX` (`0.28`) — il titolo non supera il 28% della larghezza della
sezione. La misura si fa sul titolo **più lungo del set**, fuori schermo, con
gli stessi attributi tipografici: così il corpo non cambia da un'opera
all'altra. Si rifà a ogni resize e a font caricati.

---

## Accessibilità

- Il titolo spezzato porta `aria-label` con il testo intero; le singole lettere
  sono `aria-hidden`. Uno screen reader legge una parola, non 19 caratteri.
- `prefers-reduced-motion: reduce`: niente autoplay e niente sfoglio. Le frecce
  fanno una dissolvenza da 0.25s.
- L'autoplay si mette in pausa quando la scheda passa in secondo piano.
- Le frecce sinistra/destra funzionano quando il fuoco è dentro la sezione.

---

## Note

- L'autoplay parte solo a immagini scaricate: il primo cambio non cade su una
  pagina ancora vuota.
- Durante la transizione la sezione porta `.is-busy`. È l'aggancio per
  promuovere i layer e per il ritaglio delle righe: a riposo la pagina non
  paga compositing.
- Nessun nodo viene creato o distrutto durante il movimento: le due pagine si
  scambiano il ruolo e basta.
