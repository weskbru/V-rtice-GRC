# Login — referência Proteu

Implementação local de 21/09/2026, restrita à página pública de login.

- Composição aprovada pelo usuário: painel institucional claro, diagonal com faixa azul,
  formulário real e painel espacial à direita. Layout em `login.module.css`, sem imagem da interface.
- Artwork fornecido pelo usuário: `ChatGPT Image 21 de set. de 2026, 21_34_24.png`,
  1672 × 941 px. Derivados WebP em `apps/web/public/brand/login/`, com largura de 1280 e
  1672 px, qualidade 94. Sem geração, espelhamento ou ampliação do original.
- O `picture` seleciona a imagem apenas a partir de 900 px; abaixo disso usa fallback transparente
  e omite o painel. A orientação original e as cores da fotografia foram preservadas.
- Símbolo azul redesenhado em paths SVG no componente `PharosSymbol`, a partir da referência
  `ChatGPT Image 21 de set. de 2026, 21_38_21.png`. Não é recorte raster. Reutilizável sem alterar
  a marca do shell existente.
- Conteúdo editorial e rótulos pertencem a `src/lib/messages/auth.ts`.
- O formulário mantém referências estáveis e leitura do DOM (D-21), validação, API e destinos.
  Mostrar/ocultar senha é local; um bloqueio de submissão concorrente evita pedidos duplicados.
- Verificação reproduzível: `node scripts/login-visual-check.mjs`, a partir de `apps/web`, com
  a aplicação em execução. Para autenticação real, fornecer `SEED_ADMIN_EMAIL` e
  `SEED_ADMIN_PASSWORD` vigente do ambiente local já provisionado (o script não gira senhas).
  Capturas e resultados em `docs/reviews/ui/login-proteus/`.
