/**
 * script.js
 * Swan Solution — Hotel Management System
 * One shared file for both pages:
 *   - storage helpers (getItems/setItems/addItem/removeItem)
 *   - CustomerFormHandler  -> runs on index.html (body.page-register)
 *   - SubmissionViewer     -> runs on view.html   (body.page-view)
 * The correct class is instantiated automatically based on the
 * page's <body> class, so this one file can be shared everywhere.
 */

/* ============================================================
   Storage helpers (localStorage wrapper)
   ============================================================ */
const STORAGE_KEY = "swan_hotel_guests";

function getItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("script.js: failed to read guests", err);
    return [];
  }
}

function setItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (err) {
    console.error("script.js: failed to write guests", err);
    return false;
  }
}

function addItem(item) {
  const items = getItems();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    ...item,
  };
  items.push(record);
  setItems(items);
  return record;
}

function removeItem(id) {
  const items = getItems().filter((item) => item.id !== id);
  setItems(items);
  return items;
}

/* ============================================================
   CustomerFormHandler  (index.html)
   ============================================================ */
class CustomerFormHandler {
  constructor(formEl, messageEl) {
    this.form = formEl;
    this.messageEl = messageEl;

    this.validators = {
      fullName: (v) => v.trim().length >= 3,
      phone: (v) => /^\d{10}$/.test(v.trim()),
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      address: (v) => v.trim().length > 0,
      aadhar: (v) => /^\d{12}$/.test(v.trim()),
      checkIn: (v) => this.isFutureDate(v),
      checkOut: (v) => this.isValidCheckout(v),
      adults: (v) => Number.isFinite(Number(v)) && Number(v) >= 1 && v.trim() !== "",
      purpose: (v) => v.trim().length > 0,
    };

    this.bindEvents();
  }

  isFutureDate(value) {
    if (!value) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(value);
    return date > today;
  }

  isValidCheckout(value) {
    if (!value) return false;
    const checkInVal = this.form.elements["checkIn"].value;
    if (!checkInVal) return false;
    const checkIn = new Date(checkInVal);
    const checkOut = new Date(value);
    return checkOut > checkIn;
  }

  /** Event delegation: one listener per event type on the form itself. */
  bindEvents() {
    this.form.addEventListener("input", (e) => {
      if (e.target.matches("input, textarea")) this.validateField(e.target);
    });

    this.form.addEventListener(
      "blur",
      (e) => {
        if (e.target.matches("input, textarea")) this.validateField(e.target);
      },
      true // capture, since blur does not bubble
    );

    this.form.addEventListener("change", (e) => {
      if (e.target.id === "checkIn") {
        const checkOutEl = this.form.elements["checkOut"];
        if (checkOutEl.value) this.validateField(checkOutEl);
      }
    });

    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    this.form.addEventListener("reset", () => this.clearForm(true));
  }

  validateField(field) {
    const rule = this.validators[field.name];
    if (!rule) return true;
    const ok = rule(field.value);
    field.classList.toggle("is-invalid", !ok);
    field.classList.toggle("is-valid", ok);
    return ok;
  }

  validateForm() {
    let allValid = true;
    Object.keys(this.validators).forEach((name) => {
      const field = this.form.elements[name];
      const ok = this.validateField(field);
      if (!ok) allValid = false;
    });
    return allValid;
  }

  saveToLocalStorage() {
    const data = new FormData(this.form);
    const record = {
      fullName: data.get("fullName").trim(),
      phone: data.get("phone").trim(),
      email: data.get("email").trim(),
      address: data.get("address").trim(),
      aadhar: data.get("aadhar").trim(),
      checkIn: data.get("checkIn"),
      checkOut: data.get("checkOut"),
      adults: Number(data.get("adults")),
      purpose: data.get("purpose").trim(),
    };
    return addItem(record);
  }

  clearForm(skipNativeReset) {
    if (!skipNativeReset) this.form.reset();
    [...this.form.elements].forEach((el) => {
      el.classList.remove("is-invalid", "is-valid");
    });
  }

  showMessage(text, type = "success") {
    this.messageEl.textContent = text;
    this.messageEl.classList.remove("alert-success", "alert-danger");
    this.messageEl.classList.add(type === "success" ? "alert-success" : "alert-danger", "show");
    window.clearTimeout(this._msgTimer);
    this._msgTimer = window.setTimeout(() => {
      this.messageEl.classList.remove("show");
    }, 4000);
  }

