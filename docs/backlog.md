# Backlog: sistem analizinin tapıntıları

Mənbə: 2026-10-02 tarixli tam kod analizi. ID-lər sabitdir, istifadəçi onlara nömrə ilə istinad edir.
Statuslar: `açıq`, `qismən`, `bağlanıb`. Fayl istinadları funksiya adı ilə verilir, çünki sətir nömrələri dəyişir.

## Xülasə

| ID | Ciddilik | Qısa təsvir | Status |
|---|---|---|---|
| 1 | 🔴 Kritik | Path traversal ilə ixtiyari faylın silinməsi | **bağlanıb** (2026-10-02) |
| 2 | 🔴 Kritik | AI xəta mesajları istifadəçiyə çatmır ("Network error") | açıq |
| 3 | 🔴 Kritik | MongoDB qoşulması gözlənilmir, yazılar in-memory-yə düşür | açıq |
| 4 | 🟠 Yüksək | SRS: interval vaxtı çatmadan böyüyür | açıq |
| 5 | 🟠 Yüksək | "Translation not available" tərcümə kimi saxlanır | açıq |
| 6 | 🟠 Yüksək | Modalda race condition: köhnə AI cavabları yeni sözə yazılır | açıq |
| 7 | 🟠 Yüksək | Multer xətaları 500 qaytarır (400/413 əvəzinə) | açıq |
| 8 | 🟠 Yüksək | Yüklənən faylın tipi əslində yoxlanmır (html/svg) | açıq |
| 9 | 🟠 Yüksək | Açar yoxlaması tam mətn generasiya edir (pul, limit) | açıq |
| 10 | 🟡 Orta | Dublikat yoxlaması natamamdır (update, unique index) | açıq |
| 11 | 🟡 Orta | Yetim şəkil faylları | açıq |
| 12 | 🟡 Orta | dictionaryapi.dev fetch-də timeout yoxdur | açıq |
| 13 | 🟡 Orta | RAG layer 1 regex index işlətmir (full scan) | açıq |
| 14 | 🟡 Orta | `cleanWord` apostrof/tireni silir, əyri dırnaqları saxlayır | açıq |
| 15 | 🟡 Orta | Flashcard status xətası udulur; "Review Again" dublikatlarla | açıq |
| 16 | 🟡 Orta | Bir ümumi `isLoading` hər şeyə təsir edir | açıq |
| 17 | 🟡 Orta | Zod sxemləri handler-lərlə uyğun deyil | açıq |
| 18 | 🟢 Aşağı | Autentifikasiya yoxdur | açıq |
| 19 | 🟢 Aşağı | Test yoxdur, lint sınıqdır | açıq |
| 20 | 🟢 Aşağı | `aiService.ts` təkrarları, siyahılar 5 yerdə | açıq |
| 21 | 🟢 Aşağı | uploads yolu iki cür hesablanır (cwd vs `__dirname`) | açıq |
| 22 | 🟢 Aşağı | uploads git-də, `.gitignore` natamam, `@types/mongoose` artıq | açıq |
| 23 | 🟢 Aşağı | `start.sh` problemləri | açıq |
| 24 | 🟢 Aşağı | ~~README köhnədir~~, shuffle qeyri-bərabərdir | qismən (README 2026-10-02) |

## Təklif olunan iş sırası

1. Təhlükəsizlik: ~~#1~~, #8
2. İstifadəçinin gördüyü buglar: #2, #5, #6 (+ #7 #8 ilə birlikdə)
3. Data bütövlüyü: #3, #4, #10
4. Səmərəlilik: #9, #12, #13
5. İnfrastruktur: lint, `dictionaryService` və SRS üçün testlər (Vitest), `.gitignore`
6. Refaktor: `aiService` təkrarları, ortaq tiplər

---

## Ətraflı

### 1. Path traversal ilə fayl silmə — **bağlanıb**
`dictionaryService.ts` → `deleteLocalImage` yalnız `startsWith('/uploads/')` yoxlayırdı. `path.join` isə `../` hissələrini açırdı. `addWordSchema` `imageUrl`-ə istənilən sətri qəbul edirdi.
Həll: [changelog.md](changelog.md), "2026-10-02 — #1" qeydi.

