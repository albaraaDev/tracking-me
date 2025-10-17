import {
  initState,
  subscribe,
  addProject,
  updateProject,
  removeProject,
  addSection,
  updateSection,
  removeSection,
  updateTableStructure,
  setNoteCellText,
  setStatusCellState,
  exportData,
  importData,
  restoreLastBackup,
  updateProfile,
} from "./state-manager.js";
import {
  TableType,
  StatusState,
  createStatusTable,
  createNotesTable,
  createStatusCell,
} from "./models.js";

const state = {
  data: null,
  ui: {
    view: "home",
    selectedProjectId: null,
    selectedSectionId: null,
  },
};

const formatDate = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

document.addEventListener("DOMContentLoaded", init);

function init() {
  state.data = initState();
  subscribe((nextState) => {
    state.data = nextState;
    render();
  });

  document
    .querySelector("#nav-back")
    ?.addEventListener("click", handleBackNavigation);

  document
    .querySelector(".header-avatar")
    ?.addEventListener("click", openProfileDialog);

  document
    .querySelector(".header-text")
    ?.addEventListener("click", openProfileDialog);

  document
    .querySelector("#header-export")
    ?.addEventListener("click", handleExportData);

  document
    .querySelector("#header-import")
    ?.addEventListener("click", handleImportData);

  registerServiceWorker();

  render();
}

function render() {
  renderHeader();
  renderMainView();
}

function renderHeader() {
  if (!state.data) {
    return;
  }

  const titleEl = document.querySelector(".header-title");
  const overlineEl = document.querySelector(".header-overline");
  const subtitleEl = document.querySelector(".header-subtitle");
  const avatarEl = document.querySelector(".header-avatar");
  const actionsEl = document.querySelector(".header-actions");
  const backBtn = document.querySelector("#nav-back");

  const isHome = state.ui.view === "home";
  backBtn?.classList.toggle("hidden", isHome);
  actionsEl?.classList.toggle("hidden", !isHome);

  if (!titleEl || !overlineEl || !subtitleEl || !avatarEl) {
    return;
  }

  if (isHome) {
    avatarEl?.classList.remove("hidden");
    avatarEl.textContent = state.data.profile.avatar || "🙂";
    overlineEl.textContent = `مرحباً ${state.data.profile.name}`;
    titleEl.textContent = "متابعتي";
    subtitleEl.textContent = state.data.projects.length
      ? `مشاريعك الحالية: ${state.data.projects.length}`
      : "ابدأ مشروعك الأول اليوم";
    return;
  }

  const project = getSelectedProject();
  avatarEl?.classList.add("hidden");

  if (state.ui.view === "project" && project) {
    overlineEl.textContent = project.description || "مشروع بدون وصف بعد";
    titleEl.textContent = project.name;
    const range = formatRangeText(project.startDate, project.endDate);
    subtitleEl.textContent = range || "بدون مدة محددة";
    return;
  }

  if (state.ui.view === "section" && project) {
    const section = getSelectedSection();
    overlineEl.textContent = section ? project.name : "";
    if (section) {
      titleEl.textContent = section.name;
      const pieces = [];
      if (section.description) {
        pieces.push(section.description);
      }
      const dateRange = formatRangeText(section.startDate, section.endDate);
      if (dateRange) {
        pieces.push(dateRange);
      }
      subtitleEl.textContent =
        pieces.join(" • ") ||
        (section.table.type === TableType.STATUS ? "جدول ثلاثي الحالات" : "جدول ملاحظات");
    } else {
      titleEl.textContent = "قسم غير موجود";
      subtitleEl.textContent = "";
    }
    return;
  }
}

function renderMainView() {
  const container = document.querySelector("#app-content");
  if (!container) return;
  container.innerHTML = "";

  if (!state.data) {
    container.appendChild(renderEmptyState());
    return;
  }

  if (state.ui.view === "home") {
    container.appendChild(renderHomeView());
    return;
  }

  if (state.ui.view === "project") {
    const project = getSelectedProject();
    if (!project) {
      setView("home");
      return;
    }
    container.appendChild(renderProjectView(project));
    return;
  }

  if (state.ui.view === "section") {
    const project = getSelectedProject();
    const section = getSelectedSection();
    if (!project || !section) {
      setView("home");
      return;
    }
    container.appendChild(renderSectionView(project, section));
  }
}

