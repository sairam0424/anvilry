import type { ReactNode } from "react";

/**
 * The reference tables of /developers (endpoints, response headers, error codes, CLI commands) share
 * one shape: a screen-reader caption, a header row and one row per entry. The classes are passed in
 * whole, as literals at each call site, because Tailwind finds a class only where it is written out.
 */

export interface ApiTableColumn {
  header: string;
  /** Class of every cell of this column. */
  cell: string;
}

export interface ApiTableRow {
  key: string;
  cells: ReactNode[];
}

const HEAD_CELL = "py-2 pr-4 font-mono text-xs font-normal";
const HEAD_CELL_LAST = "py-2 font-mono text-xs font-normal";

export function ApiTable({
  caption,
  tableClass,
  columns,
  rows,
}: {
  caption: string;
  tableClass: string;
  columns: ApiTableColumn[];
  rows: ApiTableRow[];
}) {
  return (
    <table className={tableClass}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border text-left text-fg-subtle">
          {columns.map(({ header }, i) => (
            <th
              key={header}
              scope="col"
              className={i < columns.length - 1 ? HEAD_CELL : HEAD_CELL_LAST}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, cells }) => (
          <tr key={key} className="border-b border-border/50">
            {cells.map((cell, i) => (
              <td key={columns[i].header} className={columns[i].cell}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
