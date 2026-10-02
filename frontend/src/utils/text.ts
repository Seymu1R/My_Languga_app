// Söz kənarındakı hər şey (hərf və rəqəm olmayan): durğu işarələri, düz və əyri dırnaqlar, mötərizələr
const EDGE_NON_WORD = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
// Əyri apostroflar (’ ‘ ʼ) — AI mətnlərində "it’s" kimi gəlir
const CURLY_APOSTROPHES = /[‘’ʼ]/g;

// Kliklənən mətn parçasından lüğət üçün sözü çıxarır (#14): yalnız kənarlardakı işarələr
// silinir, sözün içindəki apostrof və tire qalır — "don't", "well-known"
export const cleanWord = (word: string): string =>
  word.replace(CURLY_APOSTROPHES, "'").replace(EDGE_NON_WORD, '').toLowerCase();
