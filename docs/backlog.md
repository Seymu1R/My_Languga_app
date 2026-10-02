# Backlog: sistem analizinin tapıntıları

Mənbə: 2026-10-02 tarixli tam kod analizi. ID-lər sabitdir, istifadəçi onlara nömrə ilə istinad edir.
Statuslar: `açıq`, `qismən`, `bağlanıb`. Fayl istinadları funksiya adı ilə verilir, çünki sətir nömrələri dəyişir.
**Test:** bəzi açıq bug-lar üçün `backend/tests/`-də `it.fails(...)` testi var (adında backlog ID-si yazılıb). Bug düzələndə həmin test "gözlənilmədən keçdi" deyə düşəcək; onda `.fails` silinməlidir.

## Xülasə

| ID | Ciddilik | Qısa təsvir | Status |
|---|---|---|---|
| 1 | 🔴 Kritik | Path traversal ilə ixtiyari faylın silinməsi | **bağlanıb** (2026-10-02) |
| 2 | 🔴 Kritik | AI xəta mesajları istifadəçiyə çatmır ("Network error") | **bağlanıb** (2026-10-02) |
| 3 | 🔴 Kritik | MongoDB qoşulması gözlənilmir, yazılar in-memory-yə düşür | **bağlanıb** (2026-10-02) |
| 4 | 🟠 Yüksək | SRS: interval vaxtı çatmadan böyüyür | **bağlanıb** (2026-10-02) |
| 5 | 🟠 Yüksək | "Translation not available" tərcümə kimi saxlanır | **bağlanıb** (2026-10-02) |
| 6 | 🟠 Yüksək | Modalda race condition: köhnə AI cavabları yeni sözə yazılır | **bağlanıb** (2026-10-02, testsiz) |
| 7 | 🟠 Yüksək | Multer xətaları 500 qaytarır (400/413 əvəzinə) | **bağlanıb** (2026-10-02) |
| 8 | 🟠 Yüksək | Yüklənən faylın tipi əslində yoxlanmır (html/svg) | **bağlanıb** (2026-10-02) |
| 9 | 🟠 Yüksək | Açar yoxlaması tam mətn generasiya edir (pul, limit) | **bağlanıb** (2026-10-02) |
| 10 | 🟡 Orta | Dublikat yoxlaması natamamdır (update, unique index) | **bağlanıb** (2026-10-02) |
| 11 | 🟡 Orta | Yetim şəkil faylları | qismən (2026-10-02: uğursuz saxlama və redaktə) |
| 12 | 🟡 Orta | dictionaryapi.dev fetch-də timeout yoxdur | **bağlanıb** (2026-10-02) |
| 13 | 🟡 Orta | RAG layer 1 regex index işlətmir (full scan) | **bağlanıb** (2026-10-02) |
| 14 | 🟡 Orta | `cleanWord` apostrof/tireni silir, əyri dırnaqları saxlayır | **bağlanıb** (2026-10-02, testsiz) |
| 15 | 🟡 Orta | Flashcard status xətası udulur; "Review Again" dublikatlarla | açıq |
| 16 | 🟡 Orta | Bir ümumi `isLoading` hər şeyə təsir edir | açıq |
| 17 | 🟡 Orta | Zod sxemləri handler-lərlə uyğun deyil | açıq |
| 18 | 🟢 Aşağı | Autentifikasiya yoxdur | açıq |
| 19 | 🟢 Aşağı | ~~Test yoxdur~~, lint sınıqdır | qismən (backend testləri 2026-10-02) |
| 20 | 🟢 Aşağı | `aiService.ts` təkrarları, siyahılar 5 yerdə | açıq |
| 21 | 🟢 Aşağı | uploads yolu iki cür hesablanır (cwd vs `__dirname`) | **bağlanıb** (2026-10-02) |
| 22 | 🟢 Aşağı | uploads git-də, `.gitignore` natamam, `@types/mongoose` artıq | açıq |
| 23 | 🟢 Aşağı | `start.sh` problemləri | açıq |
| 24 | 🟢 Aşağı | ~~README köhnədir~~, shuffle qeyri-bərabərdir | qismən (README 2026-10-02) |
| 25 | 🟡 Orta | Logger `.env`-dən əvvəl yaradılırdı (`LOG_LEVEL`/`NODE_ENV` nəzərə alınmırdı) | **bağlanıb** (2026-10-02) |
| 26 | 🟡 Orta | Səhv JSON və >10kb body 400/413 əvəzinə 500 qaytarır | **bağlanıb** (2026-10-02) |
| 27 | 🟡 Orta | Yalnız boşluqdan ibarət `english`/`translation` validasiyadan keçir | **bağlanıb** (2026-10-02) |
| 28 | 🟢 Aşağı | AI sxemlərində `word` yalnız boşluqdan ibarət ola bilər | **bağlanıb** (2026-10-02) |
| 29 | 🟢 Aşağı | `PUT /words/:id` buraxılan sahələri rejimdən asılı olaraq fərqli işləyir | açıq |