function renderHomeView() {
  const wrapper = document.createElement("div");
  wrapper.className = "home-view";

  const actions = document.createElement("div");
  actions.className = "projects-actions stack";
  actions.innerHTML = `
    <button class="primary-btn" id="add-project-btn">مشروع جديد</button>
  `;
  actions.querySelector("#add-project-btn")?.addEventListener("click", () => openProjectForm());

  wrapper.appendChild(actions);

  if (!state.data.projects.length) {
    wrapper.appendChild(renderEmptyState());
    return wrapper;
  }

  const list = document.createElement("section");
  list.className = "projects-list";

  state.data.projects
    .slice()
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .forEach((project) => {
      list.appendChild(createProjectCard(project));
    });

  wrapper.appendChild(list);
  return wrapper;
}

function renderProjectView(project) {
  const wrapper = document.createElement("div");
  wrapper.className = "project-view";

  const toolbar = document.createElement("div");
  toolbar.className = "view-toolbar";
  toolbar.innerHTML = `
    <button class="primary-btn" id="add-section-btn">قسم جديد</button>
    <button class="icon-btn" id="project-options-btn" aria-label="خيارات المشروع">⋮</button>

  `;
  toolbar
    .querySelector("#add-section-btn")
    ?.addEventListener("click", () => openSectionForm(project));
  toolbar
    .querySelector("#project-options-btn")
    ?.addEventListener("click", () => openProjectMenu(project));

  wrapper.appendChild(toolbar);

  const listHeading = document.createElement("h3");
  listHeading.className = "list-title";
  listHeading.textContent = "أقسام المشروع";
  wrapper.appendChild(listHeading);

  if (!project.sections.length) {
    const empty = document.createElement("div");
    empty.className = "empty-hint";
    empty.innerHTML = `
      <p>لم تُضف أقساماً بعد. استخدم زر "قسم جديد" لتجهيز أول جدول متابعة.</p>
    `;
    wrapper.appendChild(empty);
    return wrapper;
  }

  const sectionsList = document.createElement("section");
  sectionsList.className = "sections-list";
  project.sections
    .slice()
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .forEach((section) => {
      sectionsList.appendChild(createSectionCard(project, section));
    });
  wrapper.appendChild(sectionsList);

  return wrapper;
}

function createProjectCard(project) {
  const card = document.createElement("article");
  card.className = "project-card";

  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = project.name;
  const menuBtn = document.createElement("button");
  menuBtn.className = "icon-btn";
  menuBtn.setAttribute("aria-label", "خيارات المشروع");
  menuBtn.textContent = "⋮";
  header.append(title, menuBtn);

  const description = document.createElement("p");
  description.textContent = project.description || "لم يُضف وصف بعد.";

  const footer = document.createElement("footer");
  const count = document.createElement("span");
  count.textContent = `${project.sections.length} أقسام`;
  const updated = document.createElement("span");
  updated.textContent = `آخر تحديث: ${formatRelative(project.updatedAt)}`;
  footer.append(count, updated);

  card.append(header, description, footer);

  card.addEventListener("click", () => {
    setView("project", { projectId: project.id });
  });

  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openProjectMenu(project);
  });

  return card;
}

function createSectionCard(project, section) {
  const card = document.createElement("article");
  card.className = "project-card section-summary";
  const typeLabel =
    section.table.type === TableType.STATUS ? "جدول ثلاثي الحالات" : "جدول ملاحظات";

  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = section.name;
  const menuBtn = document.createElement("button");
  menuBtn.className = "icon-btn";
  menuBtn.setAttribute("aria-label", "خيارات القسم");
  menuBtn.textContent = "⋮";
  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openSectionMenu(project, section);
  });
  header.append(title, menuBtn);

  const description = document.createElement("p");
  description.textContent = section.description || "لم يُضف وصف للقسم بعد.";

  const footer = document.createElement("footer");
  const typeSpan = document.createElement("span");
  typeSpan.textContent = typeLabel;
  const statsSpan = document.createElement("span");
  statsSpan.textContent = `${section.table.rows.length} عناصر × ${section.table.columns.length} أعمدة`;
  footer.append(typeSpan, statsSpan);

  card.append(header, description, footer);

  card.addEventListener("click", () => {
    setView("section", { projectId: project.id, sectionId: section.id });
  });

  return card;
}

