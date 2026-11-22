const STATUS_ORDER = [
  "Prepared",
  "Submitting",
  "Submitted",
  "Email draft for owner",
  "Blocked – owner to apply",
  "Posting removed",
  "Interview",
  "Rejected",
  "Offer"
];

const state = {
  items: [],
  updated: "",
  view: localStorage.getItem("tracker-view") || "cards"
};

const els = {
  total: document.getElementById("count-total"),
  submitted: document.getElementById("count-submitted"),
  waiting: document.getElementById("count-waiting"),
  updated: document.getElementById("updated"),
  search: document.getElementById("search"),
  status: document.getElementById("filter-status"),
  country: document.getElementById("filter-country"),
  role: document.getElementById("filter-role"),
  sort: document.getElementById("sort"),
  results: document.getElementById("results"),
  meta: document.getElementById("result-meta"),
  viewCards: document.getElementById("view-cards"),
  viewTable: document.getElementById("view-table"),
  lightbox: document.getElementById("lightbox"),
  lightboxImage: document.getElementById("lightbox-image"),
  lightboxClose: document.getElementById("lightbox-close")
};

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function statusClass(status) {
  return "status-" + String(status || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function populateFilters(items) {
  const statuses = unique([...STATUS_ORDER, ...items.map((item) => item.status)])
    .filter((status) => items.some((item) => item.status === status) || STATUS_ORDER.includes(status));
  const present = unique(items.map((item) => item.status));
  const options = STATUS_ORDER.filter((status) => present.includes(status))
    .concat(present.filter((status) => !STATUS_ORDER.includes(status)));

  els.status.innerHTML = '<option value="">All statuses</option>' +
    options.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");

  const roleTypes = unique(items.map((item) => item.roleType)).sort();
  els.role.innerHTML = '<option value="">All role types</option>' +
    roleTypes.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("");
}

function currentFilters() {
  return {
    query: els.search.value.trim().toLowerCase(),
    status: els.status.value,
    country: els.country.value,
    roleType: els.role.value,
    sort: els.sort.value
  };
}

function matches(item, filters) {
  if (filters.status && item.status !== filters.status) return false;
  if (filters.country && item.country !== filters.country) return false;
  if (filters.roleType && item.roleType !== filters.roleType) return false;
  if (filters.query) {
    const haystack = [
      item.company, item.role, item.location, item.country, item.pay,
      item.appliedVia, item.status, item.notes, item.roleType
    ].join(" ").toLowerCase();
    if (!haystack.includes(filters.query)) return false;
  }
  return true;
}

function sortItems(items, sort) {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "date-asc") return (a.date || "").localeCompare(b.date || "") || a.company.localeCompare(b.company);
    if (sort === "company") return a.company.localeCompare(b.company) || (b.date || "").localeCompare(a.date || "");
    if (sort === "status") {
      const ai = STATUS_ORDER.indexOf(a.status);
      const bi = STATUS_ORDER.indexOf(b.status);
      const av = ai === -1 ? 99 : ai;
      const bv = bi === -1 ? 99 : bi;
      return av - bv || (b.date || "").localeCompare(a.date || "");
    }
    return (b.date || "").localeCompare(a.date || "") || a.company.localeCompare(b.company);
  });
  return copy;
}

function linkButtons(item) {
  const parts = [];
  if (item.jobUrl) {
    parts.push(`<a href="${escapeHtml(item.jobUrl)}" target="_blank" rel="noopener noreferrer">Posting</a>`);
  }
  if (item.resume) {
    parts.push(`<a href="${escapeHtml(item.resume)}" target="_blank" rel="noopener noreferrer">Resume</a>`);
  }
  if (item.screenshot) {
    parts.push(`<button type="button" data-screenshot="${escapeHtml(item.screenshot)}" data-label="${escapeHtml(item.company + " confirmation")}">Confirmation</button>`);
  }
  return parts.length ? `<div class="links">${parts.join("")}</div>` : "";
}

