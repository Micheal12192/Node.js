// public/js/panel_lekarz.js
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  initDashboardOnce();
  initEditProfile();
  initContact();
  initChatsOnce();
});

// ===============================================
// POMOCNICZE
// ===============================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================================
// NAWIGACJA
// ===============================================
function setupNavigation() {
  const navMap = {
    "btn-dashboard": "section-dashboard",
    "btn-edit-profile": "section-edit",
    "btn-contact": "section-contact",
    "btn-chats": "section-chats"
  };

  Object.entries(navMap).forEach(([btnId, sectionId]) => {
    const btn = document.getElementById(btnId);
    const section = document.getElementById(sectionId);
    if (!btn || !section) return;

    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".panel-nav .btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      Object.values(navMap).forEach((id) => {
        const sec = document.getElementById(id);
        if (sec) sec.classList.add("d-none");
      });
      section.classList.remove("d-none");

      if (sectionId === "section-dashboard") {
        initDashboardOnce();
      } else if (sectionId === "section-chats") {
        initChatsOnce();
      }
    });
  });
}

// ===============================================
// DASHBOARD – WIZYTY
// ===============================================
let dashboardInitialized = false;
let upcomingVisits = [];
let pastVisits = [];
let currentDashboardMode = "upcoming"; // 'upcoming' | 'past' | 'notifications'
let visitsFiltered = [];
let visitsCurrentPage = 1;
const VISITS_PER_PAGE = 5;
let currentRangePreset = "all"; // 'all' | 'today' | 'tomorrow' | 'week' | 'custom'
let customFrom = null;
let customTo = null;
let searchQuery = "";
let missingFilter = "all"; // filtr braków w dokumentacji


function updateRangeButtonsLabels() {
  const rangeButtons = document.querySelectorAll(".visits-range-btn");
  rangeButtons.forEach((btn) => {
    const preset = btn.getAttribute("data-range-preset");

    if (preset === "all") {
      btn.textContent = "Wszystko";
    } else if (preset === "today") {
      btn.textContent = "Dzisiaj";
    } else if (preset === "tomorrow") {
      btn.textContent = currentDashboardMode === "past" ? "Wczoraj" : "Jutro";
    } else if (preset === "week") {
      btn.textContent =
        currentDashboardMode === "past" ? "Ostatni tydzień" : "Najbliższy tydzień";
    }
  });
}


function initDashboardOnce() {
  if (dashboardInitialized) return;
  dashboardInitialized = true;
  initDashboard();
}

async function initDashboard() {
  const statUpcoming = document.getElementById("stat-najblizsze");
  const statPast = document.getElementById("stat-odbyte");
  const statNotif = document.getElementById("stat-powiadomienia");
  const visitsControls = document.getElementById("visits-controls");

  try {
    const [upRes, pastRes] = await Promise.all([
      fetch("/api/lekarz/najblizsze"),
      fetch("/api/lekarz/odbyte")
    ]);

    upcomingVisits = upRes.ok ? await upRes.json() : [];
    pastVisits = pastRes.ok ? await pastRes.json() : [];

    if (statUpcoming) statUpcoming.textContent = upcomingVisits.length;
    if (statPast) statPast.textContent = pastVisits.length;
    if (statNotif) statNotif.textContent = "0";

    if ((upcomingVisits.length || pastVisits.length) && visitsControls) {
      visitsControls.classList.remove("d-none");
    }

    const cardUpcoming = statUpcoming ? statUpcoming.closest(".stat-card") : null;
    const cardPast = statPast ? statPast.closest(".stat-card") : null;
    const cardNotif = statNotif ? statNotif.closest(".stat-card") : null;

    if (cardUpcoming) {
      cardUpcoming.style.cursor = "pointer";
      cardUpcoming.addEventListener("click", () => {
        currentDashboardMode = "upcoming";
        visitsCurrentPage = 1;
        updateVisitsView();
      });
    }

    if (cardPast) {
      cardPast.style.cursor = "pointer";
      cardPast.addEventListener("click", () => {
        currentDashboardMode = "past";
        visitsCurrentPage = 1;
        updateVisitsView();
      });
    }

    if (cardNotif) {
      cardNotif.style.cursor = "pointer";
      cardNotif.addEventListener("click", () => {
        currentDashboardMode = "notifications";
        visitsCurrentPage = 1;
        renderNotificationsPlaceholder();
      });
    }

    initVisitFilters();
    updateVisitsView();
  } catch (err) {
    console.error("Błąd inicjalizacji dashboardu lekarza:", err);
  }
}

function initVisitFilters() {
  const rangeButtons = document.querySelectorAll(".visits-range-btn");
  const inputFrom = document.getElementById("filter-from-date");
  const inputTo = document.getElementById("filter-to-date");
  const btnApplyCustom = document.getElementById("filter-apply-custom");
  const btnReset = document.getElementById("filter-reset");
  const searchInput = document.getElementById("search-input");
  const missingFilterSelect = document.getElementById("missing-filter");

  rangeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      rangeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentRangePreset = btn.getAttribute("data-range-preset") || "all";
      visitsCurrentPage = 1;
      updateVisitsView();
    });
  });

  if (btnApplyCustom && inputFrom && inputTo) {
    btnApplyCustom.addEventListener("click", () => {
      customFrom = inputFrom.value || null;
      customTo = inputTo.value || null;
      currentRangePreset = "custom";
      rangeButtons.forEach((b) => b.classList.remove("active"));
      visitsCurrentPage = 1;
      updateVisitsView();
    });
  }

  if (btnReset && inputFrom && inputTo) {
    btnReset.addEventListener("click", () => {
      inputFrom.value = "";
      inputTo.value = "";
      customFrom = null;
      customTo = null;
      currentRangePreset = "all";

      rangeButtons.forEach((b) => {
        const preset = b.getAttribute("data-range-preset");
        if (preset === "all") b.classList.add("active");
        else b.classList.remove("active");
      });

      searchQuery = "";
      if (searchInput) searchInput.value = "";

      missingFilter = "all";
      if (missingFilterSelect) missingFilterSelect.value = "all";

      visitsCurrentPage = 1;
      updateVisitsView();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim();
      visitsCurrentPage = 1;
      updateVisitsView();
    });
  }

  if (missingFilterSelect) {
    missingFilterSelect.addEventListener("change", () => {
      missingFilter = missingFilterSelect.value || "all";
      visitsCurrentPage = 1;
      updateVisitsView();
    });
  }

  updateRangeButtonsLabels();
  updateMissingFilterVisibility();
}