function renderSectionView(project, section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section-view";

  const toolbar = document.createElement("div");
  toolbar.className = "view-toolbar";
  toolbar.innerHTML = `
    <button class="icon-btn" id="section-options-btn" aria-label="خيارات القسم">⋮</button>
  `;
  toolbar
    .querySelector("#section-options-btn")
    ?.addEventListener("click", () => openSectionMenu(project, section));

  wrapper.appendChild(toolbar);

  const typeLabel =
    section.table.type === TableType.STATUS ? "جدول ثلاثي الحالات" : "جدول ملاحظات";
  // const statsCard = document.createElement("section");
  // statsCard.className = "card section-stats";
  // const statRows = [
  //   { label: "نوع الجدول", value: typeLabel },
  //   { label: "عدد الأعمدة", value: section.table.columns.length },
  //   { label: "عدد العناصر", value: section.table.rows.length },
  // ];
  // const rangeText = formatRangeText(section.startDate, section.endDate);
  // if (rangeText) {
  //   statRows.push({ label: "الفترة", value: rangeText });
  // }
  // statsCard.innerHTML = statRows
  //   .map(
  //     (row) =>
  //       `<div class="stat-row"><span>${row.label}</span><strong>${row.value}</strong></div>`
  //   )
  //   .join("");
  // wrapper.appendChild(statsCard);

  const tableContainer = document.createElement("section");
  tableContainer.className = "card section-table";
  const tableElement =
    section.table.type === TableType.STATUS
      ? createStatusTableElement(project.id, section)
      : createNotesTableElement(project.id, section);
  tableContainer.appendChild(tableElement);
  wrapper.appendChild(tableContainer);

  return wrapper;
}

function createStatusTableElement(projectId, section) {
  const grid = document.createElement("div");
  grid.className = "tracker-grid status-grid";
  grid.style.gridTemplateColumns = `minmax(130px, 1.3fr) repeat(${section.table.columns.length}, minmax(80px, 1fr))`;

  const corner = document.createElement("div");
  corner.className = "grid-cell grid-header grid-corner";
  corner.textContent = "عناصر الجدول";
  grid.appendChild(corner);

  section.table.columns.forEach((column) => {
    const cell = document.createElement("div");
    cell.className = "grid-cell grid-header";
    cell.textContent = column.label;
    grid.appendChild(cell);
  });

  section.table.rows.forEach((row) => {
    const rowHeader = document.createElement("div");
    rowHeader.className = "grid-cell grid-row-header";
    rowHeader.textContent = row.label;
    grid.appendChild(rowHeader);

    section.table.columns.forEach((column) => {
      const cellData =
        section.table.cells?.[row.id]?.[column.id] ?? createStatusCell();
      const button = document.createElement("button");
      button.className = `grid-cell status-cell status-${cellData.status}`;
      if (cellData.note) {
        button.classList.add("has-note");
      }
      button.type = "button";
      button.dataset.projectId = projectId;
      button.dataset.sectionId = section.id;
      button.dataset.rowId = row.id;
      button.dataset.columnId = column.id;
      button.textContent = statusLabel(cellData.status);
      button.addEventListener("click", () =>
        openStatusCellDialog(projectId, section, row, column, cellData)
      );
      grid.appendChild(button);
    });
  });

  return grid;
}

