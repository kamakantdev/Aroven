/**
 * Download data as a CSV file.
 * @param rows   Array of objects to export
 * @param columns  Array of { key, label } to pick from each row
 * @param filename  Name of the downloaded file (without .csv)
 */
export function downloadCSV(
    rows: any[],
    columns: { key: string; label: string }[],
    filename: string
) {
    const header = columns.map((c) => `"${c.label}"`).join(',');
    const body = rows
        .map((row) =>
            columns
                .map((c) => {
                    const val = row?.[c.key];
                    const str = val == null ? '' : String(val).replace(/"/g, '""');
                    return `"${str}"`;
                })
                .join(',')
        )
        .join('\n');

    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
