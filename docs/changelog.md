# Changelog

Ən yeni qeyd yuxarıdadır. Hər qeyd: backlog ID-si, dəyişən fayllar, səbəb, necə yoxlanıldı, qalan məsələlər.

---

## 2026-10-02 — #26 `main`-ə birləşdirildi, yalnız `main` branch-ı saxlanıldı

İstifadəçinin istəyi ilə:
1. **Commit:** `fix/body-parser-errors`-də `50063c3` (`docs:` push qeydi və git iş qaydası).
2. **Merge:** `fix/body-parser-errors` (#26) `main`-ə `--ff-only` ilə birləşdirildi. `main`-də frontend və backend type-check, həmçinin 342 backend testi keçdi.
3. **Lokal branch-lar silindi** (`git branch -d`): `fix/upload-path-traversal`, `fix/ai-error-messages`, `fix/word-modal-stale-responses`, `fix/whitespace-only-words`, `fix/whitespace-only-ai-word`, `fix/body-parser-errors`.
   - `-d` birləşməmiş branch-ı silmir. Hamısı `main`-in içində olduğu yoxlanıldı.
   - `fix/body-parser-errors` əvvəlcə silinmədi: remote kopyasında `50063c3` yox idi. `-D` istifadə edilmədi. Əvvəlcə `main` push olundu, remote branch silindi, sonra `-d` ilə silindi.
4. **Remote:** `main` push olundu, `origin/fix/body-parser-errors` silindi.

**Nəticə:** lokalda və GitHub-da yalnız `main` qaldı.

## 2026-10-02 — GitHub-a push

İstifadəçinin istəyi ilə `origin`-ə (https://github.com/Seymu1R/My_Languga_app) push olundu:
- **`main`:** `e4671f9..298c70f`, 19 commit, fast-forward. `--force` lazım olmadı: remote-da yeni commit yox idi.
- **`fix/body-parser-errors` (#26):** yeni remote branch, upstream qoşuldu. Hələ `main`-ə birləşdirilməyib.

`main`-ə birləşdirilmiş 5 köhnə branch push edilmədi, çünki onların commit-ləri `main` ilə gedir.

Push-dan əvvəl göndəriləcək diff (39 fayl) `.env`/secret fayllarına və real açar formasına (`sk-…`, `AIza…`, 20+ simvol) görə yoxlandı, heç nə tapılmadı.

Commit müəllifi bu repoda `Seymu1R <seymuram@code.edu.az>`-dir (`.git/config`, qlobal ayarı üstələyir). İstifadəçi bunun düzgün olduğunu təsdiqlədi.

## 2026-10-02 — #26: səhv və ya çox böyük request body artıq 500 yox, 400/413 qaytarır

Branch: `fix/body-parser-errors` (`main`-dən). Commit-lər: `b1589d3` (`fix:` + testlər), sonra `docs:`.

**Problem:** `express.json` xətaları `app.ts`-dəki global error handler-ə düşür, handler isə statusa baxmadan həmişə 500 "Something went wrong!" qaytarırdı:
- səhv JSON (`entity.parse.failed`, status 400);
- 10kb-dan böyük body (`entity.too.large`, status 413);
- dəstəklənməyən charset (415).

**Dəyişiklik** (`backend/src/app.ts`, error handler):
- Xətada `expose: true` və 4xx `status` varsa (`http-errors` formatı, body-parser belə yaradır), həmin status `{ success: false, error }` formatında qaytarılır, log səviyyəsi `warn` olur.
- `BODY_ERROR_MESSAGES` oxunaqlı mesajlar verir:
  - `entity.parse.failed` → "Request body is not valid JSON";
  - `entity.too.large` → "Request body is too large (max 10kb)".

  Digər klient xətalarında xətanın öz mesajı qalır (`expose: true` mesajın klientə göstərilməsinin təhlükəsiz olduğunu bildirir).
- Qalan bütün xətalar əvvəlki kimi 500 olur.

**Testlər** (`app.test.ts`, əvvəl yazıldı, köhnə kodda 4/4 düşdü):
- 4 yeni test (`request body errors (#26)`):
  - səhv JSON → 400;
  - >10kb → 413;
  - dəstəklənməyən charset (`no-such-charset`) → 415 öz mesajı ilə;
  - nəticə `NODE_ENV`-dən asılı deyil.
- İki `it.fails` testi çıxarıldı (yeni testlərə daxil oldu).
- "500 handler-i development-də mesajı göstərir və production-da gizlədir" testləri əvvəl səhv JSON-a əsaslanırdı. İndi həqiqi server xətası ilə qurulub: şəkil yükləməsində `fs.promises.open` uğursuz olur → `uploadImage` → `next(err)` → 500.
- Test yazarkən səhv fərziyyə düzəldildi: UTF-7 iconv-lite tərəfindən dəstəklənir, 415 vermir.

**Yoxlama:** `npm test` → 342/342 (əvvəl 340), `npm run type-check` keçdi.

`CLAUDE.md`-yə (Architecture → Backend layering) error handler-in bu davranışı yazıldı.

**Qeyd (düzəldilmədi):** frontend interceptor-u (`services/api.ts`) istənilən 413-də sabit "File is too large. Maximum size is 5MB." göstərir. JSON üçün bu yanlışdır, amma frontend 10kb-dan böyük JSON göndərmir (ən böyük sahə `customPrompt` ≤ 2000 simvoldur).

## 2026-10-02 — #28: AI endpoint-ləri yalnız boşluqdan ibarət sözü rədd edir

Branch: `fix/whitespace-only-ai-word` (`main`-dən). Commit-lər: `85fb0a3` (`fix:` + testlər), `ec7ba53` (`docs:`). İstifadəçinin istəyi ilə `main`-ə `--ff-only` ilə birləşdirildi. Merge-dən sonra `main`-də frontend və backend type-check, həmçinin 340 backend testi keçdi. Push olunmayıb.

**Problem:** `translateWordSchema`, `pronunciationSchema` və `exampleSentencesSchema`-da `word: z.string().min(1).max(200)` boşluqları silmirdi. Nəticədə `"   "` qəbul olunub AI-a göndərilirdi (#27 ilə eyni səbəb), kənar boşluqlar da sözlə birlikdə AI-a gedirdi.

**Dəyişiklik:** `backend/src/schemas/index.ts`. Ortaq `wordSchema = z.string().trim().min(1, 'word is required').max(200)` yaradıldı və üç sxemdə istifadə olunur. Nəticədə servislərə artıq trim olunmuş söz çatır.

**Testlər (əvvəl yazıldı, köhnə kodda 18/18 düşdü):**
- `schemas.test.ts`, hər üç sxem üçün:
  - boşluqdan və tab/yeni sətirdən ibarət söz → "word is required";
  - söz trim olunur;
  - limit trim-dən sonrakı dəyərə tətbiq olunur.
- `routes.ai.test.ts`, hər üç endpoint üçün:
  - boşluqdan ibarət söz → 400 `["word: word is required"]` və AI servisi **çağırılmır**;
  - `"  bank "` → servisə `"bank"` ötürülür.

**Yoxlama:** `npm test` → 340/340 (əvvəl 322), `npm run type-check` keçdi.

**Toxunulmadı:** `targetLanguage` və `generateTextSchema.apiToken` də trim-siz `min(1)`-dir.
- Boşluqdan ibarət açarı `AIService` onsuz da "API key is required" ilə rədd edir.
- `targetLanguage` frontend-də sabit siyahıdan gəlir.

Ona görə ayrıca backlog maddəsi açılmadı.

## 2026-10-02 — #27: yalnız boşluqdan ibarət söz və tərcümə rədd edilir

Branch: `fix/whitespace-only-words` (`main`-dən). Commit-lər: `fcfdaf7` (`fix:` + testlər), `7381174` (`docs:`). İstifadəçinin istəyi ilə `main`-ə `--ff-only` ilə birləşdirildi. Merge-dən sonra `main`-də frontend və backend type-check, həmçinin 322 backend testi keçdi. Push olunmayıb.

**Problem:** `addWordSchema`-da `english` və `translation` üçün qayda `z.string().min(1).max(N).transform(trim)` idi, yəni uzunluq trim-dən **əvvəl** yoxlanılırdı. Nəticələr:
- `"   "` validasiyadan keçib boş sətrə çevrilirdi. In-memory rejimdə boş söz saxlanılırdı, Mongo rejimində mongoose `required` xətası 500 verirdi.
- Uzunluq limiti kənar boşluqları da sayırdı.

Eyni sxem `POST` və `PUT /api/dictionary/words` üçün işlənir.

**Dəyişiklik:** `backend/src/schemas/index.ts` → `english: z.string().trim().min(1, ...).max(300)`, `translation: z.string().trim().min(1, ...).max(500)`.

**Testlər (əvvəl yazıldı, köhnə kodda 6/6 düşdü):**
- `schemas.test.ts`:
  - `it.fails` testi normal testə çevrildi;
  - boşluq, tab və yeni sətirdən ibarət `english`, eləcə də boşluqdan ibarət `translation` → "... is required";
  - limit trim-dən sonrakı dəyərə tətbiq olunur (kənarları boşluqlu 300 simvol keçir).
- `routes.dictionary.test.ts`:
  - `POST` boşluqdan ibarət söz → 400, `details: ["english: english is required"]`, heç nə saxlanmır;
  - `PUT` boşluqdan ibarət tərcümə → 400.

**Yoxlama:** `npm test` → 322/322 (əvvəl 317; 1 `it.fails` 6 yeni testlə əvəzləndi), `npm run type-check` keçdi. Frontend dəyişmədi: o, tərcüməni onsuz da trim edir.

**Commit qaydası dəqiqləşdirildi** (`CLAUDE.md` → Conventions): bug fix və onun testləri eyni commit-də olur. Ayrı olsaydılar, aralıq commit `npm test`-dən keçməzdi (`it.fails` "gözlənilmədən keçdi" və ya yeni test düşərdi).

**Yeni tapıntı (#28, düzəldilmədi):** AI sxemlərində (`translateWordSchema`, `pronunciationSchema`, `exampleSentencesSchema`) `word` də `z.string().min(1)`-dir, `"   "` qəbul edir.

## 2026-10-02 — #6: söz modalında köhnəlmiş AI cavabları artıq yeni sözə yazılmır

Branch: `fix/word-modal-stale-responses` (`main`-dən). Commit-lər: `d1a5c42` (`fix:`), `b17dab9` (`docs:`). İstifadəçinin istəyi ilə `main`-ə `--ff-only` ilə birləşdirildi. Merge-dən sonra `main`-də frontend və backend type-check, həmçinin 317 backend testi keçdi. Push olunmayıb.

**Problem:** `WordDefinitionModal`-ın effekti modal hər açılanda 3 AI sorğusu göndərir: tərcümə, tələffüz və nümunə cümlələr. Sorğular heç vaxt "köhnəlmiş" kimi işarələnmirdi. İstifadəçi A sözünü açıb tez bağlayır və B sözünü açırsa, A-nın gec gələn cavabları B-nin tərcüməsinin, tələffüzünün, cümlələrinin və loading spinner-lərinin üstünə yazılırdı. Save isə B sözünü A-nın tərcüməsi ilə saxlayardı.

**Dəyişiklik** (`frontend/src/components/WordDefinitionModal.tsx`, yalnız bu fayl):
- Effektdə `let isStale = false`. Effektin cleanup-ı onu `true` edir. Cleanup söz və ya kontekst dəyişəndə, modal bağlananda və AI ayarları dəyişəndə işləyir.
- Hər `await`-dən sonra bütün state yazıları (nəticə, xəta və `finally`-dəki loading flag-ləri) `isStale` yoxlayır.
- Effektin əvvəlində üç loading flag-i sıfırlanır. Əks halda modal yükləmə zamanı bağlanarsa və növbəti açılışda AI sorğusu göndərilməzsə (məsələn, AI hazır deyil), spinner əbədi qalardı.
- Sorğular ləğv edilmir (`AbortController` yoxdur). Server AI-ı onsuz da çağırır, ona görə ləğvetmə xərc qənaəti vermirdi, yalnız UI-ı qoruyur.

**Yoxlama:**
- `cd frontend && npx tsc --noEmit` və `vite build` keçdi.
- **Avtomatik test və ya brauzer yoxlaması YOXDUR.** İstifadəçi qərar verdi: hələlik yalnız type-check, frontend testləri sonraya saxlanılır (#19). Race condition-ı brauzerdə təkrarlamaq üçün işləyən AI açarı və Chrome extension-u lazımdır, ikisi də mövcud deyildi.
- Frontend testləri qurulanda bu hal üçün ilk test belə olmalıdır: AI cavabını gecikdir → sözü dəyiş → köhnə cavabı ver → yeni sözün state-inin dəyişmədiyini yoxla.

## 2026-10-02 — #2 + #5: frontend serverin xəta mesajlarını göstərir, xəta mətni tərcümə kimi saxlanmır

Branch: `fix/ai-error-messages` (`main`-dən). Commit-lər: `30c2add` (`fix:`), `abcfeb6` (`docs:`). İstifadəçinin istəyi ilə `main`-ə `--ff-only` ilə birləşdirildi. Merge-dən sonra `main`-də frontend və backend type-check, həmçinin 317 backend testi keçdi. Push olunmayıb.

**Problem:** axios interceptor (`services/api.ts`) hər HTTP xətasını serverin mesajı ilə `ApiError`-a çevirir. Lakin komponentlərin `catch` blokları bu mesajı atıb ümumi mətn göstərirdi. Bu, #2-nin özüdür:
- `HomePage` → "Network error. Please check your connection.";
- `AITokenModal` → `err.response`/`err.request` yoxlanılırdı. `ApiError`-da bunlar yoxdur, ona görə həmişə "Network error" çıxırdı, səhv açar olanda belə;
- `WordDefinitionModal` → "Translation error".

Əlaqəli problem (**#5**): tərcümə xətası `aiTranslation` state-ində saxlanılırdı. Save düyməsi isə `translation.trim() || aiTranslation` götürürdü, yəni "Translation error" və "Translation not available" mətnləri tərcümə kimi saxlanırdı. Real xəta mesajını sadəcə göstərmək bu problemi daha da pisləşdirərdi, ona görə #5 #2 ilə birlikdə həll olundu.

**Dəyişikliklər (yalnız frontend):**
- `services/api.ts`: `getErrorMessage(error, fallback)`. `ApiError`-dursa onun mesajını, deyilsə fallback-i qaytarır.
- `HomePage.tsx`, `AITokenModal.tsx`: `catch` → `getErrorMessage(...)`. `AITokenModal`-dan istifadə olunmayan `API_ORIGIN` importu silindi; "server işləmir" mesajını artıq interceptor verir.
- `WordDefinitionModal.tsx`:
  - yeni `translationError` state-i, `aiTranslation` yalnız real tərcümə saxlayır (#5);
  - xəta tərcümə sahəsinin altında qırmızı mətnlə göstərilir: "... You can still enter your own translation below.";
  - söz saxlanmasa (məsələn, 409 "Word already exists in dictionary"), xəta modalın içində `formError` kimi göstərilir;
  - `onSave` tipi `Promise<void>` oldu;
  - şəkil yükləmə xətası da `getErrorMessage` istifadə edir.
- `InteractiveText.tsx`: `handleSaveWord` xətanı artıq udmur, modal onu göstərir. Əvvəl xəta qlobal state-ə yazılırdı və modalın arxasında, səhifədə görünürdü.
- `DictionaryPage.tsx` (yükləmə, silmə), `LearningsPage.tsx` (yükləmə): eyni kökdən gələn ümumi mesajlar `getErrorMessage` ilə əvəz olundu.
- Toxunulmadı:
  - tələffüz və nümunə cümlələrin xətaları: bunlar könüllüdür və əvvəlki kimi səssizcə boş qalır;
  - `LearningsPage`-də status yeniləmə xətası: #15-in mövzusudur.

**Yoxlama:**
- `cd frontend && npx tsc --noEmit` və `vite build` keçdi. Köhnə ümumi mesajların heç biri kodda qalmayıb.
- Test backend-i (7098) və frontend-i (5199) ilə serverin komponentlərə gələn real cavabları yoxlanıldı:
  - saxta OpenAI açarı ilə `generate-text` → 400 "AI text generation failed: Invalid OpenAI API key...";
  - `translate-word` → 502 "Unable to translate "bank". Invalid OpenAI API key...";
  - dublikat söz → 409 "Word already exists in dictionary".

  Interceptor 400, 502 və 409-da `error` mətnini `ApiError.message`-ə qoyur.
- Backend dəyişmədi, backend testləri 317/317 keçir.
- **Brauzerdə yoxlanılmadı:** Claude in Chrome extension-u qoşulu deyildi. Frontend-də avtomatik test yoxdur (#19). UI davranışı type-check və kod analizi ilə yoxlanıldı.

## 2026-10-02 — İş qaydası: hər backend funksiyası testlə birlikdə yazılır

İstifadəçinin tələbi: bundan sonra yazılan və ya dəyişdirilən **hər backend funksiyası** üçün test yazılmalıdır, eyni dəyişiklikdə.

Qayda `CLAUDE.md`-yə (Conventions → "Backend tests are mandatory") və `docs/README.md`-yə (İş qaydaları, 6-cı bənd) yazıldı. Qısaca:
- **Yeni və ya dəyişən funksiya:** `backend/tests/`-də testi olmalıdır. Uğurlu yol, xəta yolları və kənar hallar yoxlanılır.
- **`dictionaryService`:** testlər hər iki saxlama rejimində (`describe.each`) işləməlidir.
- **Yeni route:** supertest ilə yoxlanılır: uğurlu cavab, validasiya (400), domain xətaları (404/409) və 500.
- **Bug fix:** əvvəlcə bug-ı göstərən test yazılır. `it.fails` testi varsa, `.fails` silinir.
- **"Hazırdır" deməzdən əvvəl:** `npm test` və `npm run type-check` keçməlidir.

## 2026-10-02 — Git: `fix/upload-path-traversal` branch-ı

- `main`-də deyil, yeni `fix/upload-path-traversal` branch-ında işlənir.
- Commit-lər:
  - `96bcda6` — `fix:` #1;
  - `8528332` — `docs:` (`CLAUDE.md`, `docs/`, README). Bu commit-ə `docs/README.md` vəziyyət yeniləməsi `--amend` ilə əlavə olundu; commit push olunmamışdı.
- Sonrakı commit-lər (istifadəçinin istəyi ilə ayrı-ayrı):
  - `86b0d14` — `fix:` #8 + #7 (`upload.ts`, `routes/dictionary.ts`, `WordDefinitionModal.tsx`). `upload.ts`-dəki `UPLOAD_DIR` dəyişikliyi bu commit-ə daxil edilmədi;
  - `fbb40e1` — `refactor:` `app.ts`, `dotenv/config`, `UPLOAD_DIR`, `loggerOptions` (#21, #25);
  - `cc62e8e` — `test:` testlər, Vitest konfiqurasiyası, `package.json`;
  - `docs:` — bu sənəd yeniləmələri.
- **Merge:** istifadəçinin istəyi ilə `main`-ə `--ff-only` ilə birləşdirildi. `main` artıq `27df908`-dir. Merge-dən sonra `main`-də type-check və 317 test keçdi. Push edilməyib.
- `.idea/` istifadəçinindir, commit-lərə daxil edilmir.

## 2026-10-02 — #19 (qismən): backend üçün avtomatik testlər; #21 və #25 bağlandı

**Nə:** backend-in bütün modulları üçün 12 test faylı, cəmi **317 test**. İşə salma: `cd backend && npm test` (~2–3 san).

**Alətlər:**
- Vitest 3. Vitest 5 Node 22.12+ və `@types/node` 22+ tələb edir, layihə isə `@types/node` 20 istifadə edir, ona görə 3.x seçildi.
- HTTP testləri üçün supertest.
- mongodb-memory-server 11 (Node 20.19+ tələb edir). Helper sistemdəki `mongod`-u (8.0) tapır və onu işlədir, binary yüklənmir. Sistemdə `mongod` yoxdursa, ilk işə salmada binary avtomatik yüklənir.

| Fayl | Nəyi yoxlayır |
|---|---|
| `schemas.test.ts` | Bütün Zod sxemləri: limitlər, enum-lar, trim, naməlum sahələrin atılması, `imageUrl` regex-i (#1) |
| `validate.test.ts` | `validate` middleware-i: 400 formatı, `details`, `req.body`-nin əvəzlənməsi |
| `Word.model.test.ts` | Default-lar (UUID, SRS), trim, `toJSON`, validasiya, index-lər |
| `logger.test.ts` | `apiToken`/`aiToken`/`apiKey` redaction-ı |
| `database.test.ts` | `connectDB`: URI yoxdur / uğurlu / uğursuz |
| `dictionaryService.test.ts` | Bütün funksiyalar **həm in-memory, həm MongoDB rejimində eyni testlərlə**: SRS (7 → 28 → 30), learning queue, səhifələmə, dublikatlar, şəkil silmə, #1 regressiyası |
| `aiService.test.ts` | 5 provider (SDK-lar mock olunur): model alias-ları, açar validasiyası, 401/404/429 mesajları, ümumi xəta təsnifatı |
| `aiContentService.test.ts` | Mətn ölçüləri, tərcümə promptunun qatları, cavabın təmizlənməsi, cümlələrin seçilməsi (`AIService` və `fetch` mock olunur) |
| `aiContentService.rag.test.ts` | RAG layer 1: MongoDB-dəki saxlanmış tərcümələr |
| `routes.dictionary.test.ts` | Bütün lüğət endpoint-ləri və status kodları; şəkil yükləmə (#7, #8, #21); "yüklə → saxla → sil" axını |
| `routes.ai.test.ts` | Bütün AI endpoint-ləri (servis mock olunur), 400/502/500, AI rate limit (30) |
| `app.test.ts` | Health (iki rejim), 404, error handler, helmet, CORS, ümumi rate limit (200) |

**Test edilə bilmək üçün kodda edilən dəyişikliklər:**
- `src/app.ts` (yeni): Express tətbiqi `createApp()` ilə qurulur, port açılmır. `server.ts` yalnız `.env`-i yükləyir, DB-yə qoşulur, `listen` edir və shutdown-u idarə edir.
- `server.ts`-in ilk sətri `import 'dotenv/config'` oldu. Bu, **#25**-i düzəltdi: əvvəl logger `.env` yüklənməmişdən əvvəl yaradılırdı.
- `upload.ts`: `uploadPath` `UPLOAD_DIR` env dəyişəni ilə dəyişdirilə bilir (testlər müvəqqəti qovluq verir).
- `app.ts`: `express.static(uploadPath)`. Bu, **#21**-i bağladı.
- `logger.ts`: `loggerOptions` export olunur (redaction testi üçün).
- `tsconfig.test.json`: `npm run type-check` indi `src` ilə birlikdə `tests`-i də yoxlayır. Build (`tsc`) testləri `dist`-ə daxil etmir.

**Testlərin tapdığı və `it.fails` ilə qeyd olunan bug-lar:**
- #4 və #10: hər iki saxlama rejimində təsdiqləndi.
- Yeni **#26**: səhv JSON və >10kb body 400/413 əvəzinə 500 qaytarır.
- Yeni **#27**: yalnız boşluqdan ibarət söz validasiyadan keçir. Mongo rejimində bu 500 ilə nəticələnir (mongoose `required`).

Bug düzələndə uyğun test "gözlənilmədən keçdi" kimi düşür, onda `.fails` silinməlidir.

**Testlərin həqiqətən bug tutduğunun yoxlanması (mutation check):** #1 (`deleteLocalImage`-dəki yol yoxlaması) və #8 (magic bytes) müvəqqəti söndürüldü. Nəticədə 4 test düşdü, sonra kod bərpa olundu. #26 testlərinin həqiqətən 500 aldığı ayrıca yoxlanıldı.

**Digər yoxlamalar:**
- `npm run type-check` (src + tests) və `npm run build` keçdi.
- Real server (`server.ts`) işə düşür, `/uploads` faylları verir və SIGTERM-də düzgün dayanır (exit 0).

**Qalanlar (#19):** frontend testləri yoxdur, lint hələ sınıqdır.

## 2026-10-02 — #8 + #7: yüklənən şəklin tipi yoxlanılır, multer xətaları düzgün status qaytarır

**Problem (düzəlişdən əvvəl real serverdə təkrarlandı):**
- #8: `image/png` kimi göndərilmiş HTML faylı `.html` uzantısı ilə saxlanılırdı (200), SVG də qəbul olunurdu (200). Uzantı müştərinin fayl adından, tip isə müştərinin bildirdiyi `mimetype`-dan götürülürdü. Nəticədə skriptli fayl `/uploads`-dan API origin-i altında açıla bilərdi.
- #7: səhv tip, 5MB-dan böyük fayl və səhv sahə adı global error handler-ə düşürdü və 500 "Something went wrong!" qaytarırdı.
- #1-dən qalan problem: adı `şəkil.jp g` olan fayl `.jp g` uzantısı ilə saxlanılırdı, sonra söz saxlananda Zod regex-i 400 qaytarırdı.

**Dəyişikliklər:**
- `backend/src/middleware/upload.ts` yenidən yazıldı:
  - `ALLOWED_IMAGE_TYPES`: yalnız `image/jpeg|png|webp|gif`. Uzantı bu xəritədən götürülür, `originalname`-dən yox. SVG bilərəkdən yoxdur.
  - Magic bytes yoxlaması (`hasImageSignature`): multer faylı yazdıqdan sonra ilk 12 bayt oxunur və bildirilən tiplə müqayisə olunur. Uyğun gəlmirsə fayl silinir, 400 qaytarılır və `logger.warn` yazılır.
  - Köhnə `upload` export-u yerinə `uploadImage` middleware-i gəldi:
    - multer xətaları burada status koduna çevrilir: `LIMIT_FILE_SIZE` → 413, digər `MulterError`-lar (məsələn, `Unexpected field`) → 400, `UnsupportedImageTypeError` → 400;
    - fayl göndərilməyibsə route-un öz 400 cavabı qalır.
- `backend/src/routes/dictionary.ts`: `upload.single('image')` → `uploadImage`.
- `frontend/src/components/WordDefinitionModal.tsx`:
  - `accept` yalnız 4 icazəli tipi göstərir;
  - seçim zamanı tip yoxlanılır;
  - yükləmə xətasında serverin mesajı (`ApiError.message`) göstərilir, əvvəl həmişə ümumi mətn çıxırdı.

**Yoxlama:** backend və frontend `tsc --noEmit` keçdi. API testi (7099 portunda, in-memory, `upload-test.sh`):

| Hal | Əvvəl | Sonra |
|---|---|---|
| Real PNG / JPEG | 200 | 200 (`.png` / `.jpg`) |
| Adı `şəkil.jp g` olan JPEG, sonra həmin `imageUrl` ilə söz saxlamaq | 200 `.jp g`, sonra **400** | 200 `.jpg`, sonra **201** |
| HTML, `image/png` kimi göstərilib | **200, `.html` saxlanıldı** | 400, fayl silindi, log yazıldı |
| JPEG məzmun, `image/png` kimi göstərilib | — | 400 |
| SVG | **200, `.svg` saxlanıldı** | 400 |
| `text/html` | 500 | 400 |
| 6MB JPEG | 500 | 413, diskdə yarımçıq fayl qalmadı |
| Səhv sahə adı | 500 | 400 |
| GIF / WebP | — | 200 |

Testlərin yaratdığı fayllar silindi, `backend/uploads/` ilkin vəziyyətindədir.

**Yoxlanılmayanlar:** frontend dəyişikliyi brauzerdə sınanmadı, yalnız type-check edildi. Köhnə, artıq yüklənmiş faylların məzmunu yoxlanılmadı. İkisi də (`.jpg`, `.png`) həqiqi şəkildir.

## 2026-10-02 — #24 (qismən): kök `README.md` yenidən yazıldı

- Köhnə README-də səhv məlumatlar var idi: backend portu 3001 yazılmışdı (əslində 7001), provider siyahısında Claude və Cohere var idi (əslində OpenAI/Grok/Gemini/DeepSeek/Mistral).
- Yeni README koddan yoxlanılaraq Azərbaycan dilində yazıldı. Bölmələr:
  - funksiyalar və provider/model cədvəli;
  - tələblər;
  - `.env` dəyişənləri;
  - `start.sh` və `npm run dev` ilə işə salma;
  - production build qeydləri: kökdəki `npm run build` yalnız frontend-i build edir, `NODE_ENV=production` lazımdır, backend frontend-i vermir;
  - API endpoint cədvəli və rate limitlər;
  - struktur və `docs/`-a keçidlər.
- Bilərəkdən yazılmayanlar: `customPrompt` (API-də var, amma UI-də göstərilmir).
- `CLAUDE.md`-dəki "README köhnədir" qeydi yeniləndi.
- #24-ün shuffle hissəsi hələ açıqdır.

## 2026-10-02 — `docs/` yaddaş strukturu yaradıldı

- `docs/README.md`, `docs/backlog.md`, `docs/changelog.md` və `docs/architecture/image-upload.md` yaradıldı.
- `CLAUDE.md`-yə `@docs/README.md` importu və iş qaydaları əlavə edildi. Bununla hər sessiya başlayanda yaddaş avtomatik yüklənir.

## 2026-10-02 — #1: Path traversal ilə fayl silmənin qarşısı alındı

**Problem:** `deleteLocalImage` yalnız `imageUrl.startsWith('/uploads/')` yoxlayırdı, yolu isə `path.join(__dirname, '../..', imageUrl)` ilə qururdu. `imageUrl: "/uploads/../../../../tmp/x"` ilə söz yaradıb silmək server prosesinin silə bildiyi istənilən faylı silirdi. `addWordSchema` `imageUrl`-ə istənilən sətri qəbul edirdi.

**Dəyişikliklər (iki müdafiə qatı):**
- `backend/src/services/dictionaryService.ts` → `deleteLocalImage`:
  - yol `path.resolve(uploadPath, imageUrl.slice('/uploads/'.length))` ilə hesablanır;
  - `path.dirname(imagePath) !== uploadPath` olarsa fayl silinmir və `logger.warn` yazılır;
  - bu qat bazada artıq qalmış köhnə, zərərli dəyərləri də zərərsiz edir.
- `backend/src/schemas/index.ts` → `addWordSchema.imageUrl`:
  - regex `^/uploads/\w[\w.-]*$` əlavə edildi;
  - əvvəl təklif olunan `[\w.-]+` regex-i `/uploads/..`-ni buraxırdı, ona görə fayl adı hərf və ya rəqəmlə başlamalıdır;
  - xarici `http(s)` URL-ləri artıq qəbul olunmur. Frontend onsuz da yalnız `/upload-image`-in qaytardığı yolu göndərir.
- `backend/src/middleware/upload.ts`: `uploadPath` export edildi. Multer və silmə funksiyası artıq eyni yoldan istifadə edir.

**Yoxlama:**
- `npm run type-check` keçdi.
- Düzəlişdən **əvvəl** zəiflik təkrarlandı: scratchpad-dəki test faylı silindi.
- Düzəlişdən **sonra**, servisi birbaşa çağıraraq (Zod-dan yan keçməklə): fayl qaldı, xəbərdarlıq log-a yazıldı.
- Normal şəkil (`backend/uploads/` içində) hələ də silinir.
- API testi (7099 portunda, Mongo olmadan):
  - `../`, `/uploads/..`, `/uploads/.hidden`, `/uploads/a/b.jpg` və `http://...` → 400;
  - `/uploads/1773770091190-854503861.jpg` → 201.

**Qalan məsələ:** uzantısında boşluq və ya qeyri-latın simvol olan fayl yüklənir, amma söz saxlananda 400 alınır. → #8 ilə həll olundu: uzantı artıq tipdən götürülür.

**Mühit:** backend-də `pino`, `pino-pretty`, `zod` və `express-rate-limit` quraşdırılmamışdı, backend işə düşmürdü. `cd backend && npm install` edildi, `package-lock.json` dəyişmədi.

## 2026-10-02 — `CLAUDE.md` yaradıldı və sistem analizi edildi

- Kök qovluqda `CLAUDE.md` yaradıldı: əmrlər, konfiqurasiya, arxitektura, konvensiyalar.
- Tam kod analizi aparıldı, 24 tapıntı [backlog.md](backlog.md)-yə yazıldı.

---

## Yoxlama üçün faydalı üsullar

- **Avtomatik testlər:** `cd backend && npm test`. Tək fayl: `npx vitest run tests/<fayl>.test.ts`. Ada görə filtr: `npx vitest run -t "pagination"`. Aşağıdakı əl üsulları yalnız avtomatik testlərin əhatə etmədiyi hallar üçündür.

- **Servisi route-suz test etmək:** scratchpad-də `.ts` skript yazıb backend-in tsconfig-i ilə işə salmaq:
  ```bash
  cd backend && MONGODB_URI= LOG_LEVEL=silent npx ts-node --transpile-only --project tsconfig.json <skript.ts>
  ```
  `--project` vacibdir: skript `backend/`-dən kənarda olanda ts-node səhv tsconfig götürür.
- **API-ni real bazaya toxunmadan test etmək:**
  ```bash
  cd backend && MONGODB_URI= PORT=7099 LOG_LEVEL=warn node -r ts-node/register/transpile-only src/server.ts &
  PID=$!   # ... testlər ...
  kill $PID
  ```
  - `MONGODB_URI=` (boş) verildikdə dotenv onu `.env`-dən üzərinə yazmır, server in-memory rejimdə işləyir.
  - Serveri `npx ts-node` ilə **işə salma**: `kill $!` yalnız `npx`-i dayandırır, node prosesi portda işləməyə davam edir.
  - `pkill -f "src/server.ts"` isə öz shell əmrinə də uyğun gəlir (exit 144).
  - Qalıq proses olarsa: `ss -ltnp | grep 7099` ilə PID-i tapıb onu dayandır.
- **Yükləmə testləri:** #8/#7 üçün istifadə olunan əl skripti (`upload-test.sh`, scratchpad-də idi) artıq lazım deyil. Bütün halları `tests/routes.dictionary.test.ts` avtomatik yoxlayır.