function createNotesTableElement(projectId, section) {
  const grid = document.createElement("div");
  grid.className = "tracker-grid notes-grid";
  grid.style.gridTemplateColumns = `minmax(130px, 1.3fr) repeat(${section.table.columns.length}, minmax(100px, 1fr))`;

  const corner = document.createElement("div");
  corner.className = "grid-cell grid-header grid-corner";
  corner.textContent = "عناصر الجدول";
  grid.appendChild(corner);

  section.table.columns.forEach((column) => {
    const cell = document.createElement("div");
    cell.className = "grid-cell grid-header";
    cell.textContent = column.label;
    grid.appendChild(cell);
  });

  section.table.rows.forEach((row) => {
    const rowHeader = document.createElement("div");
    rowHeader.className = "grid-cell grid-row-header";
    rowHeader.textContent = row.label;
    grid.appendChild(rowHeader);

    section.table.columns.forEach((column) => {
      const cellData =
        section.table.cells?.[row.id]?.[column.id] ?? { text: "" };
      const button = document.createElement("button");
      button.className = "grid-cell note-cell";
      button.type = "button";
      button.textContent = cellData.text ? truncate(cellData.text, 32) : "أضف ملاحظة";
      button.dataset.projectId = projectId;
      button.dataset.sectionId = section.id;
      button.dataset.rowId = row.id;
      button.dataset.columnId = column.id;
      button.addEventListener("click", () =>
        openNoteCellDialog(projectId, section, row, column, cellData)
      );
      grid.appendChild(button);
    });
  });

  return grid;
}

function openProjectMenu(project) {
  openActionSheet({
    title: `خيارات "${project.name}"`,
    actions: [
      {
        label: "فتح المشروع",
        onClick: () => setView("project", { projectId: project.id }),
      },
      {
        label: "تحرير البيانات",
        onClick: () => openProjectForm(project),
      },
      {
        label: "حذف المشروع",
        variant: "danger",
        onClick: () => confirmProjectDeletion(project),
      },
    ],
  });
}

function openSectionMenu(project, section) {
  openActionSheet({
    title: `خيارات "${section.name}"`,
    actions: [
      {
        label: "تحرير القسم",
        onClick: () => openSectionForm(project, section),
      },
      {
        label: "إعدادات الجدول",
        onClick: () => openTableStructureDialog(project, section),
      },
      {
        label: "حذف القسم",
        variant: "danger",
        onClick: () => confirmSectionDeletion(project, section),
      },
    ],
  });
}

function openProjectForm(project = null) {
  const isEdit = Boolean(project);
  const dialog = createFormDialog({
    title: isEdit ? "تعديل المشروع" : "مشروع جديد",
    submitLabel: isEdit ? "حفظ" : "إضافة المشروع",
  });

  dialog.body.innerHTML = `
    <label class="form-field">
      <span>اسم المشروع</span>
      <input required name="name" placeholder="مثال: عادات الصباح">
    </label>
    <label class="form-field">
      <span>وصف مختصر</span>
      <textarea name="description" rows="3" placeholder="لمحة عن أهداف المشروع"></textarea>
    </label>
    <div class="form-grid">
      <label class="form-field">
        <span>تاريخ البداية</span>
        <input type="date" name="startDate">
      </label>
      <label class="form-field">
        <span>تاريخ النهاية</span>
        <input type="date" name="endDate">
      </label>
    </div>
  `;

  dialog.body.querySelector('input[name="name"]').value = project?.name ?? "";
  dialog.body.querySelector('textarea[name="description"]').value =
    project?.description ?? "";
  dialog.body.querySelector('input[name="startDate"]').value =
    project?.startDate ?? "";
  dialog.body.querySelector('input[name="endDate"]').value =
    project?.endDate ?? "";

  dialog.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(dialog.form);
    const name = form.get("name").trim();
    if (!name) {
      alert("الرجاء إدخال اسم للمشروع.");
      return;
    }

    const payload = {
      name,
      description: form.get("description").trim(),
      startDate: normalizeDate(form.get("startDate")),
      endDate: normalizeDate(form.get("endDate")),
    };

    if (isEdit) {
      updateProject(project.id, payload);
    } else {
      const created = addProject(payload);
      setView("project", { projectId: created.id });
    }
    dialog.close();
  });

  dialog.open();
}

