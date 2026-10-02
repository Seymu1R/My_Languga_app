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

## Hazırkı vəziyyət (2026-10-02)

- Backlog-da 28 tapıntı var. Bağlanıb:
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
  - **#4**: vaxtından əvvəl təkrar ("Review Again") öyrənmə cədvəlini dəyişmir.

  Qismən:
  - **#19**: backend testləri var, frontend testləri və lint yoxdur;
  - **#24**: kök README yenidən yazılıb, shuffle qalır.

  Qalanları açıqdır.
- **Testlər:** `cd backend && npm test` (Vitest, 348 test, ~2–3 san). Hər backend dəyişikliyindən sonra işə sal.
  - Yalnız #10 üçün `it.fails` testi qalıb.
- Kök `README.md` Azərbaycan dilindədir. Funksiya, env, port və ya endpoint dəyişəndə onu da yenilə.
- Təklif olunan növbəti iş: **#10** (`it.fails` testi hazırdır). Sonra **#3** (Mongo qoşulmasını gözləmək). Testlərlə tez bağlana bilənlər: **#4**, **#10**, **#26**, **#27**.
- **Git / GitHub** (remote: `origin` = https://github.com/Seymu1R/My_Languga_app):
  - Lokalda və GitHub-da yalnız **`main`** branch-ı var. İstifadəçinin istəyi ilə 2026-10-02-də bütün iş `main`-ə birləşdirildi, `main` push olundu, digər branch-lar (lokal 6, remote 1) silindi.
  - Bütün işlər `main`-dədir: #1, #2, #5, #6, #7, #8, #21, #25, #26, #27, #28, backend testləri və sənədlər. Hamısı fast-forward ilə birləşdirildi, merge commit-i yoxdur.
  - Növbəti iş üçün `main`-dən yeni branch açılır (bax: İş qaydaları, 7).
  - **Cari branch:** `fix/srs-early-review` (#4). Commit olunub: `6698e9b` (`fix:`, testlərlə birlikdə) və sənədlər (`docs:`). `main`-ə birləşdirilməyib, push olunmayıb.
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

Bu sənədlər istifadəçi ilə Azərbaycan dilində yazılır.
