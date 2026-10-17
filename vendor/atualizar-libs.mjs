// Regenera as bibliotecas da pasta vendor/ a partir dos pacotes oficiais do npm.
// O site NÃO precisa deste script para funcionar: ele só serve para trocar de versão
// ou para conferir que os arquivos de vendor/ são mesmo os dos pacotes oficiais.
//
// Uso (Node 18+ com npm no PATH):  node vendor/atualizar-libs.mjs
//
// - As versões ficam em vendor/package.json e vendor/package-lock.json. O lockfile fixa
//   também as dependências indiretas e a integridade (sha512) de cada pacote, e é o que
//   o GitHub lê para avisar (Dependabot) quando sair uma falha numa dessas versões.
// - Instala com "npm ci" numa pasta temporária fora do repositório, com --ignore-scripts
//   (nenhum script de instalação de pacote é executado).
// - React e React DOM só existem em CommonJS: o esbuild empacota os três módulos
//   (react, react-dom/client, lucide-react) com um pedaço compartilhado, para todos
//   usarem a MESMA cópia do React (senão os hooks quebram).
// - Versões, integridade do npm e sha256 de cada arquivo gerado vão para vendor/versoes.json.
//
// Para trocar uma versão: edite vendor/package.json, rode dentro de vendor/
//   npm install --package-lock-only --ignore-scripts
// e depois este script.
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const VENDOR = dirname(fileURLToPath(import.meta.url));
// O "Play CDN" do Tailwind não é publicado no npm: vem do CDN oficial e precisa bater com o
// sha256 fixado aqui. Ao trocar de versão, o script falha mostrando o hash novo: confira o
// arquivo e só então atualize a constante.
const TAILWIND = {
  versao: '3.4.15',
  url: 'https://cdn.tailwindcss.com/3.4.15',
  sha256: 'sha256-CH7r/FwL+y4j1gjPAakkrMwbvVu3b8yfznYPyyVuruY=',
  licenca: 'https://cdn.jsdelivr.net/npm/tailwindcss@3.4.15/LICENSE',
  licencaSha256: 'sha256-YOC2jA81wHju86XSlBnQsD/4TsHfnD+dbjmlGaWueYU=',
};
// Tudo o que entra nos arquivos do site (scheduler vem junto com o react-dom).
const NO_SITE = ['react', 'react-dom', 'scheduler', 'lucide-react', '@babel/standalone'];
// Entradas da pasta vendor/ que não são arquivos de biblioteca.
const NAO_LISTAR = ['atualizar-libs.mjs', 'versoes.json', 'package.json', 'package-lock.json', 'node_modules'];

process.env.NODE_ENV = 'production';
const tmp = mkdtempSync(join(tmpdir(), 'logigen-vendor-'));
const sha256 = (buf) => 'sha256-' + createHash('sha256').update(buf).digest('base64');

async function downloadChecked(url, expected) {
  const r = await fetch(url);
  if (r.status !== 200) throw new Error(`${url}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (sha256(buf) !== expected) throw new Error(`${url}: sha256 ${sha256(buf)} não bate com o fixado (${expected})`);
  return buf;
}

let esbuild;
try {
  for (const f of ['package.json', 'package-lock.json']) copyFileSync(join(VENDOR, f), join(tmp, f));
  // --include=dev: com NODE_ENV=production o npm pularia o esbuild, que é devDependency.
  execSync('npm ci --include=dev --ignore-scripts --no-audit --no-fund', { cwd: tmp, stdio: 'inherit' });
  // Tudo é montado em "saida" e só vai para vendor/ no fim: uma falha no meio não deixa vendor/ pela metade.
  const saida = join(tmp, 'saida');
  const req = createRequire(join(tmp, 'package.json'));

  // Pontos de entrada: re-exporta cada nome do módulo CommonJS de forma explícita,
  // para o navegador receber módulos ES com exports nomeados (import { useState } from 'react').
  const cjsEntry = (pkg, file) => {
    const names = Object.keys(req(pkg)).filter((k) => k !== 'default' && /^[A-Za-z_$][\w$]*$/.test(k));
    writeFileSync(join(tmp, file), `import m from '${pkg}';\nexport default m;\nexport const { ${names.join(', ')} } = m;\n`);
  };
  cjsEntry('react', 'react.js');
  cjsEntry('react-dom/client', 'react-dom-client.js');
  writeFileSync(join(tmp, 'lucide-react.js'), `export * from 'lucide-react';\n`);

  esbuild = req('esbuild');
  await esbuild.build({
    absWorkingDir: tmp,
    entryPoints: ['react.js', 'react-dom-client.js', 'lucide-react.js'],
    outdir: join(saida, 'esm'),
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'eof',
    chunkNames: 'compartilhado-[hash]',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });

  copyFileSync(req.resolve('@babel/standalone/babel.min.js'), join(saida, 'babel.min.js'));
  writeFileSync(join(saida, 'tailwindcss.js'), await downloadChecked(TAILWIND.url, TAILWIND.sha256));

  const licDir = join(saida, 'licencas');
  mkdirSync(licDir);
  for (const pkg of NO_SITE) {
    copyFileSync(join(dirname(req.resolve(`${pkg}/package.json`)), 'LICENSE'), join(licDir, `${pkg.replace('/', '__')}.txt`));
  }
  writeFileSync(join(licDir, 'tailwindcss.txt'), await downloadChecked(TAILWIND.licenca, TAILWIND.licencaSha256));

  // Tudo pronto: troca as pastas geradas de vendor/ pelas novas (esm/ pode mudar de nome de arquivo).
  for (const d of ['esm', 'licencas']) rmSync(join(VENDOR, d), { recursive: true, force: true });
  cpSync(saida, VENDOR, { recursive: true });

  // Registro para auditoria: de onde veio cada coisa e o sha256 de cada arquivo publicado.
  const lock = JSON.parse(readFileSync(join(tmp, 'package-lock.json'), 'utf8')).packages;
  const pacotes = {};
  for (const pkg of [...NO_SITE, 'esbuild']) {
    const p = lock[`node_modules/${pkg}`];
    pacotes[pkg] = { versao: p.version, integridade_npm: p.integrity };
  }
  pacotes['tailwindcss (Play CDN)'] = { versao: TAILWIND.versao, origem: TAILWIND.url };

  const arquivos = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (NAO_LISTAR.includes(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else arquivos[relative(VENDOR, full).replaceAll('\\', '/')] = sha256(readFileSync(full));
    }
  };
  walk(VENDOR);
  writeFileSync(join(VENDOR, 'versoes.json'), JSON.stringify({ pacotes, arquivos }, null, 2) + '\n');
  console.log(`vendor/ atualizado: ${Object.keys(arquivos).length} arquivos`);
} finally {
  await esbuild?.stop(); // fecha o processo do esbuild, senão o Windows não deixa apagar a pasta temporária
  rmSync(tmp, { recursive: true, force: true });
}
