# Changelog

Ən yeni qeyd yuxarıdadır. Hər qeyd: backlog ID-si, dəyişən fayllar, səbəb, necə yoxlanıldı, qalan məsələlər.

---

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

**Qalan məsələ:** uzantısında boşluq və ya qeyri-latın simvol olan fayl yüklənir, amma söz saxlananda 400 alınır. Bu, #8 ilə birlikdə həll olunacaq.

**Mühit:** backend-də `pino`, `pino-pretty`, `zod` və `express-rate-limit` quraşdırılmamışdı, backend işə düşmürdü. `cd backend && npm install` edildi, `package-lock.json` dəyişmədi.

## 2026-10-02 — `CLAUDE.md` yaradıldı və sistem analizi edildi

- Kök qovluqda `CLAUDE.md` yaradıldı: əmrlər, konfiqurasiya, arxitektura, konvensiyalar.
- Tam kod analizi aparıldı, 24 tapıntı [backlog.md](backlog.md)-yə yazıldı.

---

## Yoxlama üçün faydalı üsullar

- **Servisi route-suz test etmək:** scratchpad-də `.ts` skript yazıb backend-in tsconfig-i ilə işə salmaq:
  ```bash
  cd backend && MONGODB_URI= LOG_LEVEL=silent npx ts-node --transpile-only --project tsconfig.json <skript.ts>
  ```
  `--project` vacibdir: skript `backend/`-dən kənarda olanda ts-node səhv tsconfig götürür.
- **API-ni real bazaya toxunmadan test etmək:**
  ```bash
  MONGODB_URI= PORT=7099 npx ts-node --transpile-only src/server.ts
  ```
  `MONGODB_URI=` (boş) verildikdə dotenv onu `.env`-dən üzərinə yazmır, server in-memory rejimdə işləyir.
- **Test serverini dayandırmaq:** `pkill -f "src/server.ts"` öz shell əmrinə də uyğun gələ bilər (exit 144). PID ilə dayandırmaq daha etibarlıdır.
