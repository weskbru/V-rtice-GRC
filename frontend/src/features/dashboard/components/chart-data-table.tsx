export interface ChartDataTableRow {
  readonly label: string;
  readonly value: number;
}

export interface ChartDataTableProps {
  caption: string;
  columnHeaders: readonly [string, string];
  rows: readonly ChartDataTableRow[];
}

export function ChartDataTable({
  caption,
  columnHeaders,
  rows,
}: ChartDataTableProps): React.JSX.Element {
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
