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

- Backlog-da 27 tapıntı var. Bağlanıb:
  - **#1**: path traversal ilə fayl silmə;
  - **#2** + **#5**: frontend serverin xəta mesajlarını göstərir, xəta mətni tərcümə kimi saxlanmır;
  - **#7**: multer xətaları artıq 400/413 qaytarır;
  - **#8**: şəkil tipi və magic bytes yoxlanılır;
  - **#21**: `express.static(uploadPath)`;
  - **#25**: logger artıq `.env`-dən sonra yaradılır.

  Qismən:
  - **#19**: backend testləri var, frontend testləri və lint yoxdur;
  - **#24**: kök README yenidən yazılıb, shuffle qalır.

  Qalanları açıqdır.
- **Testlər:** `cd backend && npm test` (Vitest, 317 test, ~2–3 san). Hər backend dəyişikliyindən sonra işə sal.
  - #4, #10, #26 və #27 üçün `it.fails` testləri var.
- Kök `README.md` Azərbaycan dilindədir. Funksiya, env, port və ya endpoint dəyişəndə onu da yenilə.
- Təklif olunan növbəti iş: **#6** (`WordDefinitionModal` race condition). Testlərlə tez bağlana bilənlər: **#4**, **#10**, **#26**, **#27**.
- Git: `fix/upload-path-traversal` branch-ı 2026-10-02-də `main`-ə **fast-forward** ilə birləşdirildi (`main` = `27df908`), merge commit-i yaranmadı. Push olunmayıb.
  - Commit-lər (köhnədən yeniyə): #1 (`fix:`), sənədlər (`docs:`), #8 + #7 (`fix:`), refaktor (`refactor:`), testlər (`test:`), sənəd yeniləmələri (`docs:`).
  - `fix/upload-path-traversal` branch-ı hələ silinməyib.
  - Növbəti iş üçün `main`-dən yeni branch açılır.
- **Cari branch:** `fix/ai-error-messages` (#2 + #5). Commit olunub: `30c2add` (`fix:`) və sənədlər (`docs:`). `main`-ə birləşdirilməyib, push olunmayıb.
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