  handleSubmit(e) {
    e.preventDefault();
    if (!this.validateForm()) {
      this.showMessage("Please correct the highlighted fields before submitting.", "error");
      return;
    }
    this.saveToLocalStorage();
    this.showMessage("Guest registered successfully and saved.", "success");
    this.clearForm();
  }
}

/* ============================================================
   SubmissionViewer  (view.html)
   ============================================================ */
class SubmissionViewer {
  constructor({ tableBody, emptyState, searchInput, clearBtn, countBadge, messageEl }) {
    this.tableBody = tableBody;
    this.emptyState = emptyState;
    this.searchInput = searchInput;
    this.clearBtn = clearBtn;
    this.countBadge = countBadge;
    this.messageEl = messageEl;

    this.records = [];
    this.bindEvents();
    this.loadRecords();
  }

  loadRecords() {
    this.records = getItems();
    this.render(this.records);
  }

  bindEvents() {
    this.searchInput.addEventListener("input", () => this.applyFilter());
    this.clearBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.applyFilter();
    });

    // Event delegation for delete buttons in the table body
    this.tableBody.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-delete");
      if (!btn) return;
      this.deleteRecord(btn.dataset.id);
    });
  }

  applyFilter() {
    const term = this.searchInput.value.trim().toLowerCase();
    if (!term) {
      this.render(this.records);
      return;
    }
    const filtered = this.records.filter((r) => {
      const name = (r.fullName || "").toLowerCase();
      const checkIn = (r.checkIn || "").toLowerCase();
      const checkOut = (r.checkOut || "").toLowerCase();
      return name.includes(term) || checkIn.includes(term) || checkOut.includes(term);
    });
    this.render(filtered);
  }

  deleteRecord(id) {
    if (!id) return;
    this.records = removeItem(id);
    this.applyFilter();
    this.showMessage("Record deleted.", "success");
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  render(list) {
    this.countBadge.textContent = `${this.records.length} record${this.records.length === 1 ? "" : "s"}`;

    if (!list.length) {
      this.tableBody.innerHTML = "";
      this.emptyState.hidden = false;
      return;
    }
    this.emptyState.hidden = true;

    this.tableBody.innerHTML = list
      .slice()
      .reverse()
      .map(
        (r) => `
        <tr>
          <td>${this.escapeHtml(r.fullName)}</td>
          <td>${this.escapeHtml(r.phone)}</td>
          <td>${this.escapeHtml(r.email)}</td>
          <td>${this.escapeHtml(r.aadhar)}</td>
          <td>${this.escapeHtml(r.checkIn)}</td>
          <td>${this.escapeHtml(r.checkOut)}</td>
          <td>${this.escapeHtml(r.adults)}</td>
          <td>${this.escapeHtml(r.purpose)}</td>
          <td class="text-end">
            <button class="btn btn-delete btn-sm" data-id="${r.id}">
              <i class="bi bi-trash3 me-1"></i>Delete
            </button>
          </td>
        </tr>
      `
      )
      .join("");
  }

  showMessage(text, type = "success") {
    this.messageEl.textContent = text;
    this.messageEl.classList.remove("alert-success", "alert-danger");
    this.messageEl.classList.add(type === "success" ? "alert-success" : "alert-danger", "show");
    window.clearTimeout(this._msgTimer);
    this._msgTimer = window.setTimeout(() => {
      this.messageEl.classList.remove("show");
    }, 3000);
  }
}

/* ============================================================
   Page bootstrapper — picks the right class for the current page
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("page-register")) {
    const form = document.getElementById("guestForm");
    const messageEl = document.getElementById("formMessage");
    if (form) new CustomerFormHandler(form, messageEl);
  }

  if (document.body.classList.contains("page-view")) {
    const tableBody = document.getElementById("submissionsBody");
    if (tableBody) {
      new SubmissionViewer({
        tableBody,
        emptyState: document.getElementById("emptyState"),
        searchInput: document.getElementById("searchInput"),
        clearBtn: document.getElementById("clearSearchBtn"),
        countBadge: document.getElementById("recordCount"),
        messageEl: document.getElementById("viewMessage"),
      });
    }
  }
});
