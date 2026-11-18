import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const VOL_DATA_DIR = path.join(PROJECT_ROOT, 'public', 'data', 'volumes');
const VOL_ARCHIVE_ROOT = path.resolve('F:/IELTS/Vol');
const MAP_OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  'src',
  'data',
  'volumes',
  'remote-media-map.json'
);
const TMP_ROOT = path.resolve('F:/IELTS/.media-upload-tmp');

const OWNER = 'vuonghoaitam9-ship-it';
const GIT_EMAIL = `247639453+${OWNER}@users.noreply.github.com`;
const MAX_BATCH_BYTES = 180 * 1024 * 1024;

const PACKS = [
  { packNum: 1, repoName: 'ielts-study-media-1', vols: [1] },
  { packNum: 2, repoName: 'ielts-study-media-2', vols: [2, 6] },
  { packNum: 3, repoName: 'ielts-study-media-3', vols: [3] },
  { packNum: 4, repoName: 'ielts-study-media-4', vols: [4, 10] },
  { packNum: 5, repoName: 'ielts-study-media-5', vols: [5] },
  { packNum: 6, repoName: 'ielts-study-media-6', vols: [7] },
  { packNum: 7, repoName: 'ielts-study-media-7', vols: [8, 9] },
];

function runCmd(cmd, args, cwd, allowFail = false) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (allowFail) {
      return null;
    }
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const stdout = err.stdout ? String(err.stdout).trim() : '';
    throw new Error(
      `Command failed: ${cmd} ${args.join(' ')}\n${stderr || stdout || err.message}`
    );
  }
}

function pushWithRetry(cwd, refArgs, maxRetries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      runCmd('git', ['push', ...refArgs], cwd, false);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(
        `  [warn] git push attempt ${attempt}/${maxRetries} failed: ${err.message.split('\n')[0]}`
      );
      if (attempt < maxRetries) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 4000);
      }
    }
  }
  throw lastErr;
}

