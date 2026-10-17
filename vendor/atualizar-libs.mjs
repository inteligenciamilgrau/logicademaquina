// Regenera as bibliotecas da pasta vendor/ a partir dos pacotes oficiais do npm.
// O site NÃO precisa deste script para funcionar: ele só serve para trocar de versão
// ou para conferir que os arquivos de vendor/ são mesmo os dos pacotes oficiais.
//
// Uso (Node 18+ com npm no PATH):  node vendor/atualizar-libs.mjs
//
// - Instala numa pasta temporária fora do repositório, com --ignore-scripts
//   (nenhum script de instalação de pacote é executado).
// - O npm confere a integridade (sha512) de cada pacote baixado.
// - React e React DOM só existem em CommonJS: o esbuild empacota os três módulos
//   (react, react-dom/client, lucide-react) com um pedaço compartilhado, para todos
//   usarem a MESMA cópia do React (senão os hooks quebram).
// - Versões, integridade do npm e sha256 de cada arquivo gerado vão para vendor/versoes.json.
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const VENDOR = dirname(fileURLToPath(import.meta.url));
const NPM = {
  react: '18.3.1',
  'react-dom': '18.3.1',
  'lucide-react': '0.460.0',
  '@babel/standalone': '7.26.2',
  esbuild: '0.24.0', // só empacota; não vai para o site
};
// O "Play CDN" do Tailwind não é publicado no npm: vem do CDN oficial, uma vez, e fica salvo aqui.
const TAILWIND = '3.4.15';
const TAILWIND_URL = `https://cdn.tailwindcss.com/${TAILWIND}`;
const TAILWIND_LICENSE_URL = `https://cdn.jsdelivr.net/npm/tailwindcss@${TAILWIND}/LICENSE`;

process.env.NODE_ENV = 'production';
const tmp = mkdtempSync(join(tmpdir(), 'logigen-vendor-'));

async function download(url) {
  const r = await fetch(url);
  if (r.status !== 200) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

try {
  writeFileSync(join(tmp, 'package.json'), JSON.stringify({ private: true, dependencies: NPM }));
  execSync('npm install --ignore-scripts --no-audit --no-fund', { cwd: tmp, stdio: 'inherit' });
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

  const esmDir = join(VENDOR, 'esm');
  rmSync(esmDir, { recursive: true, force: true });
  const esbuild = req('esbuild');
  await esbuild.build({
    absWorkingDir: tmp,
    entryPoints: ['react.js', 'react-dom-client.js', 'lucide-react.js'],
    outdir: esmDir,
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
  await esbuild.stop(); // fecha o processo do esbuild, senão o Windows não deixa apagar a pasta temporária

  copyFileSync(req.resolve('@babel/standalone/babel.min.js'), join(VENDOR, 'babel.min.js'));
  writeFileSync(join(VENDOR, 'tailwindcss.js'), await download(TAILWIND_URL));

  // Licenças de tudo o que vai para o site (scheduler entra junto com o react-dom).
  const licDir = join(VENDOR, 'licencas');
  rmSync(licDir, { recursive: true, force: true });
  mkdirSync(licDir);
  for (const pkg of ['react', 'react-dom', 'scheduler', 'lucide-react', '@babel/standalone']) {
    copyFileSync(join(dirname(req.resolve(`${pkg}/package.json`)), 'LICENSE'), join(licDir, `${pkg.replace('/', '__')}.txt`));
  }
  writeFileSync(join(licDir, 'tailwindcss.txt'), await download(TAILWIND_LICENSE_URL));

  // Registro para auditoria: de onde veio cada coisa e o sha256 de cada arquivo publicado.
  const lock = JSON.parse(readFileSync(join(tmp, 'package-lock.json'), 'utf8')).packages;
  const pacotes = {};
  for (const pkg of ['react', 'react-dom', 'scheduler', 'lucide-react', '@babel/standalone', 'esbuild']) {
    const p = lock[`node_modules/${pkg}`];
    pacotes[pkg] = { versao: p.version, integridade_npm: p.integrity };
  }
  pacotes['tailwindcss (Play CDN)'] = { versao: TAILWIND, origem: TAILWIND_URL };

  const arquivos = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (!['atualizar-libs.mjs', 'versoes.json'].includes(name)) {
        arquivos[relative(VENDOR, full).replaceAll('\\', '/')] = 'sha256-' + createHash('sha256').update(readFileSync(full)).digest('base64');
      }
    }
  };
  walk(VENDOR);
  writeFileSync(join(VENDOR, 'versoes.json'), JSON.stringify({ pacotes, arquivos }, null, 2) + '\n');
  console.log(`vendor/ atualizado: ${Object.keys(arquivos).length} arquivos`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
