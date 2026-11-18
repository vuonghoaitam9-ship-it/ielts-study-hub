import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const VOL_ARCHIVE_ROOT = path.resolve('F:/IELTS/Vol');

const MIME_MAP: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function resolveExistingCaseOrUnicodePath(relPath: string): string | null {
  const cleaned = relPath.replace(/^\/+/, '').replace(/\//g, path.sep);
  const direct = path.resolve(VOL_ARCHIVE_ROOT, cleaned);
  if (!direct.startsWith(VOL_ARCHIVE_ROOT)) return null;
  if (fs.existsSync(direct)) return direct;

  // Handle macOS NFD vs Windows NFC Vietnamese filename normalization
  const nfc = path.resolve(VOL_ARCHIVE_ROOT, cleaned.normalize('NFC'));
  if (nfc.startsWith(VOL_ARCHIVE_ROOT) && fs.existsSync(nfc)) return nfc;

  const nfd = path.resolve(VOL_ARCHIVE_ROOT, cleaned.normalize('NFD'));
  if (nfd.startsWith(VOL_ARCHIVE_ROOT) && fs.existsSync(nfd)) return nfd;

  return null;
}

function createVolArchiveMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/vol-archive/')) {
      next();
      return;
    }

    const urlWithoutQuery = rawUrl.split('?')[0];
    let decodedRel = '';
    try {
      decodedRel = decodeURIComponent(
        urlWithoutQuery.slice('/vol-archive/'.length)
      );
    } catch {
      res.statusCode = 400;
      res.end('Bad URI encoding');
      return;
    }

    // Strict zero-excluded-skill enforcement
    if (/speaking/i.test(decodedRel)) {
      res.statusCode = 403;
      res.end('Forbidden resource');
      return;
    }

    const resolved = resolveExistingCaseOrUnicodePath(decodedRel);
    if (!resolved) {
      res.statusCode = 404;
      res.end('Original media file not found');
      return;
    }

    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      res.statusCode = 404;
      res.end('Not a file');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const fileSize = stat.size;
    const rangeHeader = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2]
          ? Math.min(fileSize - 1, parseInt(match[2], 10))
          : fileSize - 1;
        if (start > end || start >= fileSize) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(resolved, { start, end }).pipe(res);
        return;
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Length', String(fileSize));
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(resolved).pipe(res);
  };
}

function volOriginalMediaPlugin(): Plugin {
  return {
    name: 'vol-original-media-middleware',
    configureServer(server) {
      server.middlewares.use(createVolArchiveMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createVolArchiveMiddleware());
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), volOriginalMediaPlugin()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    target: 'es2022',
  },
});
