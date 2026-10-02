// Magic bytes yoxlamasından keçən minimal şəkil buferləri
export const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
export const GIF = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(32)]);
export const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(32),
]);
export const HTML = Buffer.from('<html><script>alert(document.domain)</script></html>');
export const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
