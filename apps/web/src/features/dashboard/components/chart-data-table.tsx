/**
 * PharosGRC — visually-hidden text equivalent for a dashboard chart (T198).
 *
 * A chart drawn as coloured SVG rectangles is invisible to a screen-reader
 * user, and the SVG chart itself is marked `aria-hidden="true"` at its call
 * site (it would otherwise be an unlabelled, undescribed graphic). This
 * component is the honest text equivalent every chart renders alongside it
 * — a real `<table>` with the exact same values the chart draws, visually
 * hidden (`sr-only`: off-screen, not `display:none`, so assistive
 * technology still reads it) but always present in the DOM.
 */
export interface ChartDataTableRow {
  readonly label: string;
  readonly value: number;
}

export interface ChartDataTableProps {
  /** Visually-hidden `<caption>` naming the table for assistive technology. */
  caption: string;
  /** `[row-header column, value column]`, e.g. `['Nível de risco residual', 'Quantidade']`. */
  columnHeaders: readonly [string, string];
  rows: readonly ChartDataTableRow[];
}

export function ChartDataTable({
  caption,
  columnHeaders,
  rows,
}: ChartDataTableProps): React.JSX.Element {
  // `sr-only` goes on a wrapping <div>, never on the <table> itself (F-66
  // cause 2, F-67). A table box treats `width`/`height` as minimums and grows
  // to fit its content, and CSS leaves `overflow` on a table box undefined —
  // Chrome ignores it. `sr-only` on the table therefore left a ~384px-wide,
  // several-hundred-px-tall absolutely-positioned box that `clip` hid but that
  // still took up space: it widened the document sideways at phone width, and,
  // wherever no positioned ancestor contained it, it escaped `<main>` and gave
  // the whole document scrollable height — an empty area below the shell and a
  // second scrollbar. A <div> honours all three properties, so the table is
  // laid out inside a box that really is 1px and really does clip.
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{columnHeaders[0]}</th>
            <th scope="col">{columnHeaders[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
