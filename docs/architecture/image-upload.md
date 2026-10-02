# Şəkil yükləmə axını

Son yenilənmə: 2026-10-02 (#1-dən sonra).

Yükləmə iki ayrı sorğu ilə işləyir: əvvəl fayl serverə yüklənir, sonra onun yolu sözlə birlikdə saxlanır.

```
brauzer: fayl seç → blob önizləmə
   │ Save
   ├─► POST /api/dictionary/upload-image ──► multer → backend/uploads/<ad>.jpg
   │        ◄── { imageUrl: "/uploads/<ad>.jpg" }
   └─► POST /api/dictionary/words { ..., imageUrl } ──► Zod format yoxlaması → DB
göstərmə: <img src="http://localhost:7001/uploads/<ad>.jpg">  ◄── express.static
silmə:    DELETE /words/:id → DB-dən sil + deleteLocalImage (yalnız uploads içində)
```

## Addımlar

1. **Seçim** (`frontend/src/components/WordDefinitionModal.tsx`)
   - `accept="image/*"`.
   - Frontend 5MB limitini yoxlayır.
   - Önizləmə `URL.createObjectURL` ilə yaradılır, serverə hələ heç nə getmir.
   - ✕ düyməsi yalnız lokal state-i təmizləyir.
2. **Yükləmə** (`handleSubmit` → `dictionaryService.uploadImage`): `multipart/form-data`, sahənin adı `image`.
3. **Server** (`backend/src/middleware/upload.ts`, multer `diskStorage`):
   - qovluq: `uploadPath` (`backend/uploads`), yoxdursa yaradılır;
   - fayl adı: `<Date.now()>-<random 1e9><path.extname(originalname)>`;
   - `fileFilter`: `mimetype.startsWith('image/')`; limit 5MB;
   - route (`routes/dictionary.ts`) `{ imageUrl: "/uploads/<filename>" }` qaytarır.
4. **Saxlama** (`POST /words`): `addWordSchema.imageUrl` regex-i `^/uploads/\w[\w.-]*$`. Söz Mongo-ya, Mongo yoxdursa in-memory yaddaşa yazılır.
5. **Göstərmə**:
   - `resolveAssetUrl` nisbi yolun əvvəlinə `API_ORIGIN` əlavə edir;
   - faylı `server.ts`-dəki `express.static('uploads')` verir;
   - `helmet({ crossOriginResourcePolicy: false })` lazımdır, çünki frontend 5173, API isə 7001 portundadır.
6. **Silmə** (`dictionaryService.deleteLocalImage`): yol `uploadPath`-ə görə həll olunur. Nəticə birbaşa `uploadPath` içində deyilsə, fayl silinmir.

## Məlum zəif yerlər (backlog ID-ləri ilə)

- **#11 yetim fayllar:**
  - yükləmədən sonra söz saxlanmazsa (409), fayl diskdə qalır;
  - `updateWord` köhnə şəkli silmir;
  - in-memory rejimdə restart-dan sonra fayllar qalır.
- **#8:** `mimetype` müştəri tərəfindən bildirilir, uzantı orijinal fayl adından götürülür. html və svg faylları yüklənə bilər.
- **#7:** multer xətaları 400/413 əvəzinə 500 qaytarır.
- **#21:** `express.static('uploads')` cwd-yə görədir, multer isə `__dirname`-ə görə yazır.
- **#18:** autentifikasiya yoxdur. Ümumi limit 15 dəqiqədə 200 sorğudur, bu da 15 dəqiqədə ~1GB disk deməkdir.
- **#22:** `backend/uploads/` git-də saxlanır.
- Sözü redaktə etmək üçün frontend UI yoxdur. Backend-də `PUT /words/:id` var, amma frontend onu çağırmır.