## Təklif olunan iş sırası

1. Təhlükəsizlik: ~~#1~~, ~~#8~~
2. İstifadəçinin gördüyü buglar: ~~#2~~, ~~#5~~, ~~#6~~, ~~#7~~
3. Data bütövlüyü: ~~#3~~, ~~#4~~, ~~#10~~, ~~#27~~, ~~#26~~, ~~#28~~
4. Səmərəlilik: ~~#9~~, ~~#12~~, ~~#13~~
5. İnfrastruktur: ~~backend testləri~~, frontend testləri, lint, `.gitignore`
6. Refaktor: `aiService` təkrarları, ortaq tiplər

---

## Ətraflı

### 1. Path traversal ilə fayl silmə — **bağlanıb**
`dictionaryService.ts` → `deleteLocalImage` yalnız `startsWith('/uploads/')` yoxlayırdı. `path.join` isə `../` hissələrini açırdı. `addWordSchema` `imageUrl`-ə istənilən sətri qəbul edirdi.
Həll: [changelog.md](changelog.md), "2026-10-02 — #1" qeydi.

### 2. AI xəta mesajları itir — **bağlanıb**
Həll: [changelog.md](changelog.md), "2026-10-02 — #2 + #5" qeydi. İlkin təsvir:
Backend AI xətasında 400/502 qaytarır, axios interceptor (`frontend/src/services/api.ts`) `ApiError` atır. Ona görə `response.success === false` budağı heç vaxt işləmir.
- `HomePage.tsx` → `handleGenerateText` `catch`-də həmişə "Network error" göstərir.
- `AITokenModal.tsx` → `handleSubmit` `catch`-də `err.response` və `err.request`-i yoxlayır, amma `ApiError`-da bunlar yoxdur.
- `WordDefinitionModal.tsx`: "Translation error".

**Həll:** `catch`-də `err instanceof ApiError ? err.message : ...`.

### 3. MongoDB qoşulması gözlənilmir — **bağlanıb**
Həll: rejim açılışda seçilir (`config/storage.ts`), `server.ts` `connectDB`-ni gözləyir, MongoDB rejimində qopma → 503, bax: changelog "#3". İlkin təsvir:
`server.ts`-də `connectDB()` `await` edilmədən `listen` başlayır. İlk saniyələrdə gələn yazılar in-memory-yə düşür və itir. Mongo iş zamanı qopsa, yazılar səssizcə yaddaşa gedir və ID-lər (`"1"`) UUID-lərlə qarışır.
**Həll:** `listen`-dən əvvəl `await connectDB()`. Mongo konfiqurasiya olunubsa, qopanda 503 qaytarmaq.

### 4. SRS interval məntiqi — **bağlanıb**
Həll: vaxtından əvvəl "bilirəm" cədvəli dəyişmir (`isEarlyReview`), bax: changelog "#4". İlkin təsvir:
`dictionaryService.ts` → `computeNextInterval`: status `known` olanda hər "Know" cavabı intervalı ×4 artırır, review vaxtının çatıb-çatmamasından asılı olmayaraq. "Review Again"-dən sonra yenə "Know" demək 7 günü dərhal 28 günə qaldırır.
**Həll:** intervalı yalnız `nextReviewDate <= now` olanda böyütmək.

### 5. Səhv tərcümə saxlanır — **bağlanıb**
Həll: `translationError` ayrı state-dir, bax: changelog "#2 + #5". İlkin təsvir:
`WordDefinitionModal.tsx`: uğursuzluqda `aiTranslation = "Translation not available"`. `handleSubmit` isə `translation.trim() || aiTranslation` götürür.
**Həll:** xəta mesajını ayrıca state-də saxlamaq.

