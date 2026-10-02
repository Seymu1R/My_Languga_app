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

- Backlog-da 24 tapıntı var. Bağlanıb: **#1** (path traversal ilə fayl silmə). Qismən: **#24** (kök README yenidən yazılıb, shuffle qalır). Qalanları açıqdır.
- Kök `README.md` Azərbaycan dilindədir. Funksiya, env, port və ya endpoint dəyişəndə onu da yenilə.
- Təklif olunan növbəti iş: **#8 + #7** (yükləmədə fayl tipi, multer xətaları), sonra **#2** (AI xəta mesajları).
- 2026-10-02 dəyişiklikləri `fix/upload-path-traversal` branch-ında commit olunub (`fix:` + `docs:`), hələ `main`-ə birləşdirilməyib və push olunmayıb. Commit yalnız istifadəçi istəyəndə edilir. İstifadəçi ayrı-ayrı commit-lərə üstünlük verir: kod `fix:`/`feat:`, sənədlər `docs:`.

## İş qaydaları

Hər dəyişiklikdən sonra:
1. `changelog.md`-nin yuxarısına qeyd əlavə et: tarix, backlog ID-si, dəyişən fayllar, səbəb, necə yoxlanıldı.
2. `backlog.md`-də maddənin statusunu yenilə (`açıq` → `bağlanıb` və ya `qismən`), changelog qeydinə istinad et.
3. Yeni problem tapılsa, backlog-a növbəti ID ilə əlavə et. Mövcud ID-ləri dəyişmə, istifadəçi onlara nömrə ilə istinad edir.
4. Bu fayldakı "Hazırkı vəziyyət" bölməsini yenilə.
5. Axın dəyişibsə (məsələn, şəkil yükləmə), `architecture/` altındakı uyğun faylı yenilə.

Bu sənədlər istifadəçi ilə Azərbaycan dilində yazılır.