function renderCards(items) {
  return items.map((item) => `
    <article class="card">
      <div class="card-top">
        <span class="pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
        <span class="date">${escapeHtml(formatDate(item.date))}</span>
      </div>
      <h2 class="company">${escapeHtml(item.company)}</h2>
      <p class="role">${escapeHtml(item.role)}</p>
      <p class="meta">${escapeHtml([item.location, item.pay, item.appliedVia].filter(Boolean).join(" · "))}</p>
      ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ""}
      ${linkButtons(item)}
    </article>
  `).join("");
}

function renderTable(items) {
  const rows = items.map((item) => `
    <tr>
      <td><span class="pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
      <td>
        <div class="td-role">${escapeHtml(item.role)}</div>
        <div class="td-company">${escapeHtml(item.company)}</div>
      </td>
      <td>${escapeHtml(item.location || "")}</td>
      <td>${escapeHtml(item.pay || "")}</td>
      <td>${escapeHtml(item.appliedVia || "")}</td>
      <td>${escapeHtml(formatDate(item.date))}</td>
      <td>${linkButtons(item)}</td>
    </tr>
  `).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Role</th>
            <th>Location</th>
            <th>Pay</th>
            <th>Applied via</th>
            <th>Date</th>
            <th>Links</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function updateSummary(items) {
  els.total.textContent = String(items.length);
  els.submitted.textContent = String(items.filter((item) => item.status === "Submitted").length);
  els.waiting.textContent = String(items.filter((item) => item.status === "Email draft for owner" || item.status === "Blocked – owner to apply").length);
}

function setView(view) {
  state.view = view;
  localStorage.setItem("tracker-view", view);
  els.results.classList.toggle("view-cards", view === "cards");
  els.viewCards.classList.toggle("is-active", view === "cards");
  els.viewTable.classList.toggle("is-active", view === "table");
  els.viewCards.setAttribute("aria-pressed", String(view === "cards"));
  els.viewTable.setAttribute("aria-pressed", String(view === "table"));
  render();
}

function render() {
  const filters = currentFilters();
  const filtered = sortItems(state.items.filter((item) => matches(item, filters)), filters.sort);
  const showing = filtered.length;
  const total = state.items.length;
  els.meta.textContent = showing === total
    ? `${total} role${total === 1 ? "" : "s"}`
    : `Showing ${showing} of ${total}`;

  if (!filtered.length) {
    els.results.innerHTML = `<div class="empty">No applications match those filters.</div>`;
    return;
  }
  els.results.innerHTML = state.view === "table" ? renderTable(filtered) : renderCards(filtered);
}

function openLightbox(src, label) {
  els.lightboxImage.src = src;
  els.lightboxImage.alt = label || "Confirmation screenshot";
  els.lightbox.hidden = false;
  els.lightboxClose.focus();
}

function closeLightbox() {
  els.lightbox.hidden = true;
  els.lightboxImage.src = "";
}

els.results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-screenshot]");
  if (!button) return;
  openLightbox(button.getAttribute("data-screenshot"), button.getAttribute("data-label"));
});

els.lightboxClose.addEventListener("click", closeLightbox);
els.lightbox.addEventListener("click", (event) => {
  if (event.target === els.lightbox) closeLightbox();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.lightbox.hidden) closeLightbox();
});

["input", "change"].forEach((type) => {
  els.search.addEventListener(type, render);
  els.status.addEventListener(type, render);
  els.country.addEventListener(type, render);
  els.role.addEventListener(type, render);
  els.sort.addEventListener(type, render);
});

els.viewCards.addEventListener("click", () => setView("cards"));
els.viewTable.addEventListener("click", () => setView("table"));

fetch("data/applications.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("Could not load applications.");
    return response.json();
  })
  .then((data) => {
    state.items = data.applications || [];
    state.updated = data.updated || "";
    if (state.updated) {
      els.updated.hidden = false;
      els.updated.textContent = "Updated " + formatDate(state.updated);
    }
    populateFilters(state.items);
    updateSummary(state.items);
    setView(state.view);
  })
  .catch((error) => {
    els.results.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  });