function openProfileDialog() {
  if (!state.data) {
    return;
  }

  const dialog = createFormDialog({
    title: "التخصيص الشخصي",
    submitLabel: "حفظ الملف",
  });

  dialog.body.innerHTML = `
    <label class="form-field">
      <span>الاسم المعروض</span>
      <input name="profileName" maxlength="32" placeholder="اسمك الجميل">
    </label>
    <label class="form-field">
      <span>الرمز التعبيري</span>
      <input name="profileAvatar" maxlength="4" placeholder="🌱">
    </label>
    <div class="quick-pills">
      <span class="quick-label">اقتراحات:</span>
      <div class="pill-group">
        <button type="button" class="pill-btn" data-emoji="🌱">🌱</button>
        <button type="button" class="pill-btn" data-emoji="🔥">🔥</button>
        <button type="button" class="pill-btn" data-emoji="💡">💡</button>
        <button type="button" class="pill-btn" data-emoji="🏃‍♂️">🏃‍♂️</button>
        <button type="button" class="pill-btn" data-emoji="📚">📚</button>
      </div>
    </div>
  `;

  const nameInput = dialog.body.querySelector('input[name="profileName"]');
  const avatarInput = dialog.body.querySelector('input[name="profileAvatar"]');
  nameInput.value = state.data.profile.name || "";
  avatarInput.value = state.data.profile.avatar || "";

  dialog.body.querySelectorAll('[data-emoji]').forEach((button) => {
    button.addEventListener('click', () => {
      avatarInput.value = button.dataset.emoji;
    });
  });

  dialog.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(dialog.form);
    const name = formData.get('profileName').trim() || "صديقنا";
    const avatar = formData.get('profileAvatar').trim() || "🌱";
    updateProfile({ name, avatar });
    dialog.close();
  });

  dialog.open();
}

function openSectionForm(project, section = null) {
  const isEdit = Boolean(section);
  const dialog = createFormDialog({
    title: isEdit ? "تعديل القسم" : "قسم جديد",
    submitLabel: isEdit ? "حفظ التعديلات" : "إضافة القسم",
  });

  dialog.body.innerHTML = `
    <label class="form-field">
      <span>اسم القسم</span>
      <input required name="name" placeholder="مثال: تدريبات اللياقة">
    </label>
    <label class="form-field">
      <span>وصف مختصر</span>
      <textarea name="description" rows="3" placeholder="اشرح هدف هذا القسم"></textarea>
    </label>
    <div class="form-grid">
      <label class="form-field">
        <span>تاريخ البداية</span>
        <input type="date" name="startDate">
      </label>
      <label class="form-field">
        <span>تاريخ النهاية</span>
        <input type="date" name="endDate">
      </label>
    </div>
    ${
      isEdit
        ? `<div class="form-note">يمكن تعديل بنية الجدول من "إعدادات الجدول".</div>`
        : `
      <label class="form-field">
        <span>نوع الجدول</span>
        <select name="tableType">
          <option value="${TableType.STATUS}">جدول بثلاث حالات</option>
          <option value="${TableType.NOTES}">جدول ملاحظات</option>
        </select>
      </label>
      <label class="form-field">
        <span>عدد الأعمدة (الأيام)</span>
        <input type="number" name="columnCount" min="1" max="60" value="7">
      </label>
      <div class="quick-pills">
        <span class="quick-label">إعداد سريع:</span>
        <div class="pill-group">
          <button type="button" class="pill-btn" data-columns="7">أسبوع (7)</button>
          <button type="button" class="pill-btn" data-columns="14">أسبوعان (14)</button>
          <button type="button" class="pill-btn" data-columns="30">شهر (30)</button>
        </div>
      </div>
      <label class="form-field">
        <span>عناصر الجدول (سطر لكل عنصر)</span>
        <textarea name="rows" rows="4" placeholder="العنصر الأول&#10;العنصر الثاني"></textarea>
      </label>
    `
    }
  `;

  dialog.body.querySelector('input[name="name"]').value = section?.name ?? "";
  dialog.body.querySelector('textarea[name="description"]').value =
    section?.description ?? "";
  dialog.body.querySelector('input[name="startDate"]').value =
    section?.startDate ?? "";
  dialog.body.querySelector('input[name="endDate"]').value =
    section?.endDate ?? "";

  if (!isEdit) {
    const rowsField = dialog.body.querySelector('textarea[name="rows"]');
    rowsField.value = (section?.table.rows || [])
      .map((row) => row.label)
      .join("\n");
    dialog.body.querySelector('select[name="tableType"]').value =
      section?.table?.type ?? TableType.STATUS;
    const columnInput = dialog.body.querySelector('input[name="columnCount"]');
    dialog.body.querySelectorAll('.pill-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const value = Number(button.dataset.columns);
        if (Number.isFinite(value)) {
          columnInput.value = value;
        }
      });
    });
  }

  dialog.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(dialog.form);
    const name = form.get("name").trim();
    if (!name) {
      alert("يرجى إدخال اسم للقسم.");
      return;
    }

    const payload = {
      name,
      description: form.get("description").trim(),
      startDate: normalizeDate(form.get("startDate")),
      endDate: normalizeDate(form.get("endDate")),
    };

    if (isEdit) {
      updateSection(project.id, section.id, payload);
    } else {
      const columnCount = Number(form.get("columnCount")) || 1;
      const rowItems = parseLines(form.get("rows"));
      const tableType = form.get("tableType");
      const table =
        tableType === TableType.NOTES
          ? createNotesTable({ columnCount, rowItems })
          : createStatusTable({ columnCount, rowItems });
      addSection(project.id, { ...payload, table });
    }

    dialog.close();
  });

  dialog.open();
}

