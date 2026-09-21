# Pendências de refinamento — Fase 2

Itens observados na inspeção renderizada, não tratados na onda em que apareceram.
Cada um foi visto numa captura real, não inferido do código.

## Dashboard

- **Truncamento inconsistente.** Na carta "Itens que exigem revisão", ao menos uma linha
  corta no meio do descendente em vez de truncar com reticências — visível na linha
  RSK-2026-0010 de `wave3-dashboard/light-1440/02-dashboard.png`. As demais truncam
  corretamente. Tornar o truncamento deliberado em todas.

- **Anatomia divergente entre cartas irmãs.** As três cartas de "Requer atenção" têm
  estruturas internas diferentes: uma é número + lista, outra põe data à direita de cada
  item, a terceira acrescenta uma linha de subtítulo. São o mesmo tipo de coisa e deveriam
  ler como um conjunto.

## Geral

- **Indicador de desenvolvimento do Next.js** sobrepõe o canto inferior esquerdo da barra
  lateral em todas as capturas, incluindo o botão de recolher. É artefato de modo de
  desenvolvimento, não chega à produção — registrado para que ninguém o confunda com
  defeito ao revisar capturas.

---

**Atualização.** Os dois itens do Dashboard acima foram resolvidos na revisão de acompanhamento:
o truncamento ganhou esmaecimento inferior nos três contêineres roláveis, e as três cartas de
"Requer atenção" passaram a compartilhar a mesma anatomia de linha (código + título truncado à
esquerda, bloco de metadados à direita). Mantidos aqui como registro do que foi apontado e corrigido.