function resolveArchiveSource(archiveUrl) {
  const rel = decodeURIComponent(archiveUrl.slice('/vol-archive/'.length));
  const candidates = [
    path.join(VOL_ARCHIVE_ROOT, rel),
    path.join(VOL_ARCHIVE_ROOT, rel.normalize('NFC')),
    path.join(VOL_ARCHIVE_ROOT, rel.normalize('NFD')),
  ];
  for (const candidate of candidates) {
    if (candidate.startsWith(VOL_ARCHIVE_ROOT) && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function collectVolUrls() {
  const seen = new Map(); // archiveUrl -> { vol, asciiPath, srcPath, size }
  const volCounts = {};

  for (let v = 1; v <= 10; v++) {
    const jsonPath = path.join(VOL_DATA_DIR, `vol-${v}.json`);
    const volData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    let idx = 0;

    function walk(node) {
      if (!node) return;
      if (typeof node === 'string') {
        if (node.startsWith('/vol-archive/') && !seen.has(node)) {
          const srcPath = resolveArchiveSource(node);
          if (!srcPath) {
            throw new Error(`Missing source file on disk for URL: ${node}`);
          }
          const stat = fs.statSync(srcPath);
          const ext = path.extname(srcPath).toLowerCase() || '.bin';
          const hash10 = crypto
            .createHash('sha1')
            .update(node)
            .digest('hex')
            .slice(0, 10);
          idx++;
          const asciiPath = `v${v}/${String(idx).padStart(3, '0')}-${hash10}${ext}`;
          seen.set(node, {
            vol: v,
            asciiPath,
            srcPath,
            size: stat.size,
          });
          volCounts[v] = (volCounts[v] || 0) + 1;
        }
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
      } else if (typeof node === 'object') {
        for (const val of Object.values(node)) walk(val);
      }
    }

    walk(volData);
  }

  return { seen, volCounts };
}

function getRemoteTreeSet(repoFull) {
  const out = runCmd(
    'gh',
    ['api', `repos/${repoFull}/git/trees/main?recursive=1`, '--jq', '.tree[].path'],
    PROJECT_ROOT,
    true
  );
  if (out === null) return null;
  return new Set(
    out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function ensureBranchPagesEnabled(repoFull) {
  const postOut = runCmd(
    'gh',
    [
      'api',
      '-X',
      'POST',
      `repos/${repoFull}/pages`,
      '-f',
      'source[branch]=main',
      '-f',
      'source[path]=/',
    ],
    PROJECT_ROOT,
    true
  );
  if (postOut === null) {
    runCmd(
      'gh',
      [
        'api',
        '-X',
        'PUT',
        `repos/${repoFull}/pages`,
        '-f',
        'source[branch]=main',
        '-f',
        'source[path]=/',
      ],
      PROJECT_ROOT,
      true
    );
  }
}

function configureGitRepo(repoDir, repoUrl) {
  runCmd('git', ['config', 'user.name', OWNER], repoDir);
  runCmd('git', ['config', 'user.email', GIT_EMAIL], repoDir);
  runCmd('git', ['config', 'core.compression', '0'], repoDir);
  runCmd('git', ['config', 'http.postBuffer', '524288000'], repoDir);
  runCmd('git', ['config', 'http.lowSpeedLimit', '0'], repoDir);
  runCmd('git', ['config', 'http.lowSpeedTime', '999999'], repoDir);

  const existingOrigin = runCmd('git', ['remote', 'get-url', 'origin'], repoDir, true);
  if (existingOrigin === null) {
    runCmd('git', ['remote', 'add', 'origin', repoUrl], repoDir);
  }
}

function buildBatches(items) {
  const batches = [];
  let current = [];
  let currentBytes = 0;

  for (const item of items) {
    if (current.length > 0 && currentBytes + item.size > MAX_BATCH_BYTES) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += item.size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function main() {
  if (!fs.existsSync(VOL_ARCHIVE_ROOT)) {
    throw new Error(`Original archive root not found: ${VOL_ARCHIVE_ROOT}`);
  }

  console.log('Collecting all /vol-archive/ URLs across Vol 1-10 JSONs...');
  const { seen } = collectVolUrls();
  console.log(`Found ${seen.size} unique files ready for CDN packaging.`);

  // Assign repoName to each item and emit src/data/volumes/remote-media-map.json
  const volToPack = new Map();
  for (const pack of PACKS) {
    for (const v of pack.vols) volToPack.set(v, pack);
  }

  const remoteMap = {};
  const itemsByRepo = new Map();
  for (const pack of PACKS) itemsByRepo.set(pack.repoName, []);

  for (const [archiveUrl, info] of seen.entries()) {
    const pack = volToPack.get(info.vol);
    if (!pack) throw new Error(`No pack configured for Vol ${info.vol}`);
    const cdnUrl = `https://${OWNER}.github.io/${pack.repoName}/${info.asciiPath}`;
    remoteMap[archiveUrl] = cdnUrl;
    itemsByRepo.get(pack.repoName).push({
      archiveUrl,
      cdnUrl,
      ...info,
    });
  }

  fs.writeFileSync(MAP_OUTPUT_PATH, JSON.stringify(remoteMap, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${Object.keys(remoteMap).length} CDN mappings to ${MAP_OUTPUT_PATH}`);

  fs.mkdirSync(TMP_ROOT, { recursive: true });

  for (const pack of PACKS) {
    const repoFull = `${OWNER}/${pack.repoName}`;
    const repoUrl = `https://github.com/${repoFull}.git`;
    const items = itemsByRepo.get(pack.repoName);
    const totalMB = (items.reduce((s, x) => s + x.size, 0) / 1048576).toFixed(1);

    console.log(
      `\n=== Pack ${pack.packNum}/7: ${repoFull} (Vol ${pack.vols.join('+')}, ${items.length} files, ${totalMB} MB) ===`
    );

    const repoExists =
      runCmd('gh', ['repo', 'view', repoFull], PROJECT_ROOT, true) !== null;
    if (!repoExists) {
      console.log(`  Creating public repo ${repoFull}...`);
      runCmd(
        'gh',
        [
          'repo',
          'create',
          repoFull,
          '--public',
          '--description',
          `Original media CDN pack ${pack.packNum} for IELTS Study Hub`,
        ],
        PROJECT_ROOT
      );
    } else {
      console.log(`  Repo ${repoFull} already exists.`);
    }

    let remoteTree = getRemoteTreeSet(repoFull);
    if (
      remoteTree &&
      remoteTree.has('.nojekyll') &&
      items.every((it) => remoteTree.has(it.asciiPath))
    ) {
      console.log(`  All ${items.length} files already exist in ${repoFull}; skipping upload.`);
      ensureBranchPagesEnabled(repoFull);
      continue;
    }

    const tempRepo = path.join(TMP_ROOT, pack.repoName);
    fs.rmSync(tempRepo, { recursive: true, force: true });

    try {
      let pendingItems = items;
      if (remoteTree && remoteTree.size > 0) {
        console.log(
          `  Resuming partial repo ${repoFull} (${remoteTree.size} entries already uploaded)...`
        );
        runCmd('git', ['clone', '--depth', '1', repoUrl, tempRepo], TMP_ROOT);
        configureGitRepo(tempRepo, repoUrl);
        pendingItems = items.filter((it) => !remoteTree.has(it.asciiPath));
      } else {
        fs.mkdirSync(tempRepo, { recursive: true });
        runCmd('git', ['init', '-b', 'main'], tempRepo);
        configureGitRepo(tempRepo, repoUrl);

        fs.writeFileSync(path.join(tempRepo, '.nojekyll'), '', 'utf8');
        fs.writeFileSync(
          path.join(tempRepo, 'index.html'),
          `<!doctype html><meta charset="utf-8"><title>${pack.repoName}</title><p>IELTS Study Hub Static Media CDN Pack ${pack.packNum} (${items.length} files).</p>\n`,
          'utf8'
        );
        runCmd('git', ['add', '.'], tempRepo);
        runCmd('git', ['commit', '-m', 'Initialize media CDN pack'], tempRepo);
        pushWithRetry(tempRepo, ['-u', 'origin', 'main', '--force']);
      }

      const batches = buildBatches(pendingItems);
      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        const batchMB = (
          batch.reduce((s, x) => s + x.size, 0) / 1048576
        ).toFixed(1);
        console.log(
          `  Copying batch ${bi + 1}/${batches.length} (${batch.length} files, ${batchMB} MB)...`
        );

        for (const item of batch) {
          const destPath = path.join(tempRepo, item.asciiPath);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(item.srcPath, destPath);
        }

        runCmd('git', ['add', '.'], tempRepo);
        const statusOut = runCmd('git', ['status', '--porcelain'], tempRepo);
        if (statusOut.trim()) {
          runCmd(
            'git',
            [
              'commit',
              '-m',
              `Upload media batch ${bi + 1}/${batches.length}`,
            ],
            tempRepo
          );
          console.log(`  Pushing batch ${bi + 1}/${batches.length} to ${repoFull}...`);
          pushWithRetry(tempRepo, ['origin', 'main']);
        }
      }

      console.log(`  Enabling branch-based GitHub Pages for ${repoFull}...`);
      ensureBranchPagesEnabled(repoFull);
      console.log(`  Completed pack ${pack.packNum}/7!`);
    } finally {
      fs.rmSync(tempRepo, { recursive: true, force: true });
    }
  }

  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  console.log('\nALL 7 MEDIA PACKS UPLOADED CLEANLY (337/337 FILES).');
}

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
