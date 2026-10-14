# 🎵 OpenMusic

**OpenMusic** è un social network open-source profondamente improntato alla musica, progettato per offrire uno spazio sereno, veloce e curato dove condividere i propri ascolti in tempo reale, recensire brani e album, creare playlist tematiche e scoprire nuova musica fuori dalla propria bolla algoritmica.

## ✨ Visione del Prodotto
I social generalisti sono rumorosi e le piattaforme di catalogazione musicale storiche hanno interfacce datate o frammentate tra diversi servizi di streaming. **OpenMusic** unisce:
- **Real-Time Presence (stile Discord/Airbuds):** Una barra sempre accessibile (e notifiche live su mobile) che mostra chi dei tuoi amici è online e cosa sta ascoltando in questo preciso istante, indipendentemente dal servizio usato (Spotify, Apple Music, Last.fm, player locali).
- **Recensioni e Rating Duale (stile RateYourMusic / Rotten Tomatoes):** Valutazione di singoli brani e album con aggregatore del **Voto del Pubblico** (e predisposizione per il **Voto della Critica/Webzine**), diario degli ascolti e tag di "vibe".
- **Scoperta Attiva (Roulette & Music Reels):** Modalità di esplorazione tramite "Roulette Russa dei generi" (per uscire dalla propria comfort zone) e feed verticale scorrevole con anteprime audio di 30 secondi.
- **Condivisione Universale & Chat:** Messaggistica diretta per consigliarsi musica con traduzione automatica dei link (tramite codice ISRC) tra diversi servizi di streaming.
- **UI Avvolgente, Veloce e "Anti-AI-Slop":** Nessun layout generico o freddezza artificiale; un design editoriale caldo, animazioni fisiche a 60/120fps e rispetto rigoroso delle 10 Euristiche di Usabilità di Jakob Nielsen.

## 🏗️ Architettura del Monorepo
Il progetto è strutturato come Monorepo TypeScript per garantire massima manutenibilità e condivisione del codice tra Web, Mobile e Backend:
- `apps/mobile`: App iOS e Android (React Native + Expo, Reanimated, Skia).
- `apps/web`: Portale Web con SEO per recensioni, profili e cataloghi (Next.js).
- `apps/api`: Backend modulare REST + WebSockets per lo stato live (Node.js + Fastify/NestJS).
- `packages/db`: Schema database PostgreSQL e client ORM (Prisma).
- `packages/shared`: Tipi TypeScript, validatori (Zod) e logica di dominio condivisa.

## 📚 Documentazione per Sviluppatori e AI
Prima di scrivere codice o aprire una Pull Request, consulta la documentazione tecnica:
1. [Contesto Rapido per Assistenti AI](./AI_CONTEXT.md)
2. [Product Requirements Document (PRD), Personas & User Stories](./docs/01_PRD_AND_PERSONAS.md)
3. [Design System, Anti-AI-Slop & Euristiche di Nielsen](./docs/02_DESIGN_AND_NIELSEN.md)
4. [Architettura Tecnica, Componenti & Integrazioni](./docs/03_ARCHITECTURE_AND_STACK.md)
5. [Stato del Progetto, Roadmap & Open Questions](./docs/04_STATUS_AND_OPEN_QUESTIONS.md)

## 📄 Licenza
Rilasciato sotto licenza **MIT**. Vedi il file `LICENSE` per i dettagli.