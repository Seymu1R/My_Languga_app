# Language Teacher 🎓

İngilis dili öyrənmək üçün AI dəstəkli tətbiq. Səviyyənizə uyğun oxu mətni yaradır. Bilmədiyiniz sözə klik edəndə kontekstə uyğun tərcümə, IPA tələffüzü və nümunə cümlələr göstərir. Sözləri şəxsi lüğətinizə yığır və flashcard-larla aralıqlı təkrar (spaced repetition) üsulu ilə öyrədir.

## Funksiyalar

- **Səviyyəyə uyğun oxu mətnləri.** 5 səviyyə var: Elementary, Pre-Intermediate, Intermediate, Upper-Intermediate, Advanced. Mətnin uzunluğu səviyyəyə görə 170–440 söz olur.
- **İnteraktiv oxu.** Mətndəki istənilən sözə klik etdikdə:
  - **Kontekstə uyğun tərcümə** ana dilinizə göstərilir. 13 dil dəstəklənir: Azərbaycan, Türk, Rus, İspan, Fransız, Alman, Çin, Yapon, Ərəb, Polyak, Ukrayna, İtalyan, Portuqal.
    - Tərcümədən əvvəl iki mənbəyə baxılır: lüğətinizdə həmin söz üçün saxladığınız əvvəlki tərcümələr və [Free Dictionary API](https://dictionaryapi.dev/) tərifləri.
    - Model bu məlumatlardan cümləyə uyğun mənanı seçir.
  - **IPA tələffüzü** göstərilir, məsələn `/əˈpɑːrt/`.
  - **3 nümunə cümlə** təklif olunur, biri istinad cümləsi kimi saxlanır.
  - Sözə **şəkil** əlavə etmək olar: JPEG, PNG, WebP və ya GIF, 5MB-a qədər.
- **Şəxsi lüğət.** Bütün sözlər tərcümə, tələffüz, cümlə və şəkillə birlikdə saxlanır.
- **Flashcard-lar (My Learnings).** Kartı sağa sürüşdürmək "bilirəm", sola sürüşdürmək "bilmirəm" deməkdir.
  - Bilinən söz 7 gündən sonra yenidən soruşulur. Hər növbəti "bilirəm" cavabında interval 4 dəfə artır, ən çox 30 günə qədər.
- **Öz AI açarınızla işləyir.** OpenAI, Grok (xAI), Google Gemini, DeepSeek və Mistral dəstəklənir.
  - Açar serverdə saxlanmır. O, brauzerin `sessionStorage`-ında qalır və hər sorğu ilə göndərilir.
  - Server loglarında açar avtomatik maskalanır.
- **MongoDB və ya in-memory.** Rejim server açılanda seçilir. MongoDB-yə qoşulmaq alınsa, bütün data bazada saxlanır. `MONGODB_URI` yoxdursa və ya açılışda qoşulmaq alınmasa (5 san gözləmə), tətbiq in-memory rejimdə işləyir və məlumatlar restart-da itir. MongoDB rejimində bağlantı sonradan qopsa, lüğət sorğuları **503** qaytarır (data itməsin deyə yaddaşa yazılmır) və bağlantı qayıdanda özü bərpa olunur.

| Provider | Modellər |
|---|---|
| OpenAI | `gpt-4o-mini`, `gpt-4o` |
| Grok | `grok-3-mini`, `grok-3-fast` |
| Gemini | `gemini-2.5-flash`, `gemini-2.5-flash-lite` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` |
| Mistral | `mistral-small-latest`, `open-mistral-nemo` |

## Texnologiyalar

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Framer Motion
- **Backend:** Node.js, Express, TypeScript, Mongoose, Zod (validasiya), Multer (şəkil yükləmə), Pino (loglama), Helmet, express-rate-limit
- **AI:** `openai` SDK (OpenAI, Grok, DeepSeek və Mistral üçün OpenAI-uyğun API ilə), `@google/generative-ai`
- **Verilənlər bazası:** MongoDB (məcburi deyil)

## Tələblər

- Node.js **18+**: backend qlobal `fetch`-dən istifadə edir. Backend testləri üçün **20.19+** lazımdır (mongodb-memory-server).
- npm
- MongoDB: məcburi deyil, amma məlumatların saxlanması üçün tövsiyə olunur
- Dəstəklənən providerlərdən birinin API açarı

## Quraşdırma

```bash
npm run install:all
```

Bu əmr kök qovluğun, `frontend/` və `backend/` qovluqlarının dependency-lərini quraşdırır. Hər paketin öz `node_modules`-u var.

### Konfiqurasiya

`backend/.env` faylı:

```env
# MongoDB. Verilməsə server in-memory rejimdə işləyir
MONGODB_URI=mongodb://localhost:27018/language_learning   # start.sh ilə 27018 portu

PORT=7001                         # default: 7001
FRONTEND_URL=http://localhost:5173  # CORS üçün əlavə origin
LOG_LEVEL=info                    # pino log səviyyəsi
NODE_ENV=development              # production → JSON loglar, xəta detalları gizlədilir
UPLOAD_DIR=                       # şəkillərin qovluğu; default: backend/uploads
```

Frontend API ünvanını `VITE_API_ORIGIN`-dən oxuyur, default dəyər `http://localhost:7001`-dir. Lazım olsa `frontend/.env`-də dəyişin.

AI açarı `.env`-ə **yazılmır**. Onu tətbiqin içində "Add AI Token" düyməsi ilə daxil edirsiniz.

## İşə salma

### MongoDB ilə (tövsiyə olunur)

```bash
./start.sh   # mongod-u 27018 portunda işə salır (məlumatlar ~/mongodb_data), sonra tətbiqi
./stop.sh    # MongoDB-ni dayandırır
```

`start.sh` sistemdə `mongod` və `mongosh`-un quraşdırılmasını tələb edir. Bu halda `backend/.env`-dəki `MONGODB_URI` 27018 portuna yönəlməlidir. Başqa üsullar üçün (systemd, Docker) bax: [backend/MONGODB_SETUP.md](backend/MONGODB_SETUP.md).

### MongoDB olmadan

```bash
npm run dev            # backend + frontend birlikdə
npm run dev:backend    # yalnız backend
npm run dev:frontend   # yalnız frontend
```

| Servis | Ünvan |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:7001/api |
| Health check | http://localhost:7001/api/health |

Health check uptime-ı və bazanın vəziyyətini qaytarır:
- `storageMode: "mongodb" | "in-memory"`: server açılanda seçilmiş rejim;
- `database.connected`: bağlantının hazırkı vəziyyəti.

MongoDB rejimində `connected: false` görünürsə, baza müvəqqəti əlçatan deyil, lüğət sorğuları 503 qaytarır.

### İstifadə

1. Yuxarı sağdakı **Add AI Token** düyməsi ilə provider, model və API açarı seçin. Açar 1 tokenlik qısa sorğu ilə yoxlanılır, mətn generasiya olunmur.
2. Ana dilinizi və ingilis dili səviyyənizi seçin.
3. **Generate Text** düyməsini basın.
4. Bilmədiyiniz sözlərə klik edib lüğətə əlavə edin.
5. **My Learnings** bölməsində flashcard-larla təkrar edin.

## Production build

```bash
cd backend && npm run build   # TypeScript → backend/dist
npm run build                 # yalnız frontend → frontend/dist
npm start                     # backend/dist/server.js-i işə salır
```

Qeydlər:
- Kökdəki `npm run build` **yalnız frontend-i** build edir, backend-i ayrıca build etmək lazımdır.
- Backend frontend fayllarını vermir. `frontend/dist`-i ayrıca bir statik serverlə (nginx və s.) yayımlamaq lazımdır.
- Production-da `NODE_ENV=production` qoyun. Əks halda logger devDependency olan `pino-pretty`-ni axtarır.

## API

Bütün cavablar `{ success, ..., error? }` formatındadır. Validasiya xətası 400 qaytarır, `details[]` sahəsində hansı sahənin səhv olduğu göstərilir.

| Metod | Endpoint | Təsvir |
|---|---|---|
| GET | `/api/health` | Server və baza vəziyyəti |
| POST | `/api/ai/validate-key` | Açar və modelin işlədiyini yoxlayır (1 token) |
| POST | `/api/ai/generate-text` | Səviyyəyə uyğun oxu mətni |
| POST | `/api/ai/translate-word` | Kontekstə uyğun tərcümə |
| POST | `/api/ai/pronunciation` | IPA tələffüzü |
| POST | `/api/ai/example-sentences` | 3 nümunə cümlə |
| GET | `/api/dictionary/words` | Bütün sözlər (`?page=&limit=` ilə səhifələmə, limit ≤ 100) |
| GET | `/api/dictionary/words/learnings` | Öyrənilən və təkrar vaxtı çatmış sözlər |
| POST | `/api/dictionary/words` | Söz əlavə et (dublikat → 409) |
| PUT | `/api/dictionary/words/:id` | Sözü yenilə (başqa mövcud sözün adı → 409) |
| PATCH | `/api/dictionary/words/:id/learning-status` | Flashcard nəticəsi: `{ known: boolean }` |
| DELETE | `/api/dictionary/words/:id` | Sözü və onun şəklini sil |
| POST | `/api/dictionary/upload-image` | Şəkil yüklə (`multipart`, sahə: `image`; JPEG/PNG/WebP/GIF, ≤ 5MB; səhv tip → 400, böyük fayl → 413) |

Rate limit: `/api` üçün 15 dəqiqədə 200 sorğu, `/api/ai` üçün əlavə olaraq 15 dəqiqədə 30 sorğu.

## Layihənin strukturu

```
├── backend/
│   ├── src/
│   │   ├── routes/       # HTTP qatı: validasiya + domain xətalarını status kodlarına çevirmək
│   │   ├── services/     # biznes məntiqi (lüğət, SRS, AI providerlər, promptlar)
│   │   ├── models/       # Mongoose modelləri
│   │   ├── schemas/      # Zod sxemləri
│   │   ├── middleware/   # validate, upload
│   │   ├── app.ts        # Express qurulması (createApp): middleware, rate limit, route-lar, health
│   │   └── server.ts     # .env, DB qoşulması, listen, graceful shutdown
│   ├── tests/            # Vitest testləri
│   └── uploads/          # yüklənmiş şəkillər
├── frontend/src/
│   ├── pages/            # Home, Dictionary, Learnings
│   ├── components/       # modallar, flashcard, interaktiv mətn
│   ├── context/          # qlobal state (useReducer)
│   └── services/api.ts   # bütün HTTP sorğuları
├── docs/                 # dəyişiklik tarixçəsi, backlog, arxitektura qeydləri
├── start.sh / stop.sh
└── CLAUDE.md             # Claude Code üçün təlimatlar
```

## İnkişaf

- **Sənədlər:** [docs/](docs/README.md)
  - [backlog.md](docs/backlog.md): məlum problemlər və onların statusu;
  - [changelog.md](docs/changelog.md): edilən dəyişikliklər;
  - [architecture/](docs/architecture/): axınların izahı.
- **Testlər** (backend, Vitest):
  ```bash
  cd backend
  npm test                                   # bütün testlər
  npx vitest run tests/routes.ai.test.ts     # bir fayl
  npx vitest run -t "pagination"             # adına görə
  npm run test:watch                         # dəyişikliklərdə avtomatik
  ```
  Testlər real API-lərə, real verilənlər bazasına və `backend/uploads`-a toxunmur:
  - AI SDK-lar mock olunur;
  - MongoDB testləri müvəqqəti server qaldırır (sistemdə `mongod` varsa onu işlədir);
  - şəkillər müvəqqəti qovluğa yazılır.

  Məlum, hələ düzəldilməmiş bug-lar `it.fails` ilə qeyd olunub; testin adında backlog ID-si var.
- **Tip yoxlaması:**
  ```bash
  cd backend && npm run type-check   # src + tests
  cd frontend && npx tsc --noEmit
  ```
- **Hazırkı məhdudiyyətlər:**
  - frontend üçün avtomatik testlər yoxdur;
  - lint konfiqurasiyası sınıqdır: `biome.json` Biome 2.x ilə uyğun deyil, frontend-də ESLint config yoxdur;
  - autentifikasiya yoxdur, tətbiq lokal, tək istifadəçi üçün nəzərdə tutulub.

  Ətraflı: [docs/backlog.md](docs/backlog.md).
- **Commit mesajları** [Conventional Commits](https://www.conventionalcommits.org/) formatındadır: `feat:`, `fix:`, `test:`, `docs:`, `perf:`, ...

## Lisenziya

MIT
