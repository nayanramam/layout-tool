/**
 * Optional signoff backend for running real KLayout sky130 DRC/LVS decks.
 *
 * This is a stub showing how to integrate native EDA tooling. Install KLayout
 * and point KLAYOUT_BIN to the executable before running.
 */
import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const KLAYOUT_BIN = process.env.KLAYOUT_BIN ?? 'klayout';

type JobRequest = {
  gdsBase64: string;
  mode: 'drc' | 'lvs';
  netlist?: string;
};

function runKLayout(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(KLAYOUT_BIN, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout || stderr);
    });
  });
}

async function handleSignoff(body: JobRequest): Promise<{ ok: boolean; report: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'layout-tool-'));
  const gdsPath = join(dir, 'layout.gds');
  const buffer = Buffer.from(body.gdsBase64, 'base64');
  await writeFile(gdsPath, buffer);

  try {
    if (body.mode === 'drc') {
      const reportPath = join(dir, 'drc.rdb');
      const output = await runKLayout([
        '-b',
        '-r',
        process.env.SKY130_DRC_DECK ?? 'sky130A_mr.drc',
        '-rd',
        `input=${gdsPath}`,
        '-rd',
        `report=${reportPath}`,
      ]);
      let report = output;
      try {
        report = await readFile(reportPath, 'utf8');
      } catch {
        // deck may write elsewhere
      }
      return { ok: true, report };
    }

    if (!body.netlist) {
      return { ok: false, report: 'LVS requires netlist text in request body.' };
    }

    const spicePath = join(dir, 'top.spice');
    await writeFile(spicePath, body.netlist);
    const output = await runKLayout([
      '-b',
      '-r',
      process.env.SKY130_LVS_DECK ?? 'lvs_sky130.lylvs',
      '-rd',
      `layout=${gdsPath}`,
      '-rd',
      `schematic=${spicePath}`,
    ]);
    return { ok: true, report: output };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', klayout: KLAYOUT_BIN }));
    return;
  }

  if (req.method === 'POST' && req.url === '/signoff') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as JobRequest;
          const result = await handleSignoff(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, report: String(error) }));
        }
      })();
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Signoff backend listening on http://localhost:${PORT}`);
});
