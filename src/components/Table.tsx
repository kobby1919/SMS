type TableProps<T> = {
  columns: { header: string; accessor: string; className?: string }[];
  renderRow: (item: T) => React.ReactNode;
  data: T[];
};

const Table = <T,>({
  columns,
  renderRow,
  data,
}: TableProps<T>) => {
  return (
    <div className="mt-4 w-full min-w-0 overflow-x-auto overscroll-x-contain" tabIndex={0} role="region" aria-label="Records table">
    <table className="w-full">
      <thead>
        <tr className="text-left text-gray-500 text-sm">
            {
                columns.map((col)=> (
                    <th key={col.accessor} className={col.className}>{col.header}</th>
                ))
            }
        </tr>
      </thead>
      <tbody className="">
        {
            data.map((item) => (
                renderRow(item)
            ))
        }
      </tbody>
    </table>
    </div>
  );
};

export default Table;