### 6. Modalda race condition — **bağlanıb** (testsiz)
Həll: effektdə `isStale` flag-i, bax: changelog "#6". Avtomatik test yoxdur; frontend testləri qurulanda ilk yazılacaq testdir (#19). İlkin təsvir:
`WordDefinitionModal.tsx`-dəki fetch effekti 3 AI sorğusu göndərir, amma onları ləğv etmir.
**Həll:** `AbortController` və ya `cancelled` flag.

### 7. Multer xətaları → 500 — **bağlanıb**
Həll: [changelog.md](changelog.md), "2026-10-02 — #8 + #7" qeydi. İlkin təsvir:
`fileFilter` xətası və `LIMIT_FILE_SIZE` global error handler-ə (`server.ts`) düşür.
**Həll:** upload route-unda multer xətalarını tutub 400/413 qaytarmaq.

### 8. Fayl tipi yoxlanmır — **bağlanıb**
Həll: [changelog.md](changelog.md), "2026-10-02 — #8 + #7" qeydi. İlkin təsvir:
`upload.ts`: `mimetype`-ı müştəri bildirir, uzantı `path.extname(originalname)`-dən gəlir. `.html` və skriptli `.svg` faylları `/uploads`-dan API origin-i altında yayımlana bilər.
Əlaqəli problem: uzantıda boşluq və ya qeyri-latın simvol olsa, #1-dən sonrakı Zod regex-i sözü saxlayarkən 400 qaytarır.
**Həll:** icazəli uzantılar (jpg/jpeg/png/webp/gif) və uzantını mimetype-dan törətmək, SVG olmadan.

### 9. Açar yoxlaması bahadır — **bağlanıb**
Həll: `POST /api/ai/validate-key` → `AIService.validateKey()` (1 token, temperature 0). Modal artıq mətn generasiya etmir. Bax: changelog "#9". İlkin təsvir:
`AITokenModal.tsx` → `handleSubmit` açarı yoxlamaq üçün `generateText` çağırır (~500 token). Bu, 15 dəqiqədə 30 sorğuluq AI limitindən də yer tutur.
**Həll:** `/ai/validate-key` endpoint-i, `max_tokens: 1`.

### 10. Dublikatlar — **bağlanıb**
Həll: `updateWord` dublikat yoxlaması, `english_unique_ci` unique index, 11000 → `DuplicateWordError`, `PUT` → 409, bax: changelog "#10". İlkin təsvir:
- `updateWord` adı mövcud bir sözə dəyişməyə icazə verir.
- `english` üçün unique index yoxdur, paralel `addWord` sorğuları dublikat yarada bilər.

**Həll:** case-insensitive collation ilə unique index.

### 11. Yetim fayllar — **qismən**
Bağlanıb (2026-10-02, bax: changelog "#11"): fayl yalnız heç bir söz ona istinad etmədikdə silinir (`deleteImageIfUnused`).
- ~~Yükləmədən sonra `addWord` uğursuz olsa (409), fayl diskdə qalır.~~ İndi silinir (redaktə alınmasa da).
- ~~`updateWord` köhnə şəkli silmir.~~ İndi silir.
- Əlavə: `deleteWord` başqa sözün də işlətdiyi şəkli artıq silmir.

Qalır:
- In-memory rejimdə restart-dan sonra fayllar qalır.
- Şəkil yüklənib, amma söz heç saxlanmasa (məsələn, brauzer yükləmə ilə saxlama arasında bağlanıb), fayl qalır.
- Bunlar üçün avtomatik təmizləmə (açılışda istinadsız faylları silmək) qəsdən edilmədi: `uploads` qovluğu hər iki saxlama rejimi üçün ortaqdır (in-memory rejimdə MongoDB sözlərinin şəkillərini "yetim" görərdi), qovluq git-dədir (#22), istifadəçi faylını avtomatik silmək isə geri qaytarıla bilməz. Ehtiyac olsa, ayrıca əl ilə işlədilən skript (əvvəlcə yalnız siyahı) daha təhlükəsizdir.

Ətraflı: [architecture/image-upload.md](architecture/image-upload.md).

### 12. Timeout yoxdur — **bağlanıb**
Həll: `fetch(..., { signal: AbortSignal.timeout(3000) })`, siqnal body oxunuşunu da kəsir. Bax: changelog "#12". İlkin təsvir:
`aiContentService.ts` → `lookupDictionaryDefinitions`.
**Həll:** `AbortSignal.timeout(3000)`.

### 13. RAG layer 1 performansı — **bağlanıb**
Həll: regex əvəzinə `{ collation: ENGLISH_COLLATION }` ilə sorğu, `english_unique_ci` index-indən keçir. Eyni düzəliş `dictionaryService.findWordByEnglish`-ə (dublikat yoxlaması) də edildi. Bax: changelog "#13". İlkin təsvir:
**Qeyd (2026-10-02):** #10 ilə `english_unique_ci` collation index-i (`locale: 'en', strength: 2`) əlavə olundu. Regex əvəzinə `find({ english: word }).collation({ locale: 'en', strength: 2 })` bu index-dən istifadə edər. Ayrıca sahə lazım deyil.
`aiContentService.ts` → `lookupSavedSenses` `^word$` + `i` regex işlədir, bu da index-dən istifadə etmir.
**Həll:** lowercase sahə və ya collation index.

### 14. `cleanWord` — **bağlanıb**
Həll: `frontend/src/utils/text.ts` → `cleanWord`: yalnız kənarlardakı hərf/rəqəm olmayan simvollar silinir, əyri apostroflar `'`-ə çevrilir. Bax: changelog "#14". İlkin təsvir:
`InteractiveText.tsx`: `don't` → `dont`, `well-known` → `wellknown`. `“ ” ’` simvolları silinmir.

### 15. LearningsPage
- `handleSwipeResult` `updateLearningStatus` xətasını yalnız `console`-a yazır.
- "Review Again" növbədəki təkrarlanan sözlərlə birlikdə başlayır.

### 16. Ümumi `isLoading`
Söz saxlanarkən "Generate Text" düyməsi "Generating Text..." göstərir (`AppContext` → `isLoading`).

### 17. Sxem uyğunsuzluqları
`schemas/index.ts`:
- `aiToken` və `provider` optional-dır, amma handler-lər onları tələb edir;
- `languageCode` istifadə olunmur;
- example sentences sxemindəki `level` enum deyil.

### 18. Autentifikasiya yoxdur
API-yə çata bilən hər kəs bütün lüğəti silə və fayl yükləyə bilər. Lokal istifadə üçün qəbul ediləndir.

### 19. Test və lint — qismən
- ~~Test framework-u yoxdur.~~ Backend: Vitest + supertest + mongodb-memory-server, 317 test (bax: changelog 2026-10-02). Frontend testləri hələ yoxdur; istifadəçi 2026-10-02-də onları sonraya saxladı. Qurulanda ilk testlər: #6 (köhnəlmiş cavablar), #2/#5 (`getErrorMessage`, `translationError`).
- `biome.json` 1.x formatındadır, quraşdırılmış Biome isə 2.4-dür, ona görə `npx biome check` konfiqurasiya xətası verir.
- Frontend-də ESLint config faylı yoxdur.

### 20. Təkrarlar
`aiService.ts` (~660 sətir): 5 eyni açar validator-u, 3 eyni OpenAI-compatible generator.
Provider siyahısı bu yerlərdə təkrarlanır:
- `schemas/index.ts`
- `aiService.ts`
- backend tipləri
- frontend tipləri
- `frontend/src/services/api.ts` → `DEFAULT_MODELS`

### 21. uploads yolu — bağlanıb
~~`server.ts`-də `express.static('uploads')` cwd-yə görə idi, `uploadPath` isə `__dirname`-ə görə.~~ İndi `app.ts` `express.static(uploadPath)` istifadə edir (test: `serves the uploaded file from /uploads (#21)`).

### 22. Repo səliqəsi
- `backend/uploads/*.jpg/png` commit olunub.
- `uploads/` və `.idea/` `.gitignore`-da yoxdur.
- `@types/mongoose` artıqdır, mongoose 8 öz tiplərini gətirir.

### 23. `start.sh`
- 20-ci sətirdə artıq `MONGODB_URI` sətri var.
- `mongod` başlamasa da skript davam edir.

### 24. Digər — qismən
- ~~README port 3001 yazır və provider siyahısı səhvdir.~~ README 2026-10-02-də yenidən yazıldı (bax: changelog).
- `LearningsPage` → `initQueue` `sort(() => Math.random() - 0.5)` ilə qarışdırır. Bu, qeyri-bərabər paylanma verir; Fisher–Yates istifadə etmək lazımdır.

### 25. Logger `.env`-dən əvvəl yaradılırdı — bağlanıb
Köhnə `server.ts`-də `dotenv.config()` bütün import-lardan **sonra** çağırılırdı, `logger.ts` isə `LOG_LEVEL` və `NODE_ENV`-i import zamanı oxuyurdu. Nəticədə `.env`-dəki bu dəyərlər logger-ə təsir etmirdi.
Həll: `server.ts`-in ilk sətri `import 'dotenv/config'` oldu.
Davranış dəyişikliyi: `.env`-də `LOG_LEVEL` və ya `NODE_ENV=production` varsa, logger artıq onlara əməl edir.

### 26. Body-parser xətaları → 500 — **bağlanıb**
Həll: error handler `expose: true` olan 4xx xətaları öz statusu ilə qaytarır, bax: changelog "#26". İlkin təsvir:
Səhv JSON (`{"english":`) və 10kb-dan böyük body `express.json` tərəfindən 400/413 statuslu xəta kimi atılır. `app.ts`-dəki global error handler isə həmişə 500 qaytarır.
**Həll:** handler-də `err.status`/`err.type`-a baxmaq (`entity.parse.failed` → 400, `entity.too.large` → 413).
Testlər: `app.test.ts` → `responds 400 for malformed JSON (#26)`, `responds 413 for a JSON body over 10kb (#26)` (`it.fails`).

### 27. Boşluqdan ibarət söz validasiyadan keçir — **bağlanıb**
Həll: `z.string().trim().min(1)...`, bax: changelog "#27". İlkin təsvir:
`addWordSchema`: `z.string().min(1).max(300).transform(trim)` — `min(1)` trim-dən **əvvəl** yoxlanılır. `"   "` keçir və boş sətrə çevrilir. In-memory rejimdə boş söz saxlanılır, Mongo rejimində isə mongoose `required` xətası 500 verir.
**Həll:** `z.string().trim().min(1).max(300)`. `translation` üçün də eyni.
Test: `schemas.test.ts` → `rejects whitespace-only english (#27)` (`it.fails`).

### 28. AI sxemlərində boşluqdan ibarət `word` — **bağlanıb**
Həll: ortaq `wordSchema` (`trim().min(1).max(200)`), bax: changelog "#28". İlkin təsvir:
`translateWordSchema`, `pronunciationSchema` və `exampleSentencesSchema`-da `word: z.string().min(1).max(200)` boşluqları silmir, ona görə `"   "` qəbul olunur və AI-a göndərilir. Frontend klik edilən sözü təmizlədiyi üçün praktikada nadirdir, birbaşa API çağırışında isə mümkündür.
**Həll:** #27 kimi `z.string().trim().min(1, ...)`. Testlər: `schemas.test.ts` və `routes.ai.test.ts`.

### 29. `PUT /words/:id` buraxılan sahələr
2026-10-02-də #11 üzərində işləyərkən tapıldı. `updateWord` bütün sahələri əvəz edir, amma buraxılan istəyə bağlı sahələrdə (`pronunciation`, `referenceSentence`, `imageUrl`) iki rejim fərqli davranır:
- in-memory: `{ ...word, ...fields }` `undefined` dəyərləri də yazır, sahə sözdən **silinir**;
- MongoDB: mongoose `undefined` sahələri yeniləmədən çıxarır, köhnə dəyər **qalır**.
Frontend `PUT`-u hələ çağırmır, ona görə istifadəçi buna rast gəlmir. #11-in şəkil təmizləməsi hər iki halda düzgündür (faylın taleyi sözün həqiqi vəziyyətinə görə həll olunur).
**Həll:** semantikanı seçmək (tam əvəz və ya qismən yeniləmə) və hər iki rejimi ona uyğunlaşdırmaq. Testi `dictionaryService.test.ts`-də hər iki rejimdə.
