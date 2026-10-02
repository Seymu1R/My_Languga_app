# Şəkil yükləmə axını

Son yenilənmə: 2026-10-02 (#1, #7, #8, #21, #11-dən sonra).

Yükləmə iki ayrı sorğu ilə işləyir: əvvəl fayl serverə yüklənir, sonra onun yolu sözlə birlikdə saxlanır.

```
brauzer: fayl seç → blob önizləmə
   │ Save
   ├─► POST /api/dictionary/upload-image ──► uploadImage: tip → ölçü → magic bytes → backend/uploads/<ad>.jpg
   │        ◄── { imageUrl: "/uploads/<ad>.jpg" }
   └─► POST /api/dictionary/words { ..., imageUrl } ──► Zod format yoxlaması → DB
göstərmə: <img src="http://localhost:7001/uploads/<ad>.jpg">  ◄── express.static(uploadPath)
silmə:    DELETE /words/:id → DB-dən sil + deleteImageIfUnused (heç bir söz istinad etmirsə, yalnız uploads içində)
uğursuz:  POST/PUT /words 409/404 → sorğu ilə gələn şəkil deleteImageIfUnused (#11)
əvəz:     PUT /words/:id yeni imageUrl ilə → köhnə şəkil deleteImageIfUnused (#11)
```

## Addımlar

1. **Seçim** (`frontend/src/components/WordDefinitionModal.tsx`)
   - `accept` yalnız `image/jpeg,image/png,image/webp,image/gif`-dir.
   - Frontend tipi və 5MB limitini yoxlayır. Bu yalnız UX üçündür, əsas yoxlama backend-dədir.
   - Önizləmə `URL.createObjectURL` ilə yaradılır, serverə hələ heç nə getmir.
   - ✕ düyməsi yalnız lokal state-i təmizləyir.
2. **Yükləmə** (`handleSubmit` → `dictionaryService.uploadImage`): `multipart/form-data`, sahənin adı `image`.
3. **Server** (`backend/src/middleware/upload.ts` → `uploadImage` middleware-i, multer `diskStorage` əsasında):
   - `fileFilter`: `mimetype` `ALLOWED_IMAGE_TYPES`-da olmalıdır (jpeg/png/webp/gif, SVG yoxdur). Əks halda **400**.
   - limit 5MB, keçərsə **413**. Multer yarımçıq faylı özü silir.
   - qovluq: `uploadPath`. Default `backend/uploads`-dır, `UPLOAD_DIR` env ilə dəyişdirilə bilir (testlər müvəqqəti qovluq verir). Qovluq yoxdursa yaradılır.
   - fayl adı: `<Date.now()>-<random 1e9><uzantı>`. Uzantı tipdən götürülür (`.jpg/.png/.webp/.gif`), `originalname`-dən **yox**.
   - yazıldıqdan sonra ilk 12 bayt (magic bytes) bildirilən tiplə müqayisə olunur. Uyğun deyilsə fayl silinir, **400** qaytarılır, `logger.warn` yazılır.
   - digər multer xətaları (məsələn, səhv sahə adı) → **400**. Fayl göndərilməyibsə route **400** qaytarır.
   - route (`routes/dictionary.ts`) `{ imageUrl: "/uploads/<filename>" }` qaytarır.
   - frontend xəta mesajını (`ApiError.message`) şəkil sahəsinin altında göstərir.
4. **Saxlama** (`POST /words`): `addWordSchema.imageUrl` regex-i `^/uploads/\w[\w.-]*$`. Söz Mongo-ya, Mongo yoxdursa in-memory yaddaşa yazılır.
5. **Göstərmə**:
   - `resolveAssetUrl` nisbi yolun əvvəlinə `API_ORIGIN` əlavə edir;
   - faylı `app.ts`-dəki `express.static(uploadPath)` verir. Bu, multer-in yazdığı qovluqla eynidir;
   - `helmet({ crossOriginResourcePolicy: false })` lazımdır, çünki frontend 5173, API isə 7001 portundadır.
6. **Silmə** (`dictionaryService`):
   - `deleteImageIfUnused(imageUrl)` əvvəlcə yoxlayır ki, heç bir söz bu `imageUrl`-ə istinad etmir (MongoDB-də `Word.exists`, in-memory-də massiv). Eyni şəkil API ilə bir neçə sözə verilə bilər. İstinad varsa fayl qalır.
   - Bazanı yoxlamaq mümkün deyilsə (MongoDB qopub, #3), fayl saxlanılır və `warn` loglanır: yetim fayl silinmiş şəkildən yaxşıdır.
   - Sonra `deleteLocalImage`: yol `uploadPath`-ə görə həll olunur. Nəticə birbaşa `uploadPath` içində deyilsə, fayl silinmir (#1).
   - Harada çağırılır (#11):
     - `deleteWord`: silinən sözün şəkli;
     - `updateWord` uğurlu: şəkil dəyişibsə (və ya sözdən çıxıbsa), köhnə şəkil;
     - `addWord`/`updateWord` uğursuz (409, 404, digər xəta): sorğu ilə gələn şəkil (`discardImageOnFailure`). Frontend faylı saxlamadan **əvvəl** yüklədiyi üçün bu fayl adətən heç yerdə işlənmir. Frontend təkrar cəhddə faylı yenidən yükləyir, ona görə silinməsi təhlükəsizdir.

## Məlum zəif yerlər (backlog ID-ləri ilə)

- **#11 yetim fayllar (qismən):** uğursuz saxlama/redaktə və əvəz olunan şəkil artıq təmizlənir. Qalır:
  - in-memory rejimdə restart-dan sonra fayllar qalır;
  - şəkil yüklənib, söz heç saxlanmayıbsa (brauzer bağlanıb), fayl qalır.
  Açılışda avtomatik təmizləmə qəsdən yoxdur: qovluq iki rejim üçün ortaqdır və git-dədir (#22).
- **#29:** `PUT` imageUrl-siz gələndə in-memory şəkli sözdən çıxarır, MongoDB saxlayır. Fayl hər iki halda sözün həqiqi vəziyyətinə görə silinir və ya qalır.
- **#18:** autentifikasiya yoxdur. Ümumi limit 15 dəqiqədə 200 sorğudur, bu da 15 dəqiqədə ~1GB disk deməkdir.
- **#22:** `backend/uploads/` git-də saxlanır.
- Sözü redaktə etmək üçün frontend UI yoxdur. Backend-də `PUT /words/:id` var, amma frontend onu çağırmır.

## Testlər

`backend/tests/routes.dictionary.test.ts` → `POST /api/dictionary/upload-image`: bütün tiplər, saxta HTML/SVG, 413, səhv sahə adı, statik verilmə, yüklə → saxla → sil axını. `dictionaryService.test.ts` silmə, #1 regressiyası və #11 təmizləməsini (uğursuz əlavə/redaktə, əvəz, ortaq şəkil, baza əlçatmaz) hər iki saxlama rejimində yoxlayır. Route testləri: yüklə → dublikat (409) → fayl silinir; `PUT` ilə şəkli əvəz et → köhnə fayl silinir.
