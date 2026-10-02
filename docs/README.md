# Layihə yaddaşı (docs/)

Bu qovluq Claude Code-un layihə üzrə "yaddaşıdır". `CLAUDE.md` bu faylı import edir,
ona görə hər sessiyanın əvvəlində avtomatik oxunur. Ətraflı fayllar lazım olanda oxunur.

## Fayllar

| Fayl | Nə üçündür |
|---|---|
| [backlog.md](backlog.md) | Sistem analizinin bütün tapıntıları, ID və statusla. Növbəti iş buradan seçilir. |
| [changelog.md](changelog.md) | Edilən hər dəyişikliyin qeydi (ən yenisi yuxarıda): nə, niyə, necə yoxlanıldı. |
| [architecture/](architecture/) | Bir neçə faylı oxumadan başa düşülməyən axınların izahı. |
| [architecture/image-upload.md](architecture/image-upload.md) | Şəkil yükləmə axını: seçimdən silinməyə qədər. |

## Harada qaldıq (2026-10-02, sessiyanın sonu)

Yeni sessiya (və ya başqa kompüter) buradan başlayır.

- **Son bitən iş:** #22 (`.gitignore`, şəkillər git-dən çıxarıldı, `@types/mongoose`). `main` push olunub (`7e18620`-dən sonra yalnız bu sənəd), `main` = `origin/main`, başqa branch yoxdur.
- **Bağlanıb:** bütün kritik, yüksək və orta ciddilikli maddələr. Backend-də 483 test, heç bir `it.fails` yoxdur.
- **Qalan işlər** (hamısı aşağı ciddilik; istifadəçi 2026-10-02-də "aşağılar hələlik qalsın" dedi, sonra #22-ni seçdi). Növbəti maddəni istifadəçi seçir:

  | ID | Nədir | Həcm |
  |---|---|---|
  | #23 | `start.sh`: 20-ci sətirdə artıq `MONGODB_URI` sözü ("command not found" çap edir), `mongod` başlamasa da skript davam edir | kiçik, skript |
  | #29 | `PUT /words/:id` buraxılan sahələri in-memory-də silir, MongoDB-də saxlayır | kiçik, backend + testlər |
  | #24 (qismən) | `LearningsPage` qarışdırması `sort(() => Math.random() - 0.5)` → Fisher–Yates | kiçik, frontend |
  | #20 | `aiService.ts` təkrarları, provider siyahısı 5 yerdə | orta, refaktor (testlər var) |
  | #19 (qismən) | frontend testləri (istifadəçi sonraya saxlayıb) və sınıq lint (Biome 1.x config + Biome 2.4; ESLint config yoxdur) | orta |
  | #11 (qismən) | restart və "yüklənib, saxlanmayıb" yetim şəkilləri; avtomatik təmizləmə qəsdən edilmədi | qərar tələb edir |
  | #18 | autentifikasiya yoxdur; lokal istifadə üçün qəbul edilir | böyük |
  | #30 | yeni funksiya: Ollama provider (lokal/öz serverdə model, açarsız, ünvan env-dən) | orta |
  | #31 | prod üçün: lüğət hamı üçün ortaqdır, `userId` yoxdur (#18-dən sonra) | böyük |

  Prod-a (çox istifadəçiyə) çıxış ardıcıllığı: #18 → #31 → istəyə görə #30.

- **Brauzerdə yoxlanılmayıb** (frontend testləri yoxdur, yalnız type-check + build): #2, #5, #6, #9 (açar modalı), #14, #15, #16. Qısa əl yoxlaması faydalı olar. #9 real provider açarı ilə də yoxlanılmayıb (xüsusilə Gemini/Grok-un 1 tokenlik limitə cavabı).
- **İstifadəçinin iş axını** (hər maddə üçün təkrarlanır):
  1. "#N-dən başla" → `main`-dən branch, əvvəlcə bug-ı göstərən test, sonra düzəliş, sənədlər. Hesabat Azərbaycan dilində.
  2. "bəli, ayrı-ayrı commit et" → kod (`fix:`/`perf:`/`chore:`, testləri ilə) və `docs:` ayrı commit-lər.
  3. "main-ə merge et" → `--ff-only`, `main`-də testlər, merge qeydi sənədlərə (hələ commit-siz).
  4. "bəli, commit et, push et, yalnız main qalsın" → sənəd commit-i, məxfi fayl/açar yoxlaması, push, branch `-d` ilə silinir.

## Başqa kompüterdə davam etmək

Kod və sənədlər GitHub-dadır, amma bəzi şeylər **git-də deyil** və əl ilə köçürülməlidir.

1. **Kod:**
   ```bash
   git clone https://github.com/Seymu1R/My_Languga_app.git
   cd My_Languga_app
   git config user.name "Seymu1R"          # repo səviyyəsində, əvvəlki kimi
   git config user.email "<əvvəlki email>"
   npm run install:all
   ```
   Node **20.19+** lazımdır (backend testləri mongodb-memory-server işlədir; sistemdə `mongod` yoxdursa, ilk dəfə binary yüklənir, internet lazımdır).
2. **Yoxlama:** `cd backend && npm test && npm run type-check` (483 test), `cd frontend && npx tsc --noEmit && npm run build`.
3. **`backend/.env`** git-də deyil. Kök `README.md`-dəki nümunə ilə yenidən yarat. `start.sh` işlədilirsə `MONGODB_URI=mongodb://localhost:27018/language_learning`. AI açarı `.env`-ə yazılmır.
4. **Lüğət datası** bu kompüterin MongoDB-sindədir (`~/mongodb_data`, port 27018, baza `language_learning`). Köçürmək üçün:
   ```bash
   # köhnə kompüterdə (mongod işləyərkən)
   mongodump --port 27018 --db language_learning --out ./mongo-dump
   # yeni kompüterdə (./start.sh ilə mongod qalxandan sonra)
   mongorestore --port 27018 ./mongo-dump
   ```
   Yeni bazada köhnə case-only dublikatlar varsa, `english_unique_ci` index-i qurulmur və server bunu loglayır (bax: #10).
5. **Şəkillər:** `backend/uploads/` artıq git-də deyil (#22). Sözlər onlara `/uploads/<fayl>` yolu ilə istinad edir, ona görə qovluğu əl ilə köçür. Qeyd: köhnə nüsxədə `git pull` bu qovluqdakı əvvəllər izlənən 2 şəkli silər; bərpa əmri changelog-un #22 qeydindədir.
6. **Brauzer ayarları** (provider, model, dil, səviyyə `localStorage`-da, açar `sessionStorage`-da) köçmür: tətbiqdə yenidən "Add AI Token".
7. **`start.sh`** #23 səbəbindən "MONGODB_URI: command not found" çap edir, amma işləyir. `mongod` və `mongosh` quraşdırılmalıdır.
8. **Claude Code:** yeni sessiyada `CLAUDE.md` bu faylı avtomatik oxuyur. Claude-un lokal yaddaşı (`~/.claude/projects/...`) köçmür. Vacib dərslər buradadır (İş qaydaları, 7).

## Hazırkı vəziyyət (2026-10-02)

- Backlog-da 31 maddə var. Bağlanıb:
  - **#1**: path traversal ilə fayl silmə;
  - **#2** + **#5**: frontend serverin xəta mesajlarını göstərir, xəta mətni tərcümə kimi saxlanmır;
  - **#6**: söz modalında köhnəlmiş AI cavabları yeni sözə yazılmır. Testsizdir, frontend testləri yoxdur;
  - **#7**: multer xətaları artıq 400/413 qaytarır;
  - **#8**: şəkil tipi və magic bytes yoxlanılır;
  - **#21**: `express.static(uploadPath)`;
  - **#25**: logger artıq `.env`-dən sonra yaradılır;
  - **#27**: yalnız boşluqdan ibarət söz və tərcümə rədd edilir;
  - **#28**: AI endpoint-ləri də yalnız boşluqdan ibarət sözü rədd edir;
  - **#26**: səhv JSON → 400, >10kb body → 413, digər klient xətaları öz statusu ilə;
  - **#4**: vaxtından əvvəl təkrar ("Review Again") öyrənmə cədvəlini dəyişmir;
  - **#10**: söz adları redaktədə və eyni anda gələn sorğularda da unikaldır (MongoDB-də `english_unique_ci` index-i);
  - **#3**: saxlama rejimi açılışda seçilir, server MongoDB-ni gözləyir, qopmada 503 (data səssizcə itmir).
  - **#9**: açar `/api/ai/validate-key` ilə 1 tokenlik sorğu ilə yoxlanılır, tam mətn generasiya olunmur;
  - **#12**: dictionaryapi.dev 3 saniyəyə cavab verməsə, tərcümə təriflərsiz davam edir;
  - **#13**: tərcümədə saxlanmış sözün axtarışı və dublikat yoxlaması regex əvəzinə collation ilə `english_unique_ci` index-indən keçir;
  - **#14**: kliklənən söz düzgün təmizlənir (`don't`, `well-known`, `“Hello,”` → `hello`). Testsizdir, frontend testləri yoxdur;
  - **#15**: flashcard cavabı saxlanmasa xəta göstərilir və kart yerində qalır; "Review Again" sözləri təkrarsız göstərir. Testsizdir;
  - **#16**: söz saxlanarkən "Generate Text" düyməsi artıq bloklanmır (qlobal `isGeneratingText` yalnız generasiya üçündür). Testsizdir;
  - **#17**: AI sxemləri route-larla uyğundur: `aiToken`/`provider` məcburidir, `languageCode` yoxdur, `level` yalnız 5 səviyyədən biridir;
  - **#22**: `.idea/` və `backend/uploads/` `.gitignore`-dadır, şəkillər git-dən çıxarıldı (diskdə qalır), `@types/mongoose` silindi.

  Qismən:
  - **#11**: uğursuz saxlama/redaktədə və şəkil dəyişəndə köhnə fayl silinir, başqa sözün şəkli toxunulmaz qalır; restart və "yüklənib, saxlanmayıb" halları qalır;
  - **#19**: backend testləri var, frontend testləri və lint yoxdur;
  - **#24**: kök README yenidən yazılıb, shuffle qalır.

  Qalanları açıqdır.
- **Testlər:** `cd backend && npm test` (Vitest, 483 test, ~8 san; ən yavaşı `server.test.ts`). Hər backend dəyişikliyindən sonra işə sal.
  - Hazırda heç bir `it.fails` testi yoxdur.
- Kök `README.md` Azərbaycan dilindədir. Funksiya, env, port və ya endpoint dəyişəndə onu da yenilə.
- Kritik maddə qalmayıb. Orta ciddilikli maddələr (#15, #16, #17) bağlandı; istifadəçi aşağı ciddilikliləri 2026-10-02-də hələlik saxladı. Qalanlar: #11 və #19, #24 (qismən), #18, #20, #23, #29.
- **Git / GitHub** (remote: `origin` = https://github.com/Seymu1R/My_Languga_app):
  - Lokalda və GitHub-da yalnız **`main`** branch-ı var. İstifadəçinin istəyi ilə 2026-10-02-də bütün iş `main`-ə birləşdirildi, `main` push olundu, digər branch-lar (lokal 6, remote 1) silindi.
  - Bütün işlər `main`-dədir və push olunub: #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11 (qismən), #12, #13, #14, #15, #16, #17, #21, #22, #25, #26, #27, #28, backend testləri və sənədlər. Hamısı fast-forward ilə birləşdirildi, merge commit-i yoxdur.
  - Növbəti iş üçün `main`-dən yeni branch açılır (bax: İş qaydaları, 7).
- Frontend testləri: istifadəçi 2026-10-02-də sonraya saxladı. Frontend dəyişiklikləri hələlik type-check və build ilə yoxlanılır, bu da changelog-da açıq yazılır.

## İş qaydaları

Hər dəyişiklikdən sonra:
1. `changelog.md`-nin yuxarısına qeyd əlavə et: tarix, backlog ID-si, dəyişən fayllar, səbəb, necə yoxlanıldı.
2. `backlog.md`-də maddənin statusunu yenilə (`açıq` → `bağlanıb` və ya `qismən`), changelog qeydinə istinad et.
3. Yeni problem tapılsa, backlog-a növbəti ID ilə əlavə et. Mövcud ID-ləri dəyişmə, istifadəçi onlara nömrə ilə istinad edir.
4. Bu fayldakı "Hazırkı vəziyyət" bölməsini yenilə.
5. Axın dəyişibsə (məsələn, şəkil yükləmə), `architecture/` altındakı uyğun faylı yenilə.
6. **Hər backend funksiyası üçün test məcburidir** (istifadəçinin tələbi). Yeni və ya dəyişən hər funksiya, route və middleware üçün `backend/tests/`-də test eyni dəyişiklikdə yazılır:
   - uğurlu yol, xəta yolları və kənar hallar yoxlanılır;
   - `dictionaryService` dəyişiklikləri hər iki saxlama rejimində yoxlanılır;
   - route-lar supertest ilə yoxlanılır: 2xx, 400, 404/409, 500;
   - bug fix: əvvəlcə bug-ı göstərən test yazılır. `it.fails` testi varsa, `.fails` silinir;
   - "hazırdır" deməzdən əvvəl `npm test` və `npm run type-check` keçməlidir. Changelog-da hansı testlərin əlavə olunduğu yazılır.
7. **Git:** commit, merge və push yalnız istifadəçi istəyəndə edilir.
   - Hər iş `main`-dən ayrıca branch-da aparılır; `main`-ə `--ff-only` ilə birləşdirilir.
   - Commit-lər ayrı-ayrıdır: kod `fix:`/`feat:` (bug fix öz testləri ilə birlikdə), `refactor:`, `test:`, `docs:`.
   - Push-dan əvvəl göndəriləcək diff məxfi fayl və açarlara görə yoxlanılır.
   - Hər commit-dən sonra tərkibi `git show --stat` ilə yoxlanılır. Ignore olunan yolu `git add`-ə vermə: xəta `&&` zəncirini dayandırır və növbəti commit səhv faylları götürür (#22-də baş verdi).
   - Faylı izləmədən çıxaran (`git rm --cached`) commit-i birləşdirməzdən əvvəl həmin faylların ehtiyat nüsxəsini götür: o faylları hələ izləyən branch-a keçib fast-forward etmək onları diskdən silir (#22-də istifadəçinin 2 şəkli silindi və tarixçədən bərpa olundu).

Bu sənədlər istifadəçi ilə Azərbaycan dilində yazılır.
