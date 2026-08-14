# prime-agent-pxpipe

> Native **pxpipe** context compression for **Prime-Agent** — no external proxy, no `warp`, no provider swap.

<p align="center">
  <img src="assets/workflow-overview.png" alt="prime-agent-pxpipe workflow overview" width="100%" />
</p>

<p align="center">
  <strong>Compress large Prime-Agent context natively</strong><br/>
  Keep your normal OAuth/provider flow, get persistent ON/OFF state, live savings feedback, GitHub auto-update, and community-friendly slash commands.
</p>

<p align="center">
  <a href="#-installazione-1-comando">Installazione</a> •
  <a href="#-comandi">Comandi</a> •
  <a href="#-auto-update">Auto-update</a> •
  <a href="#-disinstallazione-completa">Disinstallazione</a> •
  <a href="#-pubblicare-il-tuo-fork-su-github">Pubblicare il fork</a>
</p>

---

## 🎨 Preview

<p align="center">
  <img src="assets/hero-banner.png" alt="prime-agent-pxpipe dark preview banner" width="100%" />
</p>

---

## ✨ Perché esiste

`prime-agent-pxpipe` integra **pxpipe** direttamente nel ciclo di richiesta di Prime-Agent usando `before_provider_request`.

In pratica:

- intercetta il payload verso il provider;
- comprime il contesto pesante con `pxpipe-proxy`;
- restituisce il payload trasformato a Prime-Agent;
- **non** cambia il tuo metodo di login;
- **non** richiede proxy HTTP esterni o `warp`;
- mostra un **widget live** con token risparmiati e immagini usate.

---

## 🚀 Highlights

- ✅ installazione con **un solo comando**
- ✅ `gpt-5.6-sol` supportato di default
- ✅ stato globale **ON/OFF persistente**
- ✅ widget unico sotto l'editor, aggiornato **dopo la risposta dell'IA**
- ✅ totale sessione persistente dopo `/reload` e resume
- ✅ **auto-update da GitHub** per installazioni Git non pinnate
- ✅ alias `/pxpipe-*` per compatibilità con l'autocomplete di Prime-Agent
- ✅ `/pxpipe-uninstall` + `uninstall.sh` per rimozione completa
- ✅ modalità **fail-open**: se pxpipe o l'updater falliscono, Prime-Agent continua a funzionare

---

## 🖼️ Come funziona

<p align="center">
  <img src="assets/workflow-overview.png" alt="Workflow overview" width="100%" />
</p>

---

## 📦 Installazione 1 comando

Una volta pubblicato su GitHub:

```bash
prime-agent package install git:github.com/SiNaPsEr0x/prime-agent-pxpipe
```

Poi avvia normalmente:

```bash
prime-agent
```

`pxpipe` parte **ON di default**.

### Installazione mentre sei già dentro Prime-Agent

Se la tua build supporta il prefisso shell `!`:

```text
!prime-agent package install git:github.com/SiNaPsEr0x/prime-agent-pxpipe
/reload
```

---

## 🧪 Installazione locale per test/sviluppo

```bash
git clone https://github.com/SiNaPsEr0x/prime-agent-pxpipe.git
cd prime-agent-pxpipe
./install.sh
```

---

## ⚡ Widget live

Esempio di output tipico:

```text
⚡ pxpipe v1.2.0 ✓ -1.577 tok (-25,9%) · 3 img · 6.094 → 4.517 · sess ~1.577 tok
```

Con contesti più grossi e molte history/tool call:

```text
⚡ pxpipe v1.2.0 ✓ -10.273 tok (-30,7%) · 16 img · 33.416 → 23.143 · sess ~10.273 tok
```

> Il valore è una **stima di risparmio** basata su `baselineImagedTokens`, `imageTokens` e `nativeInjectedTokens`. Non è una promessa di billing identico.

---

## 🕹️ Comandi

### Comando principale

| Comando | Azione |
|---|---|
| `/pxpipe` | stato + aiuto |
| `/pxpipe on` | attiva pxpipe e salva lo stato |
| `/pxpipe off` | disattiva pxpipe e salva lo stato |
| `/pxpipe status` | mostra statistiche sessione + update |
| `/pxpipe update` | forza subito il controllo aggiornamenti |
| `/pxpipe autoupdate on` | abilita auto-update |
| `/pxpipe autoupdate off` | disabilita auto-update |
| `/pxpipe autoupdate status` | mostra stato update |
| `/pxpipe bug` | mostra URL GitHub Issues |
| `/pxpipe uninstall` | avvia la rimozione completa |
| `/pxpipe help` | aiuto completo |

