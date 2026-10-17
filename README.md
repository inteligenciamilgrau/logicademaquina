# logicademaquina
Pesquisa Sobre Lógica de Máquina

**Acesse:** https://www.inteligenciamilgrau.com.br/logicademaquina/

## LogiGen Pro

Gerador de desafios de raciocínio lógico com palavras inventadas. Você escreve as regras com variáveis (`{S1}`, `{V1}`, `{A1}`, `{N1}`, `{L1}`) e o app troca cada uma por uma palavra do dicionário, mantendo a mesma palavra em todos os lugares onde a variável aparece.

## Como funciona

O app inteiro está no `index.html`. É React escrito em JSX, mas não precisa de Node nem de build:

- React, React DOM e os ícones (lucide-react) são carregados por um import map;
- o Tailwind (Play CDN) gera o CSS no navegador;
- o Babel traduz o JSX na hora em que a página abre.

Por isso o GitHub Pages publica o arquivo como está, direto da branch `main`. O arquivo `.nojekyll` desliga o Jekyll, que não tem nada a fazer aqui.

## Bibliotecas e segurança

Todas as bibliotecas ficam na pasta `vendor/`, servidas pelo próprio site: a página não carrega nada de CDN de terceiros. Uma regra de segurança (CSP) no `index.html` faz o navegador recusar qualquer script ou conexão de fora do site. Se um dia alguém colocar um `<script src="https://...">`, ele não vai carregar.

- `vendor/package.json` e `vendor/package-lock.json`: as versões exatas, inclusive das dependências indiretas, com a integridade de cada pacote. O GitHub lê esses arquivos para avisar quando sair uma falha de segurança numa dessas versões.
- `vendor/versoes.json`: versão de cada biblioteca, a integridade publicada no npm e o sha256 de cada arquivo.
- `vendor/licencas/`: a licença de cada biblioteca.
- `vendor/atualizar-libs.mjs`: refaz a pasta a partir dos pacotes oficiais do npm (`node vendor/atualizar-libs.mjs`). Serve para trocar de versão ou para conferir que os arquivos batem com os oficiais. O site não precisa dele para funcionar.

## Rodar localmente

Sirva a pasta com qualquer servidor estático e abra no navegador:

```
python -m http.server 8000 --bind 127.0.0.1
```

Depois acesse http://localhost:8000. O `--bind 127.0.0.1` deixa o servidor visível só no seu computador; sem ele, qualquer pessoa na mesma rede (o Wi-Fi de um café, por exemplo) consegue ver a pasta enquanto ele estiver rodando.
