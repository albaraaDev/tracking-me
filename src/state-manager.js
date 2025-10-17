import {
  loadAppData,
  saveAppData,
  exportAppData,
  importAppData,
  loadBackup,
} from "./storage.js";
import {
  createProject,
  createSection,
  TableType,
  rebuildStatusTable,
  rebuildNotesTable,
  setStatusCell,
  setNoteCell,
  cycleStatus,
  StatusState,
  createStatusCell,
} from "./models.js";
import { deepClone } from "./utils.js";

let appData = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((listener) => {
    try {
      listener(deepClone(appData));
    } catch (error) {
      console.error("تعذّر تحديث أحد المستمعين:", error);
    }
  });
}

function setData(nextData) {
  appData = saveAppData(nextData);
  notify();
  return appData;
}

function mutate(mutator) {
  const draft = deepClone(appData);
  const result = mutator(draft);
  setData(draft);
  return result;
}

function resolveSection(draft, projectId, sectionId) {
  const project = draft.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error("المشروع غير موجود.");
  }
  const section = project.sections.find((item) => item.id === sectionId);
  if (!section) {
    throw new Error("القسم غير موجود.");
  }
  return { project, section };
}

export function initState() {
  appData = loadAppData();
  notify();
  return appData;
}

export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getState() {
  return deepClone(appData);
}

export function addProject(payload) {
  return mutate((draft) => {
    const project = createProject(payload);
    draft.projects.push(project);
    draft.updatedAt = new Date().toISOString();
    return project;
  });
}

export function updateProject(projectId, updates) {
  return mutate((draft) => {
    const project = draft.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("المشروع غير موجود.");
    }
    Object.assign(project, updates, { updatedAt: new Date().toISOString() });
    return project;
  });
}

export function removeProject(projectId) {
  mutate((draft) => {
    draft.projects = draft.projects.filter((item) => item.id !== projectId);
  });
}

export function addSection(projectId, payload) {
  return mutate((draft) => {
    const project = draft.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("المشروع غير موجود.");
    }
    const section = createSection(payload);
    project.sections.push(section);
    project.updatedAt = new Date().toISOString();
    return section;
  });
}

export function updateSection(projectId, sectionId, updates) {
  return mutate((draft) => {
    const { project, section } = resolveSection(draft, projectId, sectionId);
    Object.assign(section, updates, { updatedAt: new Date().toISOString() });
    project.updatedAt = new Date().toISOString();
    return section;
  });
}

export function removeSection(projectId, sectionId) {
  mutate((draft) => {
    const project = draft.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("المشروع غير موجود.");
    }
    project.sections = project.sections.filter((item) => item.id !== sectionId);
    project.updatedAt = new Date().toISOString();
  });
}

export function updateProfile(updates) {
  return mutate((draft) => {
    draft.profile = {
      ...draft.profile,
      ...updates,
    };
    draft.updatedAt = new Date().toISOString();
    return draft.profile;
  });
}

export function updateTableStructure(projectId, sectionId, { columnLabels, rowLabels }) {
  return mutate((draft) => {
    const { project, section } = resolveSection(draft, projectId, sectionId);
    const table = section.table;
    if (table.type === TableType.STATUS) {
      section.table = rebuildStatusTable(table, { columnLabels, rowLabels });
    } else {
      section.table = rebuildNotesTable(table, { columnLabels, rowLabels });
    }
    section.updatedAt = new Date().toISOString();
    project.updatedAt = section.updatedAt;
    return section.table;
  });
}

export function toggleStatusCell(projectId, sectionId, rowId, columnId) {
  return mutate((draft) => {
    const { project, section } = resolveSection(draft, projectId, sectionId);
    if (section.table.type !== TableType.STATUS) {
      throw new Error("نوع الجدول لا يدعم الحالات اللونية.");
    }
    const table = section.table;
    const existing =
      table.cells?.[rowId]?.[columnId] ??
      createStatusCell();
    const next = cycleStatus(existing.status ?? StatusState.NONE);
    setStatusCell(table, rowId, columnId, {
      status: next,
      note: existing.note ?? "",
    });
    section.updatedAt = new Date().toISOString();
    project.updatedAt = section.updatedAt;
    return next;
  });
}

export function setStatusCellNote(projectId, sectionId, rowId, columnId, note) {
  return mutate((draft) => {
    const { project, section } = resolveSection(draft, projectId, sectionId);
    if (section.table.type !== TableType.STATUS) {
      throw new Error("نوع الجدول لا يدعم الملاحظات.");
    }
    const table = section.table;
    const existing =
      table.cells?.[rowId]?.[columnId] ??
      createStatusCell();
    setStatusCell(table, rowId, columnId, {
      status: existing.status ?? StatusState.NONE,
      note,
    });
    section.updatedAt = new Date().toISOString();
    project.updatedAt = section.updatedAt;
    return table.cells[rowId][columnId];
  });
}

export function setNoteCellText(projectId, sectionId, rowId, columnId, text) {
  return mutate((draft) => {
    const { project, section } = resolveSection(draft, projectId, sectionId);
    if (section.table.type !== TableType.NOTES) {
      throw new Error("نوع الجدول لا يدعم النصوص الطويلة.");
    }
    const table = section.table;
    setNoteCell(table, rowId, columnId, text);
    section.updatedAt = new Date().toISOString();
    project.updatedAt = section.updatedAt;
    return table.cells[rowId][columnId];
  });
}

export function setStatusCellState(projectId, sectionId, rowId, columnId, status, note = "") {
  return mutate((draft) => {
    const { project, section } = resolveSection(draft, projectId, sectionId);
    if (section.table.type !== TableType.STATUS) {
      throw new Error("نوع الجدول لا يدعم الحالات اللونية.");
    }
    const table = section.table;
    setStatusCell(table, rowId, columnId, { status, note });
    section.updatedAt = new Date().toISOString();
    project.updatedAt = section.updatedAt;
    return table.cells[rowId][columnId];
  });
}

export function exportData() {
  return exportAppData(appData);
}

export function importData(json) {
  const parsed = importAppData(json);
  setData(parsed);
  return parsed;
}

export function restoreLastBackup() {
  const backup = loadBackup();
  if (backup) {
    setData(backup);
    return true;
  }
  return false;
}
