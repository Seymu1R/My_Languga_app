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
  - **#27**: yalnız boşluqdan ibarət söz və tərcümə rədd edilir.

  Qismən:
  - **#19**: backend testləri var, frontend testləri və lint yoxdur;
  - **#24**: kök README yenidən yazılıb, shuffle qalır.

  Qalanları açıqdır.
- **Testlər:** `cd backend && npm test` (Vitest, 322 test, ~2–3 san). Hər backend dəyişikliyindən sonra işə sal.
  - #4, #10 və #26 üçün `it.fails` testləri var.
- Kök `README.md` Azərbaycan dilindədir. Funksiya, env, port və ya endpoint dəyişəndə onu da yenilə.
- Təklif olunan növbəti iş: `it.fails` testi hazır olan backend bug-ları: **#26**, **#4**, **#10**. Sonra **#3** (Mongo qoşulmasını gözləmək). **#28** kiçikdir, #27-nin davamıdır. Testlərlə tez bağlana bilənlər: **#4**, **#10**, **#26**, **#27**.
- Git: `fix/upload-path-traversal` branch-ı 2026-10-02-də `main`-ə **fast-forward** ilə birləşdirildi (`main` = `27df908`), merge commit-i yaranmadı. Push olunmayıb.
  - Commit-lər (köhnədən yeniyə): #1 (`fix:`), sənədlər (`docs:`), #8 + #7 (`fix:`), refaktor (`refactor:`), testlər (`test:`), sənəd yeniləmələri (`docs:`).
  - `fix/upload-path-traversal` branch-ı hələ silinməyib.
  - Növbəti iş üçün `main`-dən yeni branch açılır.
- `fix/ai-error-messages` (#2 + #5) 2026-10-02-də `main`-ə fast-forward ilə birləşdirildi (`30c2add` `fix:`, `abcfeb6` `docs:`). Push olunmayıb. Branch silinməyib.
- `fix/word-modal-stale-responses` (#6) 2026-10-02-də `main`-ə fast-forward ilə birləşdirildi (`d1a5c42` `fix:`, `b17dab9` `docs:`). Push olunmayıb. Branch silinməyib.
- `fix/whitespace-only-words` (#27) 2026-10-02-də `main`-ə fast-forward ilə birləşdirildi (`fcfdaf7` `fix:` + testlər, `7381174` `docs:`). Push olunmayıb. Branch silinməyib.
- Frontend testləri: istifadəçi 2026-10-02-də sonraya saxladı. Frontend dəyişiklikləri hələlik type-check və build ilə yoxlanılır, bu da changelog-da açıq yazılır.
  - Commit yalnız istifadəçi istəyəndə edilir. İstifadəçi ayrı-ayrı commit-lərə üstünlük verir: kod `fix:`/`feat:`, testlər `test:`, sənədlər `docs:`.

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

Bu sənədlər istifadəçi ilə Azərbaycan dilində yazılır.