### 2. AI xəta mesajları itir
Backend AI xətasında 400/502 qaytarır, axios interceptor (`frontend/src/services/api.ts`) `ApiError` atır. Ona görə `response.success === false` budağı heç vaxt işləmir.
- `HomePage.tsx` → `handleGenerateText` `catch`-də həmişə "Network error" göstərir.
- `AITokenModal.tsx` → `handleSubmit` `catch`-də `err.response` və `err.request`-i yoxlayır, amma `ApiError`-da bunlar yoxdur.
- `WordDefinitionModal.tsx`: "Translation error".

**Həll:** `catch`-də `err instanceof ApiError ? err.message : ...`.

### 3. MongoDB qoşulması gözlənilmir
`server.ts`-də `connectDB()` `await` edilmədən `listen` başlayır. İlk saniyələrdə gələn yazılar in-memory-yə düşür və itir. Mongo iş zamanı qopsa, yazılar səssizcə yaddaşa gedir və ID-lər (`"1"`) UUID-lərlə qarışır.
**Həll:** `listen`-dən əvvəl `await connectDB()`. Mongo konfiqurasiya olunubsa, qopanda 503 qaytarmaq.

### 4. SRS interval məntiqi
`dictionaryService.ts` → `computeNextInterval`: status `known` olanda hər "Know" cavabı intervalı ×4 artırır, review vaxtının çatıb-çatmamasından asılı olmayaraq. "Review Again"-dən sonra yenə "Know" demək 7 günü dərhal 28 günə qaldırır.
**Həll:** intervalı yalnız `nextReviewDate <= now` olanda böyütmək.

### 5. Səhv tərcümə saxlanır
`WordDefinitionModal.tsx`: uğursuzluqda `aiTranslation = "Translation not available"`. `handleSubmit` isə `translation.trim() || aiTranslation` götürür.
**Həll:** xəta mesajını ayrıca state-də saxlamaq.

### 6. Modalda race condition
`WordDefinitionModal.tsx`-dəki fetch effekti 3 AI sorğusu göndərir, amma onları ləğv etmir.
**Həll:** `AbortController` və ya `cancelled` flag.

### 7. Multer xətaları → 500
`fileFilter` xətası və `LIMIT_FILE_SIZE` global error handler-ə (`server.ts`) düşür.
**Həll:** upload route-unda multer xətalarını tutub 400/413 qaytarmaq.

### 8. Fayl tipi yoxlanmır
`upload.ts`: `mimetype`-ı müştəri bildirir, uzantı `path.extname(originalname)`-dən gəlir. `.html` və skriptli `.svg` faylları `/uploads`-dan API origin-i altında yayımlana bilər.
Əlaqəli problem: uzantıda boşluq və ya qeyri-latın simvol olsa, #1-dən sonrakı Zod regex-i sözü saxlayarkən 400 qaytarır.
**Həll:** icazəli uzantılar (jpg/jpeg/png/webp/gif) və uzantını mimetype-dan törətmək, SVG olmadan.

### 9. Açar yoxlaması bahadır
`AITokenModal.tsx` → `handleSubmit` açarı yoxlamaq üçün `generateText` çağırır (~500 token). Bu, 15 dəqiqədə 30 sorğuluq AI limitindən də yer tutur.
**Həll:** `/ai/validate-key` endpoint-i, `max_tokens: 1`.

### 10. Dublikatlar
- `updateWord` adı mövcud bir sözə dəyişməyə icazə verir.
- `english` üçün unique index yoxdur, paralel `addWord` sorğuları dublikat yarada bilər.

**Həll:** case-insensitive collation ilə unique index.

### 11. Yetim fayllar
- Yükləmədən sonra `addWord` uğursuz olsa (409), fayl diskdə qalır.
- `updateWord` köhnə şəkli silmir.
- In-memory rejimdə restart-dan sonra fayllar qalır.

Ətraflı: [architecture/image-upload.md](architecture/image-upload.md).

### 12. Timeout yoxdur
`aiContentService.ts` → `lookupDictionaryDefinitions`.
**Həll:** `AbortSignal.timeout(3000)`.

### 13. RAG layer 1 performansı
`aiContentService.ts` → `lookupSavedSenses` `^word$` + `i` regex işlədir, bu da index-dən istifadə etmir.
**Həll:** lowercase sahə və ya collation index.

### 14. `cleanWord`
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

### 19. Test və lint
- Test framework-u yoxdur.
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

### 21. uploads yolu
`server.ts`-də `express.static('uploads')` cwd-yə görədir, `upload.ts`-dəki `uploadPath` isə `__dirname`-ə görə.
**Həll:** `express.static(uploadPath)` (`uploadPath` artıq export olunur).

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