function openTableStructureDialog(project, section) {
  const dialog = createFormDialog({
    title: "إعدادات الجدول",
    submitLabel: "حفظ التعديلات",
  });

  dialog.body.innerHTML = `
    <label class="form-field">
      <span>أسماء الأعمدة (سطر لكل عمود)</span>
      <textarea name="columns" rows="6"></textarea>
    </label>
    <label class="form-field">
      <span>أسماء الصفوف (سطر لكل عنصر)</span>
      <textarea name="rows" rows="6"></textarea>
    </label>
  `;

  dialog.body.querySelector('textarea[name="columns"]').value = section.table.columns
    .map((column) => column.label)
    .join("\n");
  dialog.body.querySelector('textarea[name="rows"]').value = section.table.rows
    .map((row) => row.label)
    .join("\n");

  dialog.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(dialog.form);
    const columns = parseLines(form.get("columns"));
    const rows = parseLines(form.get("rows"));
    if (!columns.length || !rows.length) {
      alert("يجب توفير عمود واحد على الأقل وصف واحد على الأقل.");
      return;
    }
    updateTableStructure(project.id, section.id, {
      columnLabels: columns,
      rowLabels: rows,
    });
    dialog.close();
  });

  dialog.open();
}

function openStatusCellDialog(projectId, section, row, column, cellData) {
  const dialog = createFormDialog({
    title: `${row.label} – ${column.label}`,
    submitLabel: "حفظ الحالة",
  });
  const noteVisible = cellData.status === StatusState.PARTIAL;

  dialog.body.innerHTML = `
    <fieldset class="form-field">
      <legend>الحالة</legend>
      <div class="status-options">
        ${statusOption(StatusState.DONE, "تم الإنجاز", cellData.status)}
        ${statusOption(StatusState.MISSED, "لم يتم", cellData.status)}
        ${statusOption(StatusState.PARTIAL, "إنجاز جزئي", cellData.status)}
        ${statusOption(StatusState.NONE, "لم أحدد بعد", cellData.status)}
      </div>
    </fieldset>
    <label class="form-field" data-note-field ${noteVisible ? "" : 'hidden'}>
      <span>ملاحظة</span>
      <textarea name="note" rows="4" placeholder="اذكر سبب الإنجاز الجزئي"></textarea>
    </label>
  `;

  const noteField = dialog.body.querySelector("[data-note-field]");
  const noteTextarea = dialog.body.querySelector('textarea[name="note"]');
  if (!noteVisible) {
    noteField?.setAttribute("hidden", "");
  }
  if (noteTextarea) {
    noteTextarea.value = cellData.note ?? "";
  }

  dialog.body
    .querySelectorAll('input[name="status"]')
    .forEach((input) => {
      input.addEventListener("change", () => {
        const noteField = dialog.body.querySelector("[data-note-field]");
        if (!noteField) return;
        if (input.value === StatusState.PARTIAL) {
          noteField.removeAttribute("hidden");
        } else {
          noteField.setAttribute("hidden", "");
        }
      });
    });

  dialog.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(dialog.form);
    const status = form.get("status");
    const noteValue = status === StatusState.PARTIAL ? form.get("note").trim() : "";

    setStatusCellState(
      projectId,
      section.id,
      row.id,
      column.id,
      status,
      noteValue
    );
    dialog.close();
  });

  dialog.open();
}

