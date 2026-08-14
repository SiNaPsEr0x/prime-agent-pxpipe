# prime-agent-pxpipe

<p align="right"><a href="README.md">🇬🇧 English</a></p>

> Compressione nativa del contesto **pxpipe** per **Prime-Agent** — senza proxy esterno, senza `warp`, senza cambiare provider o autenticazione.

<p align="center">
  <img src="assets/workflow-overview.png" alt="Panoramica prime-agent-pxpipe" width="100%" />
</p>

<p align="center">
  <strong>Comprimi il contesto pesante direttamente dentro Prime-Agent.</strong><br/>
  Mantieni il normale flusso OAuth/provider e ottieni stato ON/OFF persistente, statistiche live, auto-update GitHub e comandi slash comodi.
</p>

<p align="center">
  <a href="#-installazione-in-1-comando">Installazione</a> •
  <a href="#-comandi">Comandi</a> •
  <a href="#-auto-update">Auto-update</a> •
  <a href="#-disinstallazione-completa">Disinstallazione</a> •
  <a href="#-segnalare-un-bug">Bug</a>
</p>

---

## ✨ Cosa fa

`prime-agent-pxpipe` integra **pxpipe** direttamente nel ciclo di richiesta di Prime-Agent tramite `before_provider_request`.

In pratica:

- intercetta il payload diretto al provider;
- comprime il contesto eleggibile con `pxpipe-proxy`;
- restituisce il payload trasformato a Prime-Agent;
- non modifica il tuo login OAuth/provider;
- non richiede proxy HTTP esterni;
- mostra un widget live con token risparmiati, immagini e totale sessione;
- funziona in modalità **fail-open**: se pxpipe o l'updater falliscono, Prime-Agent continua a inviare la richiesta originale.

---

## 🚀 Funzioni principali

- ✅ installazione GitHub con **un solo comando**
- ✅ `gpt-5.6-sol` come modello predefinito/testato
- ✅ stato globale **ON/OFF persistente**
- ✅ widget singolo sotto l'editor, aggiornato dopo la risposta dell'IA
- ✅ statistiche della sessione persistenti dopo `/reload` e resume
- ✅ **auto-update da GitHub** per installazioni Git non pinnate
- ✅ alias `/pxpipe-*` visibili nell'autocomplete di Prime-Agent
- ✅ `/pxpipe-uninstall` + `uninstall.sh` per una rimozione completa
- ✅ modalità fail-open per non interrompere l'inferenza

---

## 🖼️ Architettura

<p align="center">
  <img src="assets/hero-banner.png" alt="prime-agent-pxpipe preview" width="100%" />
</p>

```text
Prime-Agent
    ↓
before_provider_request
    ↓
pxpipe-proxy
    ↓
contesto trasformato
    ↓
provider / gpt-5.6-sol
    ↓
risposta AI + widget statistiche
```

---

## 📦 Installazione in 1 comando

```bash
prime-agent package install git:github.com/SiNaPsEr0x/prime-agent-pxpipe
```

Poi avvia normalmente:

```bash
prime-agent
```

`pxpipe` parte **ON di default**.

### Installazione mentre Prime-Agent è già aperto

Se la tua build supporta il prefisso shell `!`:

```text
!prime-agent package install git:github.com/SiNaPsEr0x/prime-agent-pxpipe
/reload
```

### Installazione locale per sviluppo

```bash
git clone https://github.com/SiNaPsEr0x/prime-agent-pxpipe.git
cd prime-agent-pxpipe
./install.sh
```

---

## ⚡ Widget live

Esempio tipico:

```text
⚡ pxpipe v1.2.0 ✓ -1.577 tok (-25,9%) · 3 img · 6.094 → 4.517 · sess ~1.577 tok
```

Su contesti più grandi:

```text
⚡ pxpipe v1.2.0 ✓ -10.273 tok (-30,7%) · 16 img · 33.416 → 23.143 · sess ~10.273 tok
```

Il risparmio mostrato è una **stima** calcolata usando `baselineImagedTokens`, `imageTokens` e `nativeInjectedTokens`. Non rappresenta una garanzia di billing identico.