function updateVisitsView() {
  const container = document.getElementById("dashboard-details");
  const pagContainer = document.getElementById("pagination-container");
  const controls = document.getElementById("visits-controls");
  if (!container) return;

  updateRangeButtonsLabels();
  updateMissingFilterVisibility();

  if (currentDashboardMode === "notifications") {
    if (controls) controls.classList.add("d-none");
    renderNotificationsPlaceholder();
    if (pagContainer) {
      pagContainer.classList.add("d-none");
      pagContainer.innerHTML = "";
    }
    return;
  }

  if (controls) controls.classList.remove("d-none");

  const base = currentDashboardMode === "upcoming" ? upcomingVisits : pastVisits;
  visitsFiltered = base.filter(
    (v) =>
      matchVisitDateRange(v) &&
      matchVisitSearch(v) &&
      matchVisitMissingFilter(v)
  );

  const totalPages = Math.max(1, Math.ceil(visitsFiltered.length / VISITS_PER_PAGE));
  if (visitsCurrentPage > totalPages) visitsCurrentPage = totalPages;

  const start = (visitsCurrentPage - 1) * VISITS_PER_PAGE;
  const pageItems = visitsFiltered.slice(start, start + VISITS_PER_PAGE);

  renderVisits(pageItems);
  renderVisitsPagination(totalPages);
}

function matchVisitMissingFilter(visit) {
  if (currentDashboardMode !== "past") return true;
  if (missingFilter === "all") return true;

  const hasNotes = !!(visit.notatki && String(visit.notatki).trim());
  const hasRecepty = Array.isArray(visit.recepty) && visit.recepty.length > 0;
  const hasSkierowania =
    Array.isArray(visit.skierowania) && visit.skierowania.length > 0;

  switch (missingFilter) {
    case "any-missing":
      return !hasNotes || !hasRecepty || !hasSkierowania;
    case "no-notes":
      return !hasNotes;
    case "no-recepty":
      return !hasRecepty;
    case "no-skierowania":
      return !hasSkierowania;
    case "complete":
      return hasNotes && hasRecepty && hasSkierowania;
    default:
      return true;
  }
}

function updateMissingFilterVisibility() {
  const wrapper = document.getElementById("missing-docs-wrapper");
  const select = document.getElementById("missing-filter");
  if (!wrapper || !select) return;

  if (currentDashboardMode === "past") {
    wrapper.classList.remove("opacity-50");
    select.disabled = false;
  } else {
    missingFilter = "all";
    select.value = "all";
    wrapper.classList.add("opacity-50");
    select.disabled = true;
  }
}

function matchVisitDateRange(visit) {
  if (currentRangePreset === "all") return true;

  if (!visit || !visit.data_godzina) return true;

  const rawDate = new Date(visit.data_godzina);
  if (Number.isNaN(rawDate.getTime())) return true;

  // data wizyty bez godzin
  const visitDate = new Date(
    rawDate.getFullYear(),
    rawDate.getMonth(),
    rawDate.getDate()
  );

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  if (currentRangePreset === "today") {
    return visitDate.getTime() === today.getTime();
  }

  if (currentRangePreset === "tomorrow") {
    const target = new Date(today);
    // w trybie odbytych: wczoraj
    if (currentDashboardMode === "past") {
      target.setDate(target.getDate() - 1);
    } else {
      // w trybie przyszłych: jutro
      target.setDate(target.getDate() + 1);
    }
    return visitDate.getTime() === target.getTime();
  }

  if (currentRangePreset === "week") {
    if (currentDashboardMode === "past") {
      // ostatni tydzień do dzisiaj włącznie
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return visitDate >= from && visitDate <= today;
    } else {
      // najbliższy tydzień od dzisiaj włącznie
      const to = new Date(today);
      to.setDate(to.getDate() + 7);
      return visitDate >= today && visitDate <= to;
    }
  }

  if (currentRangePreset === "custom") {
    if (!customFrom && !customTo) return true;

    let fromDate = null;
    let toDate = null;

    if (customFrom) {
      const fromRaw = new Date(customFrom);
      fromDate = new Date(
        fromRaw.getFullYear(),
        fromRaw.getMonth(),
        fromRaw.getDate()
      );
    }

    if (customTo) {
      const toRaw = new Date(customTo);
      toDate = new Date(
        toRaw.getFullYear(),
        toRaw.getMonth(),
        toRaw.getDate()
      );
    }

    if (fromDate && visitDate < fromDate) return false;
    if (toDate && visitDate > toDate) return false;
    return true;
  }

  return true;
}


