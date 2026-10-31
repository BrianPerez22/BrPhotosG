import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import sharp from 'sharp';
import exifReader from 'exif-reader';

/**
 * Normaliza un valor de fecha obtenido de EXIF/XMP (Date, string, timestamp) a milisegundos.
 */
function toTimestamp(val: unknown): number | null {
  if (!val) return null;
  if (val instanceof Date) {
    const t = val.getTime();
    return isNaN(t) ? null : t;
  }
  if (typeof val === 'number') {
    return isNaN(val) || val <= 0 ? null : val;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;

    // Formato EXIF clásico: "YYYY:MM:DD HH:MM:SS" (con o sin subsegundos o timezone)
    const exifMatch = s.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?/);
    if (exifMatch) {
      const iso = `${exifMatch[1]}-${exifMatch[2]}-${exifMatch[3]}T${exifMatch[4]}:${exifMatch[5]}:${exifMatch[6]}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

/**
 * Busca etiquetas de fecha dentro del XML de XMP.
 */
function extractXmpDate(buf: Buffer): number | null {
  try {
    const str = buf.toString('utf8');
    const tags = [
      /<(?:xmp:)?CreateDate>([^<]+)<\/(?:xmp:)?CreateDate>/i,
      /<(?:photoshop:)?DateCreated>([^<]+)<\/(?:photoshop:)?DateCreated>/i,
      /<(?:exif:)?DateTimeOriginal>([^<]+)<\/(?:exif:)?DateTimeOriginal>/i,
      /<(?:exif:)?DateTimeDigitized>([^<]+)<\/(?:exif:)?DateTimeDigitized>/i,
      /<(?:xmp:)?ModifyDate>([^<]+)<\/(?:xmp:)?ModifyDate>/i,
      /xmp:CreateDate="([^"]+)"/i,
      /photoshop:DateCreated="([^"]+)"/i,
      /exif:DateTimeOriginal="([^"]+)"/i,
    ];

    for (const re of tags) {
      const match = str.match(re);
      if (match && match[1]) {
        const ts = toTimestamp(match[1]);
        if (ts) return ts;
      }
    }
  } catch {
    // ignorar error de parseo xmp
  }
  return null;
}

/**
 * Fallback por búsqueda regex de patrón fecha dentro de buffers EXIF brutos.
 */
function extractBufferDateFallback(buf: Buffer): number | null {
  try {
    const str = buf.toString('binary');
    const match = str.match(/\b(19[7-9]\d|20[0-4]\d)[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  } catch {
    // ignorar
  }
  return null;
}

/**
 * Extrae la fecha de creación de vídeos MP4 / QuickTime / MOV leyendo el átomo 'mvhd'.
 */
export async function extractVideoDate(abs: string): Promise<number | null> {
  let fd: fsSync.promises.FileHandle | null = null;
  try {
    fd = await fs.open(abs, 'r');
    // Leemos los primeros 256 KB donde suele ubicarse el encabezado 'moov' y 'mvhd'
    const buf = Buffer.alloc(262144);
    const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
    if (bytesRead < 32) return null;

    const slice = buf.subarray(0, bytesRead);
    const mvhdIndex = slice.indexOf(Buffer.from('mvhd'));
    if (mvhdIndex >= 0 && mvhdIndex + 16 <= bytesRead) {
      const version = slice[mvhdIndex + 4];
      let creationSeconds: number;
      if (version === 1) {
        // 64-bit int
        const high = slice.readUInt32BE(mvhdIndex + 8);
        const low = slice.readUInt32BE(mvhdIndex + 12);
        creationSeconds = high * 4294967296 + low;
      } else {
        // 32-bit int
        creationSeconds = slice.readUInt32BE(mvhdIndex + 8);
      }

      // QuickTime/MP4 usa epoch de Macintosh: segundos desde 1904-01-01 00:00:00 UTC
      // Diferencia con Unix epoch (1970-01-01): 2082844800 segundos
      const macEpochDiff = 2082844800;
      const unixSeconds = creationSeconds - macEpochDiff;

      // Validar rango razonable (entre 1990 y 2040)
      if (unixSeconds > 631152000 && unixSeconds < 2208988800) {
        return unixSeconds * 1000;
      }
    }
  } catch {
    // Fallback si no es MP4 o no tiene mvhd legible
  } finally {
    if (fd) await fd.close().catch(() => {});
  }
  return null;
}

/**
 * Obtiene la fecha real de captura a partir de metadatos EXIF / XMP o video headers.
 * Si no encuentra metadatos válidos, devuelve el fallbackMtime.
 */
export async function getCaptureDate(abs: string, fallbackMtime: number, isImage = true): Promise<number> {
  if (isImage) {
    try {
      const meta = await sharp(abs, { failOn: 'none' }).metadata();

      // 1. Probar exif-reader con el buffer de EXIF
      if (meta.exif) {
        try {
          const parsed = exifReader(meta.exif);
          const photo = parsed?.Photo;
          const image = parsed?.Image;

          const candidates = [
            photo?.DateTimeOriginal,
            photo?.DateTimeDigitized,
            image?.DateTime,
            image?.ModifyDate,
          ];

          for (const c of candidates) {
            const ts = toTimestamp(c);
            if (ts) return ts;
          }
        } catch {
          // fallo al parsear con exif-reader, probar regex fallback
          const rawTs = extractBufferDateFallback(meta.exif);
          if (rawTs) return rawTs;
        }
      }

      // 2. Probar metadatos XMP
      if (meta.xmp) {
        const xmpTs = extractXmpDate(meta.xmp);
        if (xmpTs) return xmpTs;
      }
    } catch {
      // sharp falló, continuar a fallback
    }
  } else {
    // Video
    const videoTs = await extractVideoDate(abs);
    if (videoTs) return videoTs;
  }

  return fallbackMtime;
}

/**
 * Actualiza el atime y mtime de un archivo en disco para reflejar la fecha de captura real.
 */
export async function syncFileMtime(abs: string, timeMs: number): Promise<void> {
  try {
    const sec = timeMs / 1000;
    await fs.utimes(abs, sec, sec);
  } catch {
    // ignorar error si el sistema de archivos es de solo lectura o falla utimes
  }
}