---

## 🕹️ Comandi

| Comando | Azione |
|---|---|
| `/pxpipe` | stato + aiuto |
| `/pxpipe on` | attiva e salva lo stato |
| `/pxpipe off` | disattiva e salva lo stato |
| `/pxpipe status` | statistiche sessione + update |
| `/pxpipe update` | forza un controllo aggiornamenti |
| `/pxpipe autoupdate on` | abilita auto-update |
| `/pxpipe autoupdate off` | disabilita auto-update |
| `/pxpipe autoupdate status` | stato auto-update |
| `/pxpipe bug` | link alle GitHub Issues |
| `/pxpipe uninstall` | avvia la rimozione completa |
| `/pxpipe help` | aiuto completo |

### Alias per autocomplete

```text
/pxpipe-on
/pxpipe-off
/pxpipe-status
/pxpipe-update
/pxpipe-autoupdate
/pxpipe-bug
/pxpipe-uninstall
/pxpipe-help
```

---

## 🔄 Auto-update

Per le installazioni **Git non pinnate**, l'auto-update è **ON di default**.

Comportamento:

- controllo al massimo ogni 24 ore;
- accetta soltanto aggiornamenti **fast-forward**;
- se il checkout locale diverge, non lo sovrascrive;
- se GitHub è irraggiungibile, il plugin continua a caricarsi;
- se cambiano le dipendenze, esegue `npm install`;
- un errore di update non deve mai bloccare Prime-Agent.

Controllo manuale:

```text
/pxpipe-update
```

Variabili ambiente:

```bash
PRIME_PXPIPE_MODELS=gpt-5.6-sol,gpt-5.5 prime-agent
PRIME_PXPIPE_AUTO_UPDATE=0 prime-agent
PRIME_PXPIPE_UPDATE_INTERVAL_HOURS=6 prime-agent
```

Lo stato persistente viene salvato in:

```text
~/.prime/agent/pxpipe-state.json
```

---

## 🧹 Disinstallazione completa

Da Prime-Agent:

```text
/pxpipe-uninstall
```

La procedura tenta di rimuovere:

- registrazione del package in Prime-Agent;
- `~/.prime/agent/pxpipe-state.json`;
- cartella locale del package.

Se la TUI resta aperta, esci e riapri Prime-Agent.

Da terminale:

```bash
./uninstall.sh
```

---

## 🐞 Segnalare un bug

Dentro Prime-Agent:

```text
/pxpipe-bug
```

Quando apri una issue includi, se possibile:

1. versione Prime-Agent;
2. sistema operativo / WSL / distro;
3. modello utilizzato;
4. output di `/pxpipe-status`;
5. passi minimi per riprodurre;
6. comportamento atteso;
7. comportamento reale.

> Non pubblicare API key, token OAuth, segreti, prompt privati o output sensibile degli strumenti.

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
├── README.md
└── README_IT.md
```

---

## 📌 Compatibilità

Ambiente testato:

- Prime-Agent `0.7.2`
- Node `>=20`
- WSL / Linux
- `pxpipe-proxy` `0.13.x`
- modello predefinito `gpt-5.6-sol`

---

## ⚠️ Nota importante sulla precisione

La compressione context-to-image di pxpipe è **lossy**. È ottima per cronologia, testo descrittivo, output degli strumenti e contesto voluminoso, ma non è consigliata quando serve precisione carattere-per-carattere su:

- hash;
- segreti;
- identificatori byte-perfect;
- valori esatti molto densi;
- stringhe dove ogni carattere conta.

---

## 🤝 Contribuire

Vedi [CONTRIBUTING.md](CONTRIBUTING.md).

## 🙏 Ringraziamenti

Un ringraziamento speciale agli sviluppatori di [Prime-Agent](https://github.com/PrimeIntellect-ai/prime-agent) e [pxpipe](https://github.com/SiNaPsEr0x/pxpipe) per i loro magnifici software e per aver reso possibile questa integrazione.

## 📄 Licenza

MIT — vedi [LICENSE](LICENSE).