function matchVisitSearch(visit) {
  if (!searchQuery) return true;

  const qWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  if (!qWords.length) return true;

  const d = new Date(visit.data_godzina);
  let dateFull = "";
  let dateShort = "";
  let timeStr = "";

  if (!Number.isNaN(d.getTime())) {
    dateFull = d.toLocaleDateString("pl-PL");
    const parts = dateFull.split(".");
    if (parts.length >= 2) {
      dateShort = parts[0] + "." + parts[1] + ".";
    }
    timeStr = d.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const haystack = [
    visit.imie_pacjenta || "",
    visit.nazwisko_pacjenta || "",
    (visit.imie_pacjenta || "") + " " + (visit.nazwisko_pacjenta || ""),
    visit.telefon || "",
    visit.pesel || "",
    visit.specjalizacja || "",
    dateFull,
    dateShort,
    timeStr
  ]
    .join(" ")
    .toLowerCase();

  return qWords.every((w) => haystack.includes(w));
}

function renderVisits(list) {
  const container = document.getElementById("dashboard-details");
  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {
    const p = document.createElement("p");
    p.className = "text-muted text-center my-3";
    p.textContent = "Brak wizyt do wyświetlenia.";
    container.appendChild(p);
    return;
  }

  list.forEach((v) => {
    const d = v.data_godzina ? new Date(v.data_godzina) : null;
    const dateStr = d
      ? d.toLocaleDateString("pl-PL", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        })
      : "—";
    const timeStr = d
      ? d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
      : "";

    const card = document.createElement("div");
    card.className = "card mb-3 shadow-sm";

    let statusLabel = "";
    let badgeClass = "bg-secondary";
    const status = (v.status || "").toLowerCase();

    if (currentDashboardMode === "past") {
      statusLabel = "Odbyta";
      badgeClass = "bg-success";
    } else {
      if (status === "zaplanowana") {
        statusLabel = "Zaplanowana";
        badgeClass = "bg-primary";
      } else if (status === "odbyta") {
        statusLabel = "Odbyta";
        badgeClass = "bg-success";
      } else if (status === "anulowana") {
        statusLabel = "Anulowana";
        badgeClass = "bg-danger";
      }
    }

    // Twoja oryginalna część (zostawiona bez zmian)
    let baseHtml = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <p class="mb-0"><strong>Pacjent:</strong> ${escapeHtml(v.imie_pacjenta || "")} ${escapeHtml(v.nazwisko_pacjenta || "")}</p>
          ${statusLabel ? `<span class="badge ${badgeClass} ms-2">${statusLabel}</span>` : ""}
        </div>
        <p class="mb-1"><strong>Data:</strong> ${dateStr} ${timeStr ? " " + timeStr : ""}</p>
        <p class="mb-1"><strong>Specjalizacja:</strong> ${escapeHtml(v.specjalizacja || "—")}</p>
        <p class="mb-1"><strong>Telefon:</strong> ${escapeHtml(v.telefon || "—")}</p>
        <p class="mb-1"><strong>PESEL:</strong> ${escapeHtml(v.pesel || "—")}</p>`;

    // TYLKO W ODBYTYCH – DODAJEMY NOWE BLOKI
    if (currentDashboardMode === "past") {
      baseHtml += `
        <div class="row g-3 mt-3">
          <!-- NOTATKI -->
          <div class="col-md-4">
            <div class="border rounded p-3 bg-light h-100 position-relative">
              <strong class="text-primary">Notatki / Zalecenia</strong>
              <div class="mt-2 small">
                ${v.notatki ? escapeHtml(v.notatki).replace(/\n/g, '<br>') : '<span class="text-muted">Brak</span>'}
              </div>
              <button class="btn btn-sm btn-outline-primary position-absolute top-0 end-0 m-2 manage-btn"
                      data-type="notatki" data-wizyta-id="${v.id}" title="Edytuj notatki">
                <i class="bi bi-pencil-square"></i>
              </button>
            </div>
          </div>

          <!-- RECEPTY -->
          <div class="col-md-4">
            <div class="border rounded p-3 bg-light h-100 position-relative">
              <strong class="text-success">Recepty</strong>
              <div class="mt-2 small">
                ${v.recepty && v.recepty.length > 0
                  ? v.recepty.map(r => `<div>• ${escapeHtml(r.lek)}${r.dawkowanie ? ` – ${escapeHtml(r.dawkowanie)}` : ""}${r.ilosc_dni ? ` (${r.ilosc_dni} dni)` : ""}</div>`).join("")
                  : '<span class="text-muted">Brak</span>'
                }
              </div>
              <button class="btn btn-sm btn-outline-success position-absolute top-0 end-0 m-2 manage-btn"
                      data-type="recepty" data-wizyta-id="${v.id}" title="Zarządzaj receptami">
                <i class="bi bi-prescription2"></i>
              </button>
            </div>
          </div>

          <!-- SKIEROWANIA -->
          <div class="col-md-4">
            <div class="border rounded p-3 bg-light h-100 position-relative">
              <strong class="text-info">Skierowania</strong>
              <div class="mt-2 small">
                ${v.skierowania && v.skierowania.length > 0
                  ? v.skierowania.map(s => `<div>• Do: <strong>${escapeHtml(s.do_specjalizacji)}</strong>${s.powod ? ` – ${escapeHtml(s.powod)}` : ""}</div>`).join("")
                  : '<span class="text-muted">Brak</span>'
                }
              </div>
              <button class="btn btn-sm btn-outline-info position-absolute top-0 end-0 m-2 manage-btn"
                      data-type="skierowania" data-wizyta-id="${v.id}" title="Zarządzaj skierowaniami">
                <i class="bi bi-file-earmark-medical"></i>
              </button>
            </div>
          </div>
        </div>`;
    }

    baseHtml += `</div>`;
    card.innerHTML = baseHtml;
    container.appendChild(card);
  });

  // Delegacja przycisków tylko w odbytych wizytach
  if (currentDashboardMode === "past") {
    document.querySelectorAll(".manage-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const wizytaId = btn.dataset.wizytaId;
        const visitData = list.find(v => v.id == wizytaId);
        openManageModal(type, wizytaId, visitData);
      });
    });
  }
}



function renderVisitsPagination(totalPages) {
  const pagContainer = document.getElementById("pagination-container");
  if (!pagContainer) return;

  if (totalPages <= 1) {
    pagContainer.classList.add("d-none");
    pagContainer.innerHTML = "";
    return;
  }

  pagContainer.classList.remove("d-none");

  let html =
    '<nav aria-label="Stronicowanie wizyt">' +
    '<ul class="pagination justify-content-center mb-0">';

  for (let i = 1; i <= totalPages; i++) {
    html +=
      '<li class="page-item ' +
      (i === visitsCurrentPage ? "active" : "") +
      '">' +
      '<button class="page-link" type="button" data-page="' +
      i +
      '">' +
      i +
      "</button></li>";
  }

  html += "</ul></nav>";
  pagContainer.innerHTML = html;

  pagContainer.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.getAttribute("data-page") || "1", 10);
      visitsCurrentPage = p;
      updateVisitsView();
    });
  });
}

function renderNotificationsPlaceholder() {
  const container = document.getElementById("dashboard-details");
  if (!container) return;

  container.innerHTML =
    '<p class="text-muted text-center my-3">Obsługa powiadomień w panelu lekarza będzie dostępna w kolejnej wersji.</p>';
}

// ===============================================
// EDYCJA PROFILU LEKARZA
// ===============================================
function initEditProfile() {
  const form = document.getElementById("form-lekarz-profil");
  const msg = document.getElementById("profil-result");
  if (!form || !msg) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "mt-3 fw-semibold";

    const formData = new FormData(form);
    const avatarFile = formData.get("avatar");
    const newPassword = formData.get("newPassword");

    // Walidacja hasła
    if (newPassword && newPassword.length < 8) {
      msg.textContent = "Nowe hasło musi mieć minimum 8 znaków.";
      msg.className = "text-danger";
      return;
    }

    // Walidacja pliku
    if (avatarFile && avatarFile.size > 0) {
      if (avatarFile.size > 2 * 1024 * 1024) {
        msg.textContent = "Plik za duży (maks. 2MB).";
        msg.className = "text-danger";
        return;
      }
      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(avatarFile.type)) {
        msg.textContent = "Nieprawidłowy format (tylko PNG, JPG, WEBP).";
        msg.className = "text-danger";
        return;
      }
    }

    try {
      const res = await fetch("/api/lekarz/profil", {
        method: "POST",
        body: formData
      });
      const result = await res.json();

      msg.textContent = result.message;
      msg.className = result.success ? "text-success" : "text-danger";

      if (result.success && result.avatar) {
        const avatarImg = document.getElementById("current-avatar");
        if (avatarImg) {
          avatarImg.src = `/images/avatar/${result.avatar}?t=${Date.now()}`;
        }
      }

      if (result.success) {
        form.reset();
      }
    } catch (err) {
      console.error("Błąd zapisu profilu lekarza:", err);
      msg.textContent = "Błąd połączenia z serwerem.";
      msg.className = "text-danger";
    }
  });
}


// ===============================================
// KONTAKT
// ===============================================
function initContact() {
  const form = document.getElementById("form-contact");
  if (!form) return;

  const recipientSelect = document.getElementById("contact-recipient");
  const patientContainer = document.getElementById("patient-select-container");
  const patientSelect = document.getElementById("contact-patient");
  const subjectInput = document.getElementById("contact-subject");
  const messageInput = document.getElementById("contact-message");
  const result = document.getElementById("contact-result");

  if (recipientSelect && patientContainer) {
    recipientSelect.addEventListener("change", async () => {
      const val = recipientSelect.value;
      if (val === "pacjent") {
        patientContainer.classList.remove("d-none");
        if (patientSelect && patientSelect.options.length <= 1) {
          await loadPatientsForContact(patientSelect);
        }
      } else {
        patientContainer.classList.add("d-none");
        if (patientSelect) patientSelect.value = "";
      }
    });
  }

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!recipientSelect || !subjectInput || !messageInput || !result) return;

    result.textContent = "";
    result.className = "mt-3";

    const payload = {
      recipient: recipientSelect.value,
      patient_id:
        patientSelect &&
        !patientContainer.classList.contains("d-none") &&
        patientSelect.value
          ? patientSelect.value
          : null,
      subject: subjectInput.value.trim(),
      message: messageInput.value.trim()
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Wysyłanie...";
    }

    try {
      const res = await fetch("/api/kontakt/wyslij", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (data.success) {
        result.classList.add("text-success");
        result.textContent = data.message || "Wiadomość wysłana.";
        form.reset();
        if (patientContainer) patientContainer.classList.add("d-none");
      } else {
        result.classList.add("text-danger");
        result.textContent =
          data.message || "Nie udało się wysłać wiadomości.";
      }
    } catch (err) {
      console.error("Błąd wysyłania wiadomości z kontaktu:", err);
      result.classList.add("text-danger");
      result.textContent = "Błąd serwera podczas wysyłania.";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });
}

async function loadPatientsForContact(selectEl) {
  // helper do wyciągania PESEL z różnych możliwych nazw w obiekcie
  function getPesel(p) {
    return (
      p.pesel ||
      p.PESEL ||
      p.pesel_pacjenta ||
      p.nr_pesel ||
      p.nrPesel ||
      p.peselPacjenta ||
      ""
    );
  }

  try {
    const res = await fetch("/api/lekarz/pacjenci");
    let patients = [];

    if (res.ok) {
      const data = await res.json();

      if (Array.isArray(data)) {
        patients = data;
      } else if (Array.isArray(data.pacjenci)) {
        patients = data.pacjenci;
      } else if (Array.isArray(data.data)) {
        patients = data.data;
      } else {
        console.error("Nieoczekiwany format danych pacjentów:", data);
      }
    } else {
      console.warn(
        "Błąd statusu przy pobieraniu pacjentów:",
        res.status,
        " – używam fallbacku z wizyt"
      );

      const [upRes, pastRes] = await Promise.all([
        fetch("/api/lekarz/najblizsze"),
        fetch("/api/lekarz/odbyte")
      ]);

      const up = upRes.ok ? await upRes.json() : [];
      const past = pastRes.ok ? await pastRes.json() : [];

      const map = new Map();

      [...up, ...past].forEach((v) => {
        if (!v.pacjent_id) return;
        if (!map.has(v.pacjent_id)) {
          map.set(v.pacjent_id, {
            id: v.pacjent_id,
            imie: v.imie_pacjenta,
            nazwisko: v.nazwisko_pacjenta,
            pesel: v.pesel
          });
        }
      });

      patients = Array.from(map.values());
    }

    // czyścimy poprzednie opcje, zostawiamy tylko placeholder
    while (selectEl.options.length > 1) {
      selectEl.remove(1);
    }

    patients.forEach((p) => {
      const id =
        p.id ||
        p.pacjent_id ||
        p.id_pacjenta ||
        p.id_uzytkownika ||
        p.user_id;

      if (!id) {
        console.warn("Pacjent bez ID, pomijam:", p);
        return;
      }

      const firstName = p.imie || p.first_name || p.imie_pacjenta || "";
      const lastName = p.nazwisko || p.last_name || p.nazwisko_pacjenta || "";
      const pesel = getPesel(p);

      let label = (firstName + " " + lastName).trim();
      if (!label) {
        label = "Pacjent";
      }

      if (pesel) {
        label += ", PESEL: " + pesel;
      }

      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      selectEl.appendChild(opt);
    });

    const THRESHOLD = 30;
    if (patients.length > THRESHOLD) {
      setupPatientSearch(patients, selectEl);
    } else {
      const container = selectEl.parentElement;
      if (container) {
        const oldWrapper = container.querySelector(".patient-search-wrapper");
        if (oldWrapper) {
          oldWrapper.remove();
        }
      }
      selectEl.classList.remove("d-none");
    }
  } catch (err) {
    console.error("Błąd pobierania listy pacjentów:", err);
  }
}


function setupPatientSearch(patients, selectEl) {
  const container = selectEl.parentElement;
  if (!container) return;

  // helper do wyciągania PESEL z obiektu pacjenta
  function getPesel(p) {
    return (
      p.pesel ||
      p.PESEL ||
      p.pesel_pacjenta ||
      p.nr_pesel ||
      p.nrPesel ||
      p.peselPacjenta ||
      ""
    );
  }

  // ukrywamy zwykły select
  selectEl.classList.add("d-none");

  // czyścimy ewentualny poprzedni wrapper
  let wrapper = container.querySelector(".patient-search-wrapper");
  if (wrapper) {
    wrapper.remove();
  }

  wrapper = document.createElement("div");
  wrapper.className = "patient-search-wrapper mt-1";

  wrapper.innerHTML = `
    <input
      type="text"
      class="form-control mb-2"
      id="patient-search-input"
      placeholder="Szukaj pacjenta po imieniu, nazwisku lub PESEL"
      autocomplete="off"
    >
    <div
      id="patient-search-results"
      class="list-group"
      style="max-height: 260px; overflow-y: auto;"
    ></div>
  `;

  container.appendChild(wrapper);

  const input = wrapper.querySelector("#patient-search-input");
  const resultsBox = wrapper.querySelector("#patient-search-results");

  if (!input || !resultsBox) return;

  function getId(p) {
    return (
      p.id ||
      p.pacjent_id ||
      p.id_pacjenta ||
      p.id_uzytkownika ||
      p.user_id
    );
  }

  function buildDisplayLabel(p) {
    const firstName = p.imie || p.first_name || p.imie_pacjenta || "";
    const lastName = p.nazwisko || p.last_name || p.nazwisko_pacjenta || "";
    let fullName = (firstName + " " + lastName).trim();
    if (!fullName) {
      fullName = "Pacjent";
    }

    const pesel = getPesel(p);

    let extra = "";
    if (pesel) {
      extra = "PESEL: " + pesel;
    }

    return { fullName, extra, pesel };
  }

  function filterPatients(query) {
    const q = (query || "").toLowerCase().trim();
    if (!q) {
      return patients.slice(0, 50);
    }

    return patients
      .filter((p) => {
        const { fullName, pesel } = buildDisplayLabel(p);
        const haystack = [fullName, pesel].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 50);
  }

  function renderResults(list) {
    resultsBox.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "list-group-item text-muted small";
      empty.textContent = "Brak wyników";
      resultsBox.appendChild(empty);
      return;
    }

    list.forEach((p) => {
      const id = getId(p);
      if (!id) return;

      const { fullName, extra, pesel } = buildDisplayLabel(p);

      const item = document.createElement("button");
      item.type = "button";
      item.className =
        "list-group-item list-group-item-action d-flex flex-column align-items-start";
      item.dataset.id = id;

      // imię nazwisko pierwszy wiersz, pesel w drugim
      item.innerHTML = `
        <div class="fw-semibold">${escapeHtml(fullName)}</div>
        ${
          extra
            ? `<div class="small text-muted">${escapeHtml(extra)}</div>`
            : ""
        }
      `;

      item.addEventListener("click", () => {
        selectEl.value = String(id);

        if (pesel) {
          input.value = `${fullName}, PESEL: ${pesel}`;
        } else {
          input.value = fullName;
        }

        resultsBox.innerHTML = "";
      });

      resultsBox.appendChild(item);
    });
  }

  // pierwszy render listy
  renderResults(filterPatients(""));

  // reagowanie na wpisywanie w pole
  input.addEventListener("input", () => {
    const value = input.value;
    const resultList = filterPatients(value);
    renderResults(resultList);
  });
}




// ===============================================
// CZATY – LEKARZ
// ===============================================
let chatsInitialized = false;
let chats = [];
let filteredChats = [];
let chatsPage = 1;
const CHATS_PER_PAGE = 5;
let chatSearchQuery = "";
let currentChatId = null;
let currentChatIdToDelete = null;
let deleteChatModal = null;

function initChatsOnce() {
  if (!chatsInitialized) {
    chatsInitialized = true;
    initChats();
  } else {
    loadChatList();
  }
}

function initChats() {
  const searchInput = document.getElementById("search-input-chats");
  const btnShowAll = document.getElementById("btn-show-all-chats");
  const btnBack = document.getElementById("btn-back-to-list");
  const btnDelete = document.getElementById("btn-delete-chat");
  const formMessage = document.getElementById("form-chat-message");
  const chatInput = document.getElementById("chat-input");
  const modalEl = document.getElementById("deleteChatModal");

  if (modalEl && window.bootstrap && window.bootstrap.Modal) {
    deleteChatModal = new window.bootstrap.Modal(modalEl);
  }

  // SZUKAJ – działa różnie w zależności od widoku:
  // - w liście rozmów: filtruje rozmowy
  // - w otwartej rozmowie: filtruje wiadomości w tej rozmowie
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const value = searchInput.value.trim();
      const chatView = document.getElementById("chat-view");
      const isChatOpen = chatView && !chatView.classList.contains("d-none");

      if (isChatOpen) {
        // filtrujemy wiadomości w aktualnej rozmowie
        filterMessagesInCurrentChat(value);
      } else {
        // filtrujemy listę rozmów
        chatSearchQuery = value;
        chatsPage = 1;
        applyChatFilters();
      }
    });
  }

  // "Pokaż wszystkie" chowamy na stałe
  if (btnShowAll) {
    btnShowAll.classList.add("d-none");
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      showChatListView();
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener("click", () => {
      if (!currentChatId) return;
      currentChatIdToDelete = currentChatId;
      if (deleteChatModal) {
        deleteChatModal.show();
      } else {
        deleteCurrentChat();
      }
    });
  }

  const confirmDeleteBtn = document.getElementById("confirm-delete-chat");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      await deleteCurrentChat();
    });
  }

  if (formMessage && chatInput) {
  // odsuwamy przycisk "Wyślij" od lewej
  const sendBtn = formMessage.querySelector('button[type="submit"]');
  if (sendBtn) {
    sendBtn.classList.add("ms-2"); // bootstrapowy margines z lewej
  }

  formMessage.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!currentChatId) return;
    const text = chatInput.value.trim();
    if (!text) return;

    try {
      const res = await fetch(`/api/czaty/${currentChatId}/wyslij`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tresc: text })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        chatInput.value = "";
        appendSingleMessage({
          tresc: text,
          od_pacjenta: 0, // <<< LEKARZ
          data: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Błąd wysyłania wiadomości w czacie lekarza:", err);
    }
  });
}


  loadChatList();
}



async function loadChatList() {
  const listContainer = document.getElementById("chat-list");
  const searchContainer = document.getElementById("search-container-chats");
  const pagContainer = document.getElementById("pagination-container-chats");

  if (listContainer) listContainer.innerHTML = "";
  if (pagContainer) pagContainer.innerHTML = "";

  try {
    const res = await fetch("/api/czaty/lista");
    const data = res.ok ? await res.json() : [];
    chats = Array.isArray(data) ? data : [];
    filteredChats = [...chats];

    if (searchContainer) {
      if (chats.length > 0) {
        searchContainer.classList.remove("d-none");
      } else {
        searchContainer.classList.add("d-none");
      }
    }

    chatsPage = 1;
    renderChatListPage();
  } catch (err) {
    console.error("Błąd pobierania listy czatów (lekarz):", err);
  }
}

function applyChatFilters() {
  if (!chatSearchQuery) {
    filteredChats = [...chats];
  } else {
    const q = chatSearchQuery.toLowerCase();
    filteredChats = chats.filter((c) => {
      const haystack = [
        c.temat || "",
        c.pacjent || "",
        c.odbiorca || "",
        c.ostatnia_tresc || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }
  renderChatListPage();
}

// ===============================================
// CZĘŚĆ DO WKLEJENIA – ZAMIEŃ CAŁĄ FUNKCJĘ renderChatListPage() NA TĘ PONIŻEJ
// ===============================================
function renderChatListPage() {
  const listContainer = document.getElementById("chat-list");
  const pagContainer = document.getElementById("pagination-container-chats");
  if (!listContainer || !pagContainer) return;

  listContainer.innerHTML = "";
  pagContainer.innerHTML = "";

  if (!filteredChats.length) {
    listContainer.innerHTML = '<div class="text-muted text-center py-3">Brak rozmów do wyświetlenia.</div>';
    pagContainer.classList.add("d-none");
    return;
  }

  // ←←← KLUCZOWA ZMIANA: dokładnie jak u pacjenta ←←←
  // Jeśli ≤ 5 rozmów i nie ma wyszukiwania → bez paginacji
  if (filteredChats.length <= CHATS_PER_PAGE && !chatSearchQuery) {
    pagContainer.classList.add("d-none");
    listContainer.append(...createChatCards(filteredChats));
    return;
  }

  // Jeśli jest wyszukiwanie albo więcej niż 5 → paginacja
  const totalPages = Math.max(1, Math.ceil(filteredChats.length / CHATS_PER_PAGE));
  if (chatsPage > totalPages) chatsPage = totalPages;

  const start = (chatsPage - 1) * CHATS_PER_PAGE;
  const pageItems = filteredChats.slice(start, start + CHATS_PER_PAGE);

  listContainer.append(...createChatCards(pageItems));

  if (totalPages > 1) {
    pagContainer.classList.remove("d-none");
    pagContainer.innerHTML = buildPaginationHtml(totalPages, chatsPage);
    attachPaginationListeners();
  } else {
    pagContainer.classList.add("d-none");
  }
}

// ===============================================
// POMOCNICZE FUNKCJE – DODAJ PONIŻEJ (jeśli jeszcze ich nie masz)
// ===============================================
function createChatCards(chatsArray) {
  return chatsArray.map(chat => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "chat-card list-group-item list-group-item-action border-start border-primary border-3 p-3 mb-2 rounded shadow-sm";

    const dt = chat.ostatnia_wiadomosc ? new Date(chat.ostatnia_wiadomosc) : null;
    const dateStr = dt
      ? dt.toLocaleDateString("pl-PL") + " " + dt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
      : "";

    const safeSubject = chat.temat || "Rozmowa bez tematu";
    const counterpart = chat.pacjent || "Nieznany";
    const initial = (safeSubject || "R").trim().charAt(0).toUpperCase();

    item.innerHTML = `
      <div class="d-flex w-100 justify-content-between align-items-start">
        <div class="d-flex align-items-center flex-grow-1">
          <div class="me-3 d-none d-sm-block">
            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
                 style="width: 44px; height: 44px; font-size: 1.2rem;">
              ${escapeHtml(initial)}
            </div>
          </div>
          <div class="flex-grow-1">
            <div class="mb-1">
              <strong class="text-primary">Temat:</strong>
              <span class="fw-bold">${escapeHtml(safeSubject)}</span>
            </div>
            <div class="mb-1 text-muted small">
              <strong>Z:</strong> ${escapeHtml(counterpart)}
            </div>
            <div class="small text-truncate text-muted" style="max-width: 420px;">
              ${escapeHtml(chat.ostatnia_tresc || "")}
            </div>
          </div>
        </div>
        <div class="text-end">
          ${dateStr ? `<small class="text-muted d-block">${escapeHtml(dateStr)}</small>` : ""}
          ${Number(chat.nieprzeczytane) > 0 ? '<span class="badge bg-success rounded-pill mt-1">Nowa</span>' : ""}
        </div>
      </div>`;

    item.addEventListener("click", () => {
      openChat(chat.id, safeSubject, counterpart, chat.ostatnia_tresc || "");
    });

    return item;
  });
}

function buildPaginationHtml(totalPages, currentPage) {
  let html = '<nav aria-label="Stronicowanie rozmów"><ul class="pagination justify-content-center mb-0">';
  for (let i = 1; i <= totalPages; i++) {
    html += `<li class="page-item ${i === currentPage ? "active" : ""}">
               <button class="page-link" type="button" data-page="${i}">${i}</button>
             </li>`;
  }
  html += "</ul></nav>";
  return html;
}

function attachPaginationListeners() {
  document.querySelectorAll("#pagination-container-chats button[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      chatsPage = parseInt(btn.dataset.page, 10);
      renderChatListPage();
    });
  });
}


async function openChat(id, temat, pacjent) {
  currentChatId = id;

  const chatView = document.getElementById("chat-view");
  const chatList = document.getElementById("chat-list");
  const chatTitle = document.getElementById("chat-title");
  const activeChatHeader = document.getElementById("active-chat-header");
  const activeChatTitle = document.getElementById("active-chat-title");
  const activeChatLastMsg = document.getElementById("active-chat-lastmsg");
  const activeChatInitial = document.getElementById("active-chat-initial");
  const messagesContainer = document.getElementById("chat-messages");
  const searchContainer = document.getElementById("search-container-chats");
  const pagContainer = document.getElementById("pagination-container-chats");
  const deleteTitleEl = document.getElementById("delete-chat-title-modal");

  if (!chatView || !chatList || !messagesContainer) return;

  // przejście do widoku rozmowy
  chatList.classList.add("d-none");
  chatView.classList.remove("d-none");

  // W ŚRODKU ROZMOWY:
  // - NIE MA PAGINACJI
  // - SZUKAJ ZOSTAJE (działa na wiadomości)
  if (pagContainer) {
    pagContainer.classList.add("d-none");
    pagContainer.innerHTML = "";
  }
  if (searchContainer) {
    searchContainer.classList.remove("d-none");
  }

  const safeSubject = temat || "Rozmowa bez tematu";
  const safePacjent = pacjent || "nieznany";

  if (chatTitle) {
    chatTitle.innerHTML =
      "<div><strong>Temat:</strong> " +
      escapeHtml(safeSubject) +
      "</div>" +
      '<div class="small text-muted">Pacjent: ' +
      escapeHtml(safePacjent) +
      "</div>";
  }

  if (activeChatHeader && activeChatTitle && activeChatLastMsg && activeChatInitial) {
    activeChatHeader.classList.remove("d-none");
    activeChatTitle.textContent = safeSubject;
    activeChatLastMsg.textContent = "Pacjent: " + safePacjent;

    const firstLetter =
      (safePacjent || safeSubject || "?").trim().charAt(0).toUpperCase() || "P";
    activeChatInitial.textContent = firstLetter;
  }

  if (deleteTitleEl && chatTitle) {
    deleteTitleEl.innerHTML = chatTitle.innerHTML;
  }

  messagesContainer.innerHTML =
    '<div class="text-muted text-center py-3">Ładowanie wiadomości...</div>';

  try {
    const res = await fetch(`/api/czaty/${id}`);
    const data = res.ok ? await res.json() : null;

    if (!data || !data.wiadomosci) {
      messagesContainer.innerHTML =
        '<div class="text-muted text-center py-3">Brak wiadomości w tej rozmowie.</div>';
      return;
    }

    messagesContainer.innerHTML = "";
    data.wiadomosci.forEach((msg) => appendSingleMessage(msg));
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // oznacz jako przeczytane i odśwież listę
    try {
      await fetch(`/api/czaty/${id}/przeczytaj`, { method: "POST" });
      loadChatList();
    } catch (e) {
      console.warn("Błąd oznaczania przeczytanych (lekarz):", e);
    }
  } catch (err) {
    console.error("Błąd pobierania czatu lekarza:", err);
    messagesContainer.innerHTML =
      '<div class="text-danger text-center py-3">Nie udało się pobrać wiadomości.</div>';
  }
}

function appendSingleMessage(msg) {
  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) return;

  // w panelu LEKARZA "moje" = od_pacjenta === 0
  const odPacjenta = msg.od_pacjenta;
  const isMine = (odPacjenta === 0 || odPacjenta === "0");

  const dt = msg.data ? new Date(msg.data) : new Date();
  const timeStr = dt.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const wrapper = document.createElement("div");
  wrapper.className =
    "mb-3 chat-message-row " + (isMine ? "text-end" : "text-start");

  const bubble = document.createElement("div");
  bubble.className =
    "d-inline-block p-3 rounded-3 shadow-sm" +
    (isMine ? " bg-primary text-white" : " bg-light text-dark border");
  bubble.style.maxWidth = "85%";
  bubble.style.wordWrap = "break-word";
  bubble.style.fontSize = "1rem";
  bubble.style.lineHeight = "1.5";

  bubble.innerHTML =
    "<div>" +
    escapeHtml(msg.tresc || "") +
    "</div>" +
    '<small class="d-block mt-1 opacity-75">' +
    escapeHtml(timeStr) +
    "</small>";

  wrapper.appendChild(bubble);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


// ===============================================
// MODAL DO ZARZĄDZANIA NOTATKAMI / RECEPTAMI / SKIEROWANIAMI
// ===============================================
let currentManageType = null;
let currentWizytaId = null;
let currentVisitData = null;

function openManageModal(type, wizytaId, visitData) {
  currentManageType = type;
  currentWizytaId = wizytaId;
  currentVisitData = visitData;

  const modalTitle = document.getElementById("manageModalTitle");
  const modalBody = document.getElementById("manageModalBody");
  const saveBtn = document.getElementById("manageSaveBtn");
  const statusEl = document.getElementById("manageStatus");

  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "me-auto small";
  }

  if (type === "notatki") {
    modalTitle.textContent = "Edytuj notatki / zalecenia";
    modalBody.innerHTML = `
      <label class="form-label">Notatki dla pacjenta:</label>
      <textarea class="form-control" id="manageInput" rows="10" placeholder="Wpisz zalecenia, diagnozę, uwagi...">${visitData.notatki || ""}</textarea>
    `;
  } else if (type === "recepty") {
    modalTitle.textContent = "Zarządzaj receptami";
    const receptyHtml = (visitData.recepty || []).map((r) => `
      <div class="row g-2 mb-2 align-items-center border-bottom pb-2 recepta-row">
        <div class="col-md-5"><input type="text" class="form-control form-control-sm" value="${escapeHtml(r.lek || "")}" placeholder="Nazwa leku"></div>
        <div class="col-md-4"><input type="text" class="form-control form-control-sm" value="${escapeHtml(r.dawkowanie || "")}" placeholder="Dawkowanie"></div>
        <div class="col-md-2"><input type="number" class="form-control form-control-sm" value="${r.ilosc_dni || ""}" placeholder="Dni"></div>
        <div class="col-1"><button type="button" class="btn btn-sm btn-danger remove-row"><i class="bi bi-trash"></i></button></div>
      </div>
    `).join("") || '<p class="text-muted">Brak recept</p>';

    modalBody.innerHTML = `
      <div id="recepty-list">${receptyHtml}</div>
      <button type="button" class="btn btn-sm btn-outline-success mt-2" id="addReceptaRow"><i class="bi bi-plus-lg"></i> Dodaj receptę</button>
    `;
  } else if (type === "skierowania") {
    modalTitle.textContent = "Zarządzaj skierowaniami";
    const skierowaniaHtml = (visitData.skierowania || []).map((s) => `
      <div class="row g-2 mb-2 align-items-center border-bottom pb-2 skierowanie-row">
        <div class="col-md-6"><input type="text" class="form-control form-control-sm" value="${escapeHtml(s.do_specjalizacji || "")}" placeholder="Do specjalizacji"></div>
        <div class="col-md-5"><input type="text" class="form-control form-control-sm" value="${escapeHtml(s.powod || "")}" placeholder="Powód skierowania"></div>
        <div class="col-1"><button type="button" class="btn btn-sm btn-danger remove-row"><i class="bi bi-trash"></i></button></div>
      </div>
    `).join("") || '<p class="text-muted">Brak skierowań</p>';

    modalBody.innerHTML = `
      <div id="skierowania-list">${skierowaniaHtml}</div>
      <button type="button" class="btn btn-sm btn-outline-info mt-2" id="addSkierowanieRow"><i class="bi bi-plus-lg"></i> Dodaj skierowanie</button>
    `;
  }

  const modal = new bootstrap.Modal(document.getElementById("manageModal"));
  modal.show();

  saveBtn.onclick = () => saveManageData(modal);
}


// Zapisywanie danych
async function saveManageData(modal) {
  const statusEl = document.getElementById("manageStatus");
  if (statusEl) {
    statusEl.textContent = "Zapisywanie...";
    statusEl.className = "me-auto small text-muted";
  }

  let endpoint;
  let body;

  if (currentManageType === "notatki") {
    const notatki = document.getElementById("manageInput").value.trim();
    endpoint = "/api/lekarz/notatki";
    body = { wizyta_id: currentWizytaId, notatki: notatki || null };

    if (currentVisitData) {
      currentVisitData.notatki = notatki || null;
    }
  } else if (currentManageType === "recepty") {
    const rows = document.querySelectorAll("#recepty-list .recepta-row");
    const recepty = Array.from(rows)
      .map((row) => {
        const inputs = row.querySelectorAll("input");
        return {
          lek: inputs[0].value.trim(),
          dawkowanie: inputs[1].value.trim() || null,
          ilosc_dni: inputs[2].value ? parseInt(inputs[2].value, 10) : null
        };
      })
      .filter((r) => r.lek);

    endpoint = "/api/lekarz/recepty/batch";
    body = { wizyta_id: currentWizytaId, recepty };

    if (currentVisitData) {
      currentVisitData.recepty = recepty;
    }
  } else if (currentManageType === "skierowania") {
    const rows = document.querySelectorAll("#skierowania-list .skierowanie-row");
    const skierowania = Array.from(rows)
      .map((row) => {
        const inputs = row.querySelectorAll("input");
        return {
          do_specjalizacji: inputs[0].value.trim(),
          powod: inputs[1].value.trim() || null
        };
      })
      .filter((s) => s.do_specjalizacji);

    endpoint = "/api/lekarz/skierowania/batch";
    body = { wizyta_id: currentWizytaId, skierowania };

    if (currentVisitData) {
      currentVisitData.skierowania = skierowania;
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await res.json().catch(() => ({ success: false }));

    if (result.success) {
      if (statusEl) {
        statusEl.textContent = "Zapisano zmiany";
        statusEl.className = "me-auto small text-success";
      }

      // natychmiastowe odświeżenie widoku kart na podstawie zmienionego currentVisitData
      updateVisitsView();

      // opcjonalnie zamknięcie okna po chwili
      setTimeout(() => {
        modal.hide();
      }, 600);
    } else {
      if (statusEl) {
        statusEl.textContent = result.message || "Błąd zapisu";
        statusEl.className = "me-auto small text-danger";
      }
    }
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.textContent = "Błąd serwera";
      statusEl.className = "me-auto small text-danger";
    }
  }
}


// Dodawanie/usuwanie wierszy w modalu
document.addEventListener("click", (e) => {
  // Dodaj receptę
  if (e.target.closest("#addReceptaRow")) {
    document.getElementById("recepty-list").insertAdjacentHTML("beforeend", `
      <div class="row g-2 mb-2 align-items-center border-bottom pb-2 recepta-row">
        <div class="col-md-5"><input type="text" class="form-control form-control-sm" placeholder="Nazwa leku"></div>
        <div class="col-md-4"><input type="text" class="form-control form-control-sm" placeholder="Dawkowanie"></div>
        <div class="col-md-2"><input type="number" class="form-control form-control-sm" placeholder="Dni"></div>
        <div class="col-1"><button type="button" class="btn btn-sm btn-danger remove-row"><i class="bi bi-trash"></i></button></div>
      </div>
    `);
  }
  // Dodaj skierowanie
  if (e.target.closest("#addSkierowanieRow")) {
    document.getElementById("skierowania-list").insertAdjacentHTML("beforeend", `
      <div class="row g-2 mb-2 align-items-center border-bottom pb-2 skierowanie-row">
        <div class="col-md-6"><input type="text" class="form-control form-control-sm" placeholder="Do specjalizacji"></div>
        <div class="col-md-5"><input type="text" class="form-control form-control-sm" placeholder="Powód skierowania"></div>
        <div class="col-1"><button type="button" class="btn btn-sm btn-danger remove-row"><i class="bi bi-trash"></i></button></div>
      </div>
    `);
  }
  // Usuń wiersz
  if (e.target.closest(".remove-row")) {
    e.target.closest(".row").remove();
  }
});

function filterMessagesInCurrentChat(query) {
  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) return;

  const rows = messagesContainer.querySelectorAll(".chat-message-row");
  if (!rows.length) return;

  const q = (query || "").toLowerCase();

  rows.forEach((row) => {
    if (!q) {
      row.classList.remove("d-none");
      return;
    }
    const text = row.textContent || "";
    if (text.toLowerCase().includes(q)) {
      row.classList.remove("d-none");
    } else {
      row.classList.add("d-none");
    }
  });
}


function showChatListView() {
  const chatView = document.getElementById("chat-view");
  const chatList = document.getElementById("chat-list");
  const activeChatHeader = document.getElementById("active-chat-header");

  if (chatView) chatView.classList.add("d-none");
  if (chatList) chatList.classList.remove("d-none");
  if (activeChatHeader) activeChatHeader.classList.add("d-none");

  const searchContainer = document.getElementById("search-container-chats");
  const pagContainer = document.getElementById("pagination-container-chats");
  if (searchContainer && chats.length > 0) {
    searchContainer.classList.remove("d-none");
  }
  if (pagContainer && chats.length > CHATS_PER_PAGE) {
    pagContainer.classList.remove("d-none");
  }

  currentChatId = null;
}

async function deleteCurrentChat() {
  if (!currentChatIdToDelete) return;

  try {
    const res = await fetch(`/api/czaty/${currentChatIdToDelete}`, {
      method: "DELETE"
    });
    const data = await res.json().catch(() => ({}));
    if (!data || !data.success) {
      console.warn("Nie udało się usunąć rozmowy:", data && data.message);
    }
  } catch (err) {
    console.error("Błąd usuwania czatu (lekarz):", err);
  } finally {
    if (deleteChatModal) {
      deleteChatModal.hide();
    }
    currentChatId = null;
    currentChatIdToDelete = null;
    showChatListView();
    loadChatList();
  }
}