### Alias top-level per autocomplete

| Alias | Azione |
|---|---|
| `/pxpipe-on` | attiva |
| `/pxpipe-off` | disattiva |
| `/pxpipe-status` | statistiche |
| `/pxpipe-update` | update manuale |
| `/pxpipe-autoupdate` | gestione update |
| `/pxpipe-bug` | issue tracker |
| `/pxpipe-uninstall` | rimozione completa |
| `/pxpipe-help` | aiuto |

---

## 🔄 Auto-update

Per le installazioni **Git non pinnate**, l'auto-update è **ON di default**.

Caratteristiche:

- controlla GitHub al massimo una volta ogni **24 ore**;
- accetta solo update **fast-forward**;
- se trova una nuova versione, la carica nello stesso avvio quando possibile;
- se sei offline o il checkout è divergente, **non rompe nulla**.

### Variabili ambiente utili

```bash
PRIME_PXPIPE_MODELS=gpt-5.6-sol,gpt-5.5 prime-agent
PRIME_PXPIPE_AUTO_UPDATE=0 prime-agent
PRIME_PXPIPE_UPDATE_INTERVAL_HOURS=6 prime-agent
```

### Stato persistente

Salvato in:

```text
~/.prime/agent/pxpipe-state.json
```

Esempio:

```json
{
  "version": 2,
  "enabled": true,
  "autoUpdate": true,
  "updateIntervalHours": 24,
  "lastUpdateCheckAt": "2026-08-14T17:27:25.982Z",
  "lastUpdateAt": null,
  "lastUpdateVersion": null
}
```

---

## 🧹 Disinstallazione completa

### Dall'interno di Prime-Agent

```text
/pxpipe-uninstall
```

Questo avvia una rimozione **best-effort** di:

- package Prime-Agent;
- file stato `pxpipe-state.json`;
- cartella locale del plugin.

Se la TUI resta aperta, esci e riapri Prime-Agent.

### Da terminale

```bash
./uninstall.sh
```

---

## 🛠️ Pubblicare il tuo fork su GitHub

Se vuoi creare il repository dal tuo PC con **GitHub CLI** già autenticata:

```bash
./publish.sh
```

Lo script:

- inizializza Git se serve;
- crea il commit iniziale;
- crea la repo GitHub;
- imposta `origin`;
- fa il push su `main`.

Variabili opzionali:

```bash
GITHUB_OWNER=SiNaPsEr0x REPO_NAME=prime-agent-pxpipe VISIBILITY=public ./publish.sh
```

---

## 🐞 Segnalazione bug

Dentro Prime-Agent:

```text
/pxpipe-bug
```

Oppure apri direttamente GitHub Issues.

Quando segnali un bug, includi:

1. versione Prime-Agent
2. OS / WSL / distro Linux
3. modello usato
4. output di `/pxpipe-status`
5. passi per riprodurre
6. comportamento atteso
7. comportamento reale

> Non pubblicare mai API key, OAuth token, segreti o prompt sensibili.

---

## 🧩 Struttura del progetto

```text
prime-agent-pxpipe/
├── assets/
│   ├── hero-banner.png
│   └── workflow-overview.png
├── extensions/
│   └── pxpipe.js
├── lib/
│   ├── runtime.js
│   ├── state.js
│   └── updater.js
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── install.sh
├── uninstall.sh
├── publish.sh
├── package.json
└── README.md
```

---

## 📌 Compatibilità

Tested target:

- Prime-Agent `0.7.2`
- Node `>=20`
- WSL / Linux
- `pxpipe-proxy` `0.13.x`
- modello predefinito `gpt-5.6-sol`

---

## ⚠️ Caveat importante

La compressione context-to-image di pxpipe è **lossy**.

Quindi è ottima per contesto grande, cronologia, strumenti e testo descrittivo, ma **non** è ideale quando ti serve precisione assoluta su:

- hash
- token segreti
- identificatori byte-perfect
- valori esatti molto densi
- stringhe dove ogni carattere conta

---

## 🤝 Contribuire

Vedi [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 Licenza

MIT — vedi [LICENSE](LICENSE).
