# logicademaquina
Pesquisa Sobre Lógica de Máquina

**Acesse:** https://www.inteligenciamilgrau.com.br/logicademaquina/

## LogiGen Pro

Gerador de desafios de raciocínio lógico com palavras inventadas. Você escreve as regras com variáveis (`{S1}`, `{V1}`, `{A1}`, `{N1}`, `{L1}`) e o app troca cada uma por uma palavra do dicionário, mantendo a mesma palavra em todos os lugares onde a variável aparece.

## Como funciona

O app inteiro está no `index.html`. É React escrito em JSX, mas não precisa de Node nem de build:

- React, React DOM e os ícones (lucide-react) vêm do esm.sh por um import map;
- o Tailwind (Play CDN) gera o CSS no navegador;
- o Babel traduz o JSX na hora em que a página abre.

Por isso o GitHub Pages publica o arquivo como está, direto da branch `main`. O arquivo `.nojekyll` desliga o Jekyll, que não tem nada a fazer aqui.

## Rodar localmente

Sirva a pasta com qualquer servidor estático e abra no navegador:

```
python -m http.server 8000
```

Depois acesse http://localhost:8000.