function openNoteCellDialog(projectId, section, row, column, cellData) {
  const dialog = createFormDialog({
    title: `${row.label} – ${column.label}`,
    submitLabel: "حفظ الملاحظة",
  });

  dialog.body.innerHTML = `
    <label class="form-field">
      <span>الملاحظة</span>
      <textarea name="note" rows="6" placeholder="اكتب الملاحظات أو التفاصيل هنا"></textarea>
    </label>
  `;

  dialog.body.querySelector('textarea[name="note"]').value = cellData.text ?? "";

  dialog.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(dialog.form);
    const text = form.get("note").trim();
    setNoteCellText(projectId, section.id, row.id, column.id, text);
    dialog.close();
  });

  dialog.open();
}

function confirmProjectDeletion(project) {
  const message = `سيتم حذف المشروع "${project.name}" مع جميع أقسامه. لا يمكن التراجع عن هذا الإجراء.`;
  if (confirm(message)) {
    removeProject(project.id);
    setView("home");
  }
}

function confirmSectionDeletion(project, section) {
  const message = `سيتم حذف القسم "${section.name}" نهائياً. هل أنت متأكد؟`;
  if (confirm(message)) {
    removeSection(project.id, section.id);
  }
}

function handleExportData() {
  const data = exportData();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mutabaa-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  alert("تم تصدير البيانات بنجاح.");
}

async function handleImportData() {
  try {
    if (window.showOpenFilePicker) {
      const [fileHandle] = await window
        .showOpenFilePicker({
          types: [
            {
              description: "ملف بيانات متابعتي",
              accept: { "application/json": [".json"] },
            },
          ],
        })
        .catch(() => []);

      if (!fileHandle) return;

      const file = await fileHandle.getFile();
      const content = await file.text();
      importData(content);
      alert("تم الاستيراد بنجاح.");
      return;
    }

    await new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.style.display = "none";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (file) {
          const content = await file.text();
          importData(content);
          alert("تم الاستيراد بنجاح.");
        }
        input.remove();
        resolve();
      });
      document.body.appendChild(input);
      input.click();
    });
  } catch (error) {
    alert(error.message || "تعذر استيراد البيانات.");
  }
}

function handleRestoreBackup() {
  const confirmed = confirm("سيتم استعادة آخر نسخة احتياطية محفوظة. هل تريد المتابعة؟");
  if (!confirmed) {
    return;
  }
  const restored = restoreLastBackup();
  if (restored) {
    alert("تمت الاستعادة بنجاح.");
  } else {
    alert("لا توجد نسخة احتياطية محفوظة.");
  }
}

function createFormDialog({ title, submitLabel }) {
  const root = document.querySelector("#modal-root");
  const dialog = document.createElement("dialog");
  dialog.className = "app-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="dialog-form">
      <header class="dialog-header">
        <h2></h2>
        <button type="button" class="icon-btn dialog-close" aria-label="إغلاق">×</button>
      </header>
      <section class="dialog-body"></section>
      <footer class="dialog-footer">
        <button type="submit" class="primary-btn">${submitLabel}</button>
        <button type="button" class="ghost-btn dialog-cancel">إلغاء</button>
      </footer>
    </form>
  `;

  const titleEl = dialog.querySelector(".dialog-header h2");
  if (titleEl) {
    titleEl.textContent = title;
  }

  const form = dialog.querySelector("form");
  const body = dialog.querySelector(".dialog-body");
  const closeButtons = dialog.querySelectorAll(".dialog-close, .dialog-cancel");

  closeButtons.forEach((button) =>
    button.addEventListener("click", () => dialog.close())
  );
  dialog.addEventListener("close", () => dialog.remove());

  root?.appendChild(dialog);

  return {
    dialog,
    form,
    body,
    open: () => dialog.showModal(),
    close: () => dialog.close(),
  };
}

function openActionSheet({ title, actions }) {
  const root = document.querySelector("#modal-root");
  const dialog = document.createElement("dialog");
  dialog.className = "app-sheet";
  dialog.innerHTML = `
    <div class="sheet-content">
      <header>
        <h3></h3>
        <button type="button" class="icon-btn sheet-close" aria-label="إغلاق">×</button>
      </header>
      <div class="sheet-actions"></div>
    </div>
  `;

  const titleEl = dialog.querySelector("h3");
  if (titleEl) {
    titleEl.textContent = title;
  }

  const actionsContainer = dialog.querySelector(".sheet-actions");
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sheet-btn ${action.variant === "danger" ? "danger" : ""}`;
    button.textContent = action.label;
    button.addEventListener("click", () => {
      dialog.close();
      action.onClick();
    });
    actionsContainer.appendChild(button);
  });

  dialog.querySelector(".sheet-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  root?.appendChild(dialog);
  dialog.showModal();
}

