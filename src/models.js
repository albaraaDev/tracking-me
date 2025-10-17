import { createId, deepClone } from "./utils.js";

export const TableType = Object.freeze({
  STATUS: "status",
  NOTES: "notes",
});

export const StatusState = Object.freeze({
  DONE: "done",
  MISSED: "missed",
  PARTIAL: "partial",
  NONE: "none",
});

const STATUS_SEQUENCE = [
  StatusState.NONE,
  StatusState.DONE,
  StatusState.PARTIAL,
  StatusState.MISSED,
];

export function cycleStatus(current) {
  const index = STATUS_SEQUENCE.indexOf(current);
  const nextIndex = index === -1 ? 0 : (index + 1) % STATUS_SEQUENCE.length;
  return STATUS_SEQUENCE[nextIndex];
}

export function createProject({
  name,
  description = "",
  startDate = null,
  endDate = null,
} = {}) {
  return {
    id: createId("project"),
    name: name ?? "مشروع جديد",
    description,
    startDate,
    endDate,
    sections: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
}

export function createSection({
  name,
  description = "",
  startDate = null,
  endDate = null,
  table = null,
} = {}) {
  return {
    id: createId("section"),
    name: name ?? "قسم جديد",
    description,
    startDate,
    endDate,
    table:
      table ??
      createStatusTable({
        columnCount: 7,
        rowItems: ["العنصر الأول"],
      }),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
}

export function createStatusTable({
  columnCount = 7,
  rowItems = [],
  columnLabels = [],
  startIndex = 1,
} = {}) {
  const columns = generateDimension({
    labels: columnLabels,
    fallback: (index) => `اليوم ${startIndex + index}`,
    count: columnCount,
    prefix: "col",
  });

  const rows = generateDimension({
    labels: rowItems,
    fallback: (index) => `العنصر ${index + 1}`,
    count: Math.max(rowItems.length, 4) || 4,
    prefix: "row",
  });

  const cells = buildCellMatrix(rows, columns, createStatusCell);

  return {
    id: createId("table"),
    type: TableType.STATUS,
    columns,
    rows,
    cells,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
}

export function createNotesTable({
  columnCount = 7,
  rowItems = [],
  columnLabels = [],
  startIndex = 1,
} = {}) {
  const columns = generateDimension({
    labels: columnLabels,
    fallback: (index) => `اليوم ${startIndex + index}`,
    count: columnCount,
    prefix: "col",
  });

  const rows = generateDimension({
    labels: rowItems,
    fallback: (index) => `العنصر ${index + 1}`,
    count: Math.max(rowItems.length, 4) || 4,
    prefix: "row",
  });

  const cells = buildCellMatrix(rows, columns, createNoteCell);

  return {
    id: createId("table"),
    type: TableType.NOTES,
    columns,
    rows,
    cells,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
}

export function rebuildStatusTable(table, { columnLabels = [], rowLabels = [] }) {
  return rebuildTable({
    table,
    columnLabels,
    rowLabels,
    cellBuilder: createStatusCell,
  });
}

export function rebuildNotesTable(table, { columnLabels = [], rowLabels = [] }) {
  return rebuildTable({
    table,
    columnLabels,
    rowLabels,
    cellBuilder: createNoteCell,
  });
}

export function updateTableTimestamp(table) {
  table.updatedAt = timestamp();
  return table;
}

export function cloneTable(table) {
  return deepClone(table);
}

export function createStatusCell() {
  return {
    status: StatusState.NONE,
    note: "",
  };
}

export function createNoteCell() {
  return {
    text: "",
  };
}

export function setStatusCell(table, rowId, columnId, { status, note = "" }) {
  if (!table.cells[rowId]) {
    table.cells[rowId] = {};
  }
  if (!table.cells[rowId][columnId]) {
    table.cells[rowId][columnId] = createStatusCell();
  }
  table.cells[rowId][columnId].status = status;
  table.cells[rowId][columnId].note = note;
  updateTableTimestamp(table);
}

export function setNoteCell(table, rowId, columnId, text) {
  if (!table.cells[rowId]) {
    table.cells[rowId] = {};
  }
  if (!table.cells[rowId][columnId]) {
    table.cells[rowId][columnId] = createNoteCell();
  }
  table.cells[rowId][columnId].text = text;
  updateTableTimestamp(table);
}

function rebuildTable({ table, columnLabels, rowLabels, cellBuilder }) {
  const normalizedColumns = sanitizeLabels(
    columnLabels,
    (index) => table.columns[index]?.label ?? `اليوم ${index + 1}`,
    table.columns.length || 1
  );

  const normalizedRows = sanitizeLabels(
    rowLabels,
    (index) => table.rows[index]?.label ?? `العنصر ${index + 1}`,
    table.rows.length || 1
  );

  const columnsByLabel = new Map(table.columns.map((column) => [column.label, column]));
  const rowsByLabel = new Map(table.rows.map((row) => [row.label, row]));

  const columns = normalizedColumns.map((label) => {
    const existing = columnsByLabel.get(label);
    return existing ? { ...existing } : { id: createId("col"), label };
  });

  const rows = normalizedRows.map((label) => {
    const existing = rowsByLabel.get(label);
    return existing ? { ...existing } : { id: createId("row"), label };
  });

  const cells = {};
  rows.forEach((row) => {
    cells[row.id] = {};
    columns.forEach((column) => {
      const sourceRow = rowsByLabel.get(row.label);
      const sourceColumn = columnsByLabel.get(column.label);
      const previous =
        sourceRow && sourceColumn
          ? table.cells?.[sourceRow.id]?.[sourceColumn.id]
          : null;
      cells[row.id][column.id] = previous ? deepClone(previous) : cellBuilder();
    });
  });

  return {
    ...table,
    columns,
    rows,
    cells,
    updatedAt: timestamp(),
  };
}

function generateDimension({ labels = [], fallback, count, prefix }) {
  const cleaned = sanitizeLabels(
    labels,
    fallback,
    count
  );
  return cleaned.map((label) => ({
    id: createId(prefix),
    label,
  }));
}

function sanitizeLabels(list, fallback, count = 1) {
  const cleaned = (list ?? [])
    .map((item) => (item ?? "").trim())
    .filter(Boolean);

  if (cleaned.length) {
    return cleaned;
  }

  return Array.from({ length: Math.max(count, 1) }, (_, index) => fallback(index));
}

function buildCellMatrix(rows, columns, cellFactory) {
  const map = {};
  rows.forEach((row) => {
    map[row.id] = {};
    columns.forEach((column) => {
      map[row.id][column.id] = cellFactory();
    });
  });
  return map;
}

function timestamp() {
  return new Date().toISOString();
}
