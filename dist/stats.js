export function yoy(rows, row, key) {
  const prior = rows.find(r => r.month === `${Number(row.month.slice(0, 4)) - 1}${row.month.slice(4)}`);
  return prior && prior[key] !== 0 ? (row[key] / prior[key] - 1) * 100 : null;
}
export function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('월별 데이터가 없습니다.');
  const months = new Set();
  for (const row of rows) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || months.has(row.month) || !['exports','imports'].every(k => Number.isFinite(row[k]) && row[k] >= 0)) throw new Error('월별 데이터 형식이 올바르지 않습니다.');
    months.add(row.month);
  }
  return [...rows].sort((a,b) => a.month.localeCompare(b.month));
}