function statusLabel(status) {
  switch (status) {
    case StatusState.DONE:
      return "منجز";
    case StatusState.MISSED:
      return "فاتني";
    case StatusState.PARTIAL:
      return "جزئي";
    default:
      return "—";
  }
}

function statusOption(value, label, current) {
  return `
    <label class="status-option">
      <input type="radio" name="status" value="${value}" ${current === value ? "checked" : ""}>
      <span>${label}</span>
    </label>
  `;
}

function renderEmptyState() {
  const section = document.createElement("section");
  section.className = "empty-state";
  section.setAttribute("role", "status");
  section.innerHTML = `
    <h2>لنبدأ مشروعاً جديداً</h2>
    <p>أنشئ مشروعاً لمتابعة عاداتك وتسكاتك اليومية.</p>
    <button class="primary-btn" id="new-project-btn">إضافة مشروع</button>
  `;
  section
    .querySelector("#new-project-btn")
    ?.addEventListener("click", () => openProjectForm());
  return section;
}

function setView(view, options = {}) {
  state.ui.view = view;

  if (view === "home") {
    state.ui.selectedProjectId = null;
    state.ui.selectedSectionId = null;
  } else if (view === "project") {
    state.ui.selectedProjectId = options.projectId ?? state.ui.selectedProjectId;
    state.ui.selectedSectionId = null;
  } else if (view === "section") {
    state.ui.selectedProjectId = options.projectId ?? state.ui.selectedProjectId;
    state.ui.selectedSectionId = options.sectionId ?? state.ui.selectedSectionId;
  }

  render();
}

function handleBackNavigation() {
  if (state.ui.view === "section" && state.ui.selectedProjectId) {
    setView("project", { projectId: state.ui.selectedProjectId });
    return;
  }
  setView("home");
}

function getSelectedProject() {
  return state.data.projects.find(
    (project) => project.id === state.ui.selectedProjectId
  );
}

function getSelectedSection() {
  const project = getSelectedProject();
  if (!project || !state.ui.selectedSectionId) {
    return null;
  }
  return project.sections.find((section) => section.id === state.ui.selectedSectionId) ?? null;
}

function formatRangeText(start, end) {
  if (!start && !end) {
    return "";
  }
  if (start && end) {
    return `${formatDate.format(new Date(start))} ← ${formatDate.format(new Date(end))}`;
  }
  if (start) {
    return `يبدأ ${formatDate.format(new Date(start))}`;
  }
  return `حتى ${formatDate.format(new Date(end))}`;
}

function formatRelative(dateString) {
  if (!dateString) return "غير محدد";
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "اليوم";
  if (days === 1) return "منذ يوم";
  if (days < 7) return `منذ ${days} أيام`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "منذ أسبوع";
  if (weeks < 5) return `منذ ${weeks} أسابيع`;
  return formatDate.format(date);
}

function normalizeDate(value) {
  return value ? value : null;
}

function parseLines(value) {
  return (value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function truncate(text, length) {
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((error) => console.error("فشل تسجيل Service Worker:", error));
  }
}
