document.addEventListener("DOMContentLoaded", async () => {
  const sections = {
    dashboard: document.getElementById("section-dashboard"),
    edit: document.getElementById("section-edit"),
    visit: document.getElementById("section-visit"),
    opinie: document.getElementById("section-opinie"),
    contact: document.getElementById("section-contact"),
    chats: document.getElementById("section-chats"),
  };
  const buttons = {
    dashboard: document.getElementById("btn-dashboard"),
    edit: document.getElementById("btn-edit-profile"),
    visit: document.getElementById("btn-visit"),
    opinie: document.getElementById("btn-opinie"),
    contact: document.getElementById("btn-contact"),
    chats: document.getElementById("btn-chats"),
  };
  const setActive = async (name) => {
    Object.values(buttons).forEach((b) => b.classList.remove("active"));
    Object.values(sections).forEach((s) => s.classList.add("d-none"));
    buttons[name].classList.add("active");
    sections[name].classList.remove("d-none");
    if (name === "edit") {
      const avatarImg = document.getElementById("current-avatar");
      if (avatarImg) {
        const baseSrc = avatarImg.src.split('?')[0];
        avatarImg.src = `${baseSrc}?t=${Date.now()}`;
      }
    }
    if (name === "dashboard") {
      const container = document.getElementById("dashboard-details");
      const searchContainer = document.getElementById("search-container");
      const paginationContainer = document.getElementById("pagination-container");
      container.innerHTML = "";
      searchContainer.classList.add("d-none");
      paginationContainer.classList.add("d-none");
      currentData = [];
      currentRenderFn = null;
      currentTitle = "";
      currentPage = 1;
      showAllDashboard = false;
    } else {
      if (currentRefreshInterval) {
        clearInterval(currentRefreshInterval);
        currentRefreshInterval = null;
      }
    }
  };
  Object.entries(buttons).forEach(([name, btn]) => {
    btn.addEventListener("click", () => setActive(name));
  });

  // --- Statystyki ---
  async function loadStats() {
    try {
      const res = await fetch("/api/pacjent/statystyki");
      const data = await res.json();
      const zaplanowane = data.zaplanowane || 0;
      const odbyte = data.odbyte || 0;
      const recepty = data.recepty || 0;
      const powiadomienia = data.powiadomienia || 0;
      document.getElementById("stat-wizyty").textContent = zaplanowane;
      document.getElementById("stat-odbyte").textContent = odbyte;
      document.getElementById("stat-recepty").textContent = recepty;
      document.getElementById("stat-powiadomienia").textContent = powiadomienia;
    } catch (err) {
      console.error("Błąd ładowania statystyk:", err);
      document.getElementById("stat-wizyty").textContent = "0";
      document.getElementById("stat-odbyte").textContent = "0";
      document.getElementById("stat-recepty").textContent = "0";
      document.getElementById("stat-powiadomienia").textContent = "0";
    }
  }
  loadStats();
  const statsInterval = setInterval(loadStats, 30000);

  // --- Uniwersalne renderowanie ---
  const DEFAULT_ITEMS_PER_PAGE = 5;
  let currentData = [];
  let currentRenderFn = null;
  let currentTitle = "";
  let currentPage = 1;
  let visibleDashboard = true;  // Początkowo widoczne z paginacją
  let currentEndpoint = null;
  let currentFilterFn = null;
  let currentRefreshInterval = null;

 function renderList(endpoint, filterFn, renderFn, title) {
  currentEndpoint = endpoint;
  currentFilterFn = filterFn;
  currentRenderFn = renderFn;
  currentTitle = title;
  visibleDashboard = true;  // startowo widoczne
  currentPage = 1;

  const container = document.getElementById("dashboard-details");
  const searchContainer = document.getElementById("search-container");
  const showAllBtn = document.getElementById("btn-show-all");
  const paginationContainer = document.getElementById("pagination-container");
  const searchInput = document.getElementById("search-input");

  // wyczyść widok na start
  container.innerHTML = "";
  searchContainer.classList.add("d-none");
  paginationContainer.classList.add("d-none");

  async function refreshData() {
    try {
      const res = await fetch(currentEndpoint);
      const data = await res.json();

      let items = Array.isArray(data) ? data : data.wizyty || [];
      if (currentFilterFn) items = items.filter(currentFilterFn);

      currentData = items;
      const total = currentData.length;

      // POKAŻ WYSZUKIWARKĘ TYLKO JEŚLI MA TO SENS
      // (np. więcej rekordów niż na jednej stronie)
      if (total > DEFAULT_ITEMS_PER_PAGE) {
        searchContainer.classList.remove("d-none");
        searchInput.value = "";
        searchInput.oninput = () => {
          currentPage = 1;
          filterAndPaginate();
        };
        showAllBtn.textContent = "Ukryj wszystkie";
        showAllBtn.onclick = toggleVisibleDashboard;
      } else {
        searchContainer.classList.add("d-none");
      }

      filterAndPaginate();
    } catch (err) {
      console.error("Błąd ładowania:", err);
      container.innerHTML = '<p class="text-danger text-center">Błąd ładowania danych.</p>';
    }
  }

  refreshData();

  if (currentRefreshInterval) clearInterval(currentRefreshInterval);
  currentRefreshInterval = setInterval(refreshData, 30000);
}


  function toggleVisibleDashboard() {
  visibleDashboard = !visibleDashboard;
  const showAllBtn = document.getElementById("btn-show-all");
  showAllBtn.textContent = visibleDashboard ? "Ukryj wszystkie" : "Pokaż wszystkie";
  currentPage = 1;
  filterAndPaginate();
}

  function filterAndPaginate(page = 1) {
  const searchInput = document.getElementById("search-input");
  const searchTerm = searchInput?.value.trim().toLowerCase() || "";
  currentPage = page;

  let filtered = currentData;
  if (searchTerm) {
    filtered = currentData.filter(item => {
      let found = false;
      Object.values(item).some(val => {
        if (val === null || val === undefined) return false;
        if (Array.isArray(val)) {
          if (val.some(subItem => {
            return Object.values(subItem).some(subVal =>
              String(subVal).toLowerCase().includes(searchTerm)
            );
          })) {
            found = true;
          }
        } else {
          let str = String(val).toLowerCase();
          if (item.data_godzina) {
            const date = new Date(item.data_godzina);
            const dateStr = date.toLocaleDateString("pl-PL");
            const timeStr = date.toLocaleTimeString("pl-PL", {
              hour: "2-digit",
              minute: "2-digit"
            });
            const fullStr = `${dateStr} ${timeStr}`;
            if (fullStr.toLowerCase().includes(searchTerm)) found = true;
            if (dateStr.includes(searchTerm)) found = true;
            if (timeStr.includes(searchTerm)) found = true;
          }
          if (str.includes(searchTerm)) found = true;
        }
        if (found) return true;
      });
      return found;
    });
  }

  const total = filtered.length;
  const container = document.getElementById("dashboard-details");
  const paginationContainer = document.getElementById("pagination-container");

  const headerHtml = `<h5 class="fw-semibold mt-4 mb-3">${currentTitle} (${total}):</h5>`;

  // ← przy ukryciu zostawiamy sam nagłówek
  if (!visibleDashboard) {
    container.innerHTML = headerHtml;
    paginationContainer.classList.add("d-none");
    return;
  }

  const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filtered.slice(start, end);

  container.innerHTML = headerHtml;

  if (pageItems.length === 0) {
    container.innerHTML += '<p class="text-muted text-center">Brak wyników.</p>';
    paginationContainer.classList.add("d-none");
    return;
  }

  container.innerHTML += currentRenderFn(pageItems);

  if (total > DEFAULT_ITEMS_PER_PAGE) {
    paginationContainer.classList.remove("d-none");
    let html = `<nav><ul class="pagination justify-content-center mb-0">`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<li class="page-item ${i === page ? 'active' : ''}">
                 <a class="page-link" href="#" data-page="${i}">${i}</a>
               </li>`;
    }
    html += `</ul></nav>`;
    paginationContainer.innerHTML = html;
    paginationContainer.querySelectorAll(".page-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        filterAndPaginate(parseInt(e.target.dataset.page));
      });
    });
  } else {
    paginationContainer.classList.add("d-none");
  }
}


      function renderWizyty(wizyty) {
  return `<div class="list-group">
    ${wizyty.map(w => {
      const d = new Date(w.data_godzina).toLocaleString("pl-PL");
      const isZaplanowana = w.status === 'zaplanowana';
      let statusBadge = `<span class="badge bg-success">${w.status}</span>`;
      if (w.status === 'odbyta') {
        statusBadge = `<span class="badge bg-success">odbyta${w.oceniona ? ' (oceniona)' : ''}</span>`;
      } else if (w.status === 'anulowana') {
        statusBadge = `<span class="badge bg-danger">${w.status}</span>`;
      }

      // TYLKO DLA ODBYTYCH: pokazujemy zalecenia i skierowania
      let dodatkowePola = '';
      if (!isZaplanowana) {
        const zalecenia = w.notatki ? w.notatki.replace(/\n/g, '<br>') : "Brak";
        const skierowaniaHtml = w.skierowania.length > 0 
          ? w.skierowania.map(sk => `
              <button class="btn btn-sm btn-outline-success pobierz-skierowanie ms-2" data-id="${sk.id}">Pobierz PDF</button>
            `).join("")
          : "Brak";

        dodatkowePola = `
          <strong>Zalecenia:</strong> ${zalecenia}<br>
          <strong>Skierowanie/a:</strong> ${skierowaniaHtml}
        `;
      }

      return `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <strong>Lekarz:</strong> ${w.imie_lekarza} ${w.nazwisko_lekarza}
              <small class="text-muted">(${w.specjalizacja || "Brak"})</small><br>
              <strong>Data:</strong> ${d}<br>
              ${dodatkowePola}
            </div>
            ${
              isZaplanowana
                ? `<button class="btn btn-sm btn-outline-danger anuluj-wizyte" data-id="${w.id}">Anuluj</button>`
                : statusBadge
            }
          </div>
        </div>`;
    }).join("")}
  </div>`;
}

  // --- ANULOWANIE WIZYTY ---
  document.getElementById("dashboard-details").addEventListener("click", async (e) => {
    if (e.target.classList.contains("anuluj-wizyte")) {
      const id = e.target.dataset.id;
      const modalHtml = `
        <div class="modal fade" id="anulujModal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Anulować wizytę?</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body text-center">
                <p>Czy na pewno chcesz anulować tę wizytę?</p>
              </div>
              <div class="modal-footer justify-content-center">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Nie</button>
                <button type="button" class="btn btn-danger" id="confirm-anuluj">Tak, anuluj</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", modalHtml);
      const modalEl = document.getElementById("anulujModal");
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      document.getElementById("confirm-anuluj").onclick = async () => {
        try {
          const res = await fetch(`/api/wizyty/anuluj/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          let result;
          const text = await res.text();
          try {
            result = JSON.parse(text);
          } catch (parseErr) {
            console.error("Błąd parsowania JSON:", text);
            modal.hide();
            alert("Błąd serwera – odpowiedź nie jest JSON.");
            return;
          }
          if (result.success) {
            await loadStats();
            modal.hide();
            const activeCard = document.querySelector(".stat-card .card-title.text-primary, .stat-card .card-title.text-info");
            if (activeCard) {
              activeCard.closest(".stat-card").click();
            }
          } else {
            alert(result.message || "Nie udało się anulować wizyty.");
          }
        } catch (err) {
          console.error("Błąd anulowania:", err);
          alert("Błąd połączenia z serwerem.");
        }
      };
      modalEl.addEventListener("hidden.bs.modal", function () {
        this.remove();
      });
    } else if (e.target.classList.contains("pobierz-skierowanie")) {
      const id = e.target.dataset.id;
      window.location.href = `/api/skierowania/pdf/${id}`;
    }
  });

  function renderRecepty(recepty) {
    return `<div class="list-group">
      ${recepty.map(r => `
        <div class="list-group-item">
          <strong>Lek:</strong> ${r.nazwa_leku}<br>
          <strong>Dawka:</strong> ${r.dawkowanie}<br>
          <small class="text-muted">Wystawiono: ${new Date(r.data_wystawienia).toLocaleDateString("pl-PL")}</small>
        </div>
      `).join("")}
    </div>`;
  }

  function renderPowiadomienia(powiadomienia) {
    return `<div class="list-group">
      ${powiadomienia.map(p => `
        <div class="list-group-item ${p.przeczytane ? '' : 'border-start border-primary border-3'}">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <strong>Tytuł: ${p.tytul}</strong>
              <small class="text-muted d-block">
                Od: <span class="fw-semibold">${p.nadawca}</span> ·
                ${new Date(p.data).toLocaleString("pl-PL")}
              </small>
              <p class="mb-0 mt-2 text-break">${p.tresc}</p>
            </div>
            ${!p.przeczytane ? '<span class="badge bg-primary">Nowe</span>' : ''}
          </div>
        </div>
      `).join("")}
    </div>`;
  }

  // --- Kliknięcie w statystyki ---
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("click", async (e) => {
      const titleEl = e.currentTarget.querySelector(".card-title");
      const title = titleEl.textContent.trim();
      const container = document.getElementById("dashboard-details");
      container.innerHTML = "";
      document.getElementById("search-container").classList.add("d-none");
      document.getElementById("pagination-container").classList.add("d-none");
      let endpoint = "";
      let filterFn = null;
      let renderFn = null;
      if (title.includes("Najbliższe") || title.includes("Odbyte")) {
        endpoint = "/api/pacjent/wizyty";
        const isOdbyte = title.includes("Odbyte");
        filterFn = (w) => w.status === (isOdbyte ? "odbyta" : "zaplanowana");
        renderFn = renderWizyty;
      } else if (title.includes("Recepty")) {
        endpoint = "/api/pacjent/recepty";
        renderFn = renderRecepty;
      } else if (title.includes("Powiadomienia")) {
        endpoint = "/api/pacjent/powiadomienia";
        renderFn = renderPowiadomienia;
      } else {
        return;
      }
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        if (!data || (Array.isArray(data) && data.length === 0) || (data.wizyty && data.wizyty.length === 0)) {
          container.innerHTML = '<p class="text-muted text-center">Brak danych.</p>';
          return;
        }
        let items = Array.isArray(data) ? data : data.wizyty || [];
        if (filterFn) items = items.filter(filterFn);
        if (items.length === 0) {
          container.innerHTML = '<p class="text-muted text-center">Brak wyników.</p>';
          return;
        }
        renderList(endpoint, filterFn, renderFn, title);
      } catch (err) {
        console.error("Błąd ładowania:", err);
        container.innerHTML = '<p class="text-danger text-center">Błąd ładowania danych.</p>';
      }
    });
  });

  // --- Pobieranie specjalizacji ---
  async function loadSpecializations() {
    const res = await fetch("/api/specjalizacje");
    const data = await res.json();
    const select = document.getElementById("select-specialization");
    select.innerHTML = '<option value="">Wybierz specjalizację...</option>';
    data.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nazwa;
      select.appendChild(opt);
    });
  }
  loadSpecializations();

  // --- Lekarze po wyborze specjalizacji ---
  document.getElementById("select-specialization").addEventListener("change", async (e) => {
    const id = e.target.value;
    const doctorSelect = document.getElementById("select-doctor");
    doctorSelect.disabled = true;
    doctorSelect.innerHTML = "<option>Ładowanie...</option>";
    if (!id) return;
    const res = await fetch(`/api/lekarze/${id}`);
    const data = await res.json();
    doctorSelect.innerHTML = '<option value="">Wybierz lekarza...</option>';
    data.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = `${l.tytul_lekarza || ""} ${l.imie} ${l.nazwisko}`.trim();
      doctorSelect.appendChild(opt);
    });
    doctorSelect.disabled = false;
  });

  // --- Blokada dat z przeszłości ---
  const dateInput = document.getElementById("visit-date");
  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  dateInput.min = minDateTime;

  // --- Pobranie istniejących wizyt ---
  let existingVisits = [];
  async function loadVisits() {
    const res = await fetch("/api/pacjent/wizyty");
    const data = await res.json();
    existingVisits = Array.isArray(data) ? data : data.wizyty || [];
  }

  // --- Rezerwacja wizyty (POPRAWIONA) ---
document.getElementById("form-visit").addEventListener("submit", async (e) => {
  e.preventDefault();
  const specjalizacja = document.getElementById("select-specialization").value;
  const lekarz = document.getElementById("select-doctor").value;
  const data = document.getElementById("visit-date").value;
  const notatka = document.getElementById("visit-note").value.trim();
  const msg = document.getElementById("visit-message");
  msg.textContent = "";
  msg.className = "";

  if (!specjalizacja || !lekarz || !data) {
    msg.textContent = "Wypełnij wszystkie pola.";
    msg.className = "text-danger";
    return;
  }

  // ---- POPRAWKA: korekta strefy czasowej ----
  // input[type=datetime-local] zwraca string w formacie "YYYY-MM-DDTHH:mm"
  // w przeglądarce jest on w lokalnej strefie czasowej, ale Date() traktuje go jako UTC
  // więc trzeba ręcznie dodać offset
  const [datePart, timePart] = data.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const selectedDate = new Date(year, month - 1, day, hour, minute);
  // dodaj offset, żeby porównywać w tej samej strefie
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  const selectedLocal = new Date(selectedDate.getTime() - offsetMs);
  const nowLocal = new Date(now.getTime() - offsetMs);

  if (selectedLocal <= nowLocal) {
    msg.textContent = "Nie można umówić wizyty w przeszłości ani na bieżącą chwilę.";
    msg.className = "text-danger";
    return;
  }

  // ---- godziny pracy ----
  const dayOfWeek = selectedDate.getDay(); // 0-niedziela, 1-pon, ..., 6-sobota
  const minutes = selectedDate.getHours() * 60 + selectedDate.getMinutes();
  let allowed = false;
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    allowed = minutes >= 7 * 60 && minutes <= 20 * 60;
  } else if (dayOfWeek === 6) {
    allowed = minutes >= 8 * 60 && minutes <= 14 * 60;
  }
  if (!allowed) {
    msg.textContent =
      "Wizyty można umawiać tylko od poniedziałku do piątku 7:00–20:00 oraz w soboty 8:00–14:00. W niedziele klinika jest zamknięta.";
    msg.className = "text-danger";
    return;
  }

  // ---- istniejące wizyty ----
  await loadVisits();

  const hasPlannedInSpec = existingVisits.some(
    (v) => v.specjalizacja_id == specjalizacja && v.status === "zaplanowana"
  );
  if (hasPlannedInSpec) {
    msg.textContent = "Masz już zaplanowaną wizytę w tej specjalizacji.";
    msg.className = "text-danger";
    return;
  }

  const sameDaySameDoctor = existingVisits.some((v) => {
    const vDate = new Date(v.data_godzina);
    return (
      v.lekarz_id == lekarz &&
      vDate.toDateString() === selectedDate.toDateString()
    );
  });
  if (sameDaySameDoctor) {
    msg.textContent = "Masz już wizytę u tego lekarza w tym dniu.";
    msg.className = "text-danger";
    return;
  }

  const tooClose = existingVisits.some((v) => {
    const vDate = new Date(v.data_godzina);
    const diff = Math.abs(selectedDate - vDate);
    return diff < 20 * 60 * 1000;
  });
  if (tooClose) {
    msg.textContent = "Musisz zachować minimum 20 minut przerwy między wizytami.";
    msg.className = "text-danger";
    return;
  }

  // ---- wysłanie zapytania ----
  const res = await fetch("/api/wizyty/umow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lekarz_id: lekarz,
      specjalizacja_id: specjalizacja,
      data_godzina: data,
      notatka,
    }),
  });
  const result = await res.json();
  msg.textContent = result.message;
  msg.className = result.success ? "text-success" : "text-danger";

  // wyróżnienie komunikatu o niedostępności (urlop)
  if (result.message && (result.message.includes("niedostępny") || result.message.includes("urlopie"))) {
    msg.classList.add("fw-bold");
  } else {
    msg.classList.remove("fw-bold");
  }

  if (result.success) {
    await loadStats();
    e.target.reset();
    // przywróć minimalną datę po resecie
    const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    document.getElementById("visit-date").min = minDateTime;
  }
});

  // === WALIDACJA PESEL ===
  function validatePesel(pesel) {
    if (!pesel || pesel.length !== 11 || !/^\d{11}$/.test(pesel)) return false;
    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(pesel[i]) * weights[i];
    }
    const control = (10 - (sum % 10)) % 10;
    return control === parseInt(pesel[10]);
  }

  // Otwórz sekcję edycji
  buttons.edit.addEventListener("click", () => {
    setActive("edit");
  });

  // --- Edycja profilu ---
  const form = document.getElementById("edit-profile-form");
  const msg = document.getElementById("edit-profile-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "";
    const formData = new FormData(form);
    const avatarFile = formData.get("avatar");
    const newPassword = formData.get("newPassword");
    if (newPassword && newPassword.length < 8) {
      msg.textContent = "Nowe hasło musi mieć minimum 8 znaków.";
      msg.className = "text-danger";
      return;
    }
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
      const res = await fetch("/api/pacjent/update", {
        method: "POST",
        body: formData
      });
      const result = await res.json();
      msg.textContent = result.message;
      msg.className = result.success ? "text-success" : "text-danger";
      if (result.success && result.avatar) {
        const avatarImg = document.getElementById("current-avatar");
        avatarImg.src = `/images/avatar/${result.avatar}?t=${Date.now()}`;
      }
      if (result.success) {
        form.reset();
      }
    } catch (err) {
      console.error(err);
      msg.textContent = "Błąd połączenia z serwerem.";
      msg.className = "text-danger";
    }
  });

  // === KONTAKT ===
  const contactRecipient = document.getElementById("contact-recipient");
  const doctorSelectContainer = document.getElementById("doctor-select-container");
  const contactDoctor = document.getElementById("contact-doctor");
  contactRecipient.addEventListener("change", async () => {
    const val = contactRecipient.value;
    doctorSelectContainer.classList.toggle("d-none", val !== "lekarz");
    if (val === "lekarz") {
      await loadDoctorsForContact();
    }
  });
  async function loadDoctorsForContact() {
    contactDoctor.innerHTML = '<option>Ładowanie...</option>';
    try {
      const res = await fetch("/api/lekarze/wszyscy");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      contactDoctor.innerHTML = '<option value="">Wybierz lekarza...</option>';
      if (!data || data.length === 0) {
        contactDoctor.innerHTML += '<option disabled>Brak dostępnych lekarzy</option>';
        return;
      }
      data.forEach(l => {
        const fullName = [l.tytul_lekarza || "", l.imie, l.nazwisko].filter(Boolean).join(" ").trim();
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = fullName || "Brak danych";
        contactDoctor.appendChild(opt);
      });
    } catch (err) {
      console.error("[FRONT] Błąd ładowania lekarzy:", err);
      contactDoctor.innerHTML = '<option disabled>Błąd ładowania</option>';
    }
  }
  document.getElementById("form-contact").addEventListener("submit", async (e) => {
    e.preventDefault();
    const recipient = contactRecipient.value;
    const doctorId = recipient === "lekarz" ? contactDoctor.value : null;
    const subject = document.getElementById("contact-subject").value.trim();
    const message = document.getElementById("contact-message").value.trim();
    const resultDiv = document.getElementById("contact-result");
    if (!recipient || (recipient === "lekarz" && !doctorId) || !subject || !message) {
      resultDiv.textContent = "Wypełnij wszystkie pola.";
      resultDiv.className = "text-danger";
      return;
    }
    try {
      const res = await fetch("/api/kontakt/wyslij", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, doctor_id: doctorId, subject, message })
      });
      const result = await res.json();
      resultDiv.textContent = result.message;
      resultDiv.className = result.success ? "text-success" : "text-danger";
      if (result.success) {
        e.target.reset();
        doctorSelectContainer.classList.add("d-none");
      }
    } catch (err) {
      resultDiv.textContent = "Błąd wysyłania.";
      resultDiv.className = "text-danger";
    }
  });

  // === ROZMOWY – CZATY ===
  let currentChatId = null;
  let chatsData = [];
  const CHATS_PER_PAGE = 5;
  let showAllChats = false;
  let currentChatPage = 1;
  let chatRefreshInterval = null;

  async function loadChatList() {
    try {
      const res = await fetch("/api/czaty/lista");
      const chats = await res.json();
      chatsData = Array.isArray(chats) ? chats : [];
      const list = document.getElementById("chat-list");
      const searchContainer = document.getElementById("search-container-chats");
      const showAllBtn = document.getElementById("btn-show-all-chats");
      const paginationContainer = document.getElementById("pagination-container-chats");
      const activeHeader = document.getElementById("active-chat-header");
      activeHeader.classList.add("d-none");
      if (!chatsData.length) {
        list.innerHTML = '<p class="text-muted text-center">Brak rozmów. Napisz wiadomość w sekcji Kontakt.</p>';
        searchContainer.classList.add("d-none");
        paginationContainer.classList.add("d-none");
        return;
      }
      if (chatsData.length > 0) {
        searchContainer.classList.remove("d-none");
        const searchInput = document.getElementById("search-input-chats");
        searchInput.value = "";
        searchInput.oninput = () => {
          currentChatPage = 1;
          renderChats();
        };
        showAllBtn.textContent = "Pokaż wszystkie";
        showAllBtn.onclick = toggleShowAllChats;
      } else {
        searchContainer.classList.add("d-none");
      }
      renderChats();
    } catch (err) {
      console.error("Błąd ładowania czatów:", err);
    }
  }

  function toggleShowAllChats() {
    showAllChats = !showAllChats;
    const showAllBtn = document.getElementById("btn-show-all-chats");
    showAllBtn.textContent = showAllChats ? "Ukryj wszystkie" : "Pokaż wszystkie";
    currentChatPage = 1;
    renderChats();
  }

  function renderChats(page = 1) {
    const searchTerm = document.getElementById("search-input-chats")?.value.trim().toLowerCase() || "";
    currentChatPage = page;
    let filtered = chatsData;
    if (searchTerm) {
      filtered = chatsData.filter(chat => {
        const temat = (chat.temat || "").toLowerCase();
        const odbiorca = (chat.odbiorca || "").toLowerCase();
        const lastMsg = (chat.ostatnia_tresc || "").toLowerCase();
        const date = new Date(chat.ostatnia_wiadomosc).toLocaleString("pl-PL").toLowerCase();
        return temat.includes(searchTerm) || odbiorca.includes(searchTerm) || lastMsg.includes(searchTerm) || date.includes(searchTerm);
      });
    }
    const total = filtered.length;
    const itemsPerPage = showAllChats ? total : CHATS_PER_PAGE;
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filtered.slice(start, end);
    const list = document.getElementById("chat-list");
    list.innerHTML = "";
    if (pageItems.length === 0) {
      list.innerHTML += '<p class="text-muted text-center">Brak rozmów.</p>';
      document.getElementById("pagination-container-chats").classList.add("d-none");
      return;
    }
    list.innerHTML += pageItems.map(chat => {
      const bezpiecznyTemat = chat.temat || "Rozmowa bez tematu";
      const bezpiecznyOdbiorca = chat.odbiorca || "Nieznany";
      const pierwszaLitera = bezpiecznyTemat.charAt(0).toUpperCase();
      return `
        <div class="chat-card list-group-item list-group-item-action border-start border-primary border-3 p-3 mb-2 rounded shadow-sm" 
             data-chat-id="${chat.id}">
          <div class="d-flex w-100 justify-content-between align-items-start">
            <div class="d-flex align-items-center flex-grow-1">
              <div class="me-3 d-none d-sm-block">
                <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
                     style="width: 44px; height: 44px; font-size: 1.2rem;">
                  ${pierwszaLitera}
                </div>
              </div>
              <div class="flex-grow-1">
                <div class="mb-1">
                  <strong class="text-primary">Temat:</strong>
                  <span class="fw-bold">${bezpiecznyTemat}</span>
                </div>
                <div class="mb-1 text-muted small">
                  <strong>Z:</strong> ${bezpiecznyOdbiorca}
                </div>
              </div>
            </div>
            <div class="text-end">
              <small class="text-muted d-block">
                ${new Date(chat.ostatnia_wiadomosc).toLocaleDateString("pl-PL")}
                ${new Date(chat.ostatnia_wiadomosc).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
              </small>
              ${chat.nieprzeczytane > 0 ? `<span class="badge bg-success rounded-pill mt-1">Nowa</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");

    const paginationContainer = document.getElementById("pagination-container-chats");
    if (total > CHATS_PER_PAGE && !showAllChats) {
      paginationContainer.classList.remove("d-none");
      let html = `<nav><ul class="pagination justify-content-center mb-0">`;
      for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === page ? 'active' : ''}>
                   <a class="page-link" href="#" data-page="${i}">${i}</a>
                 </li>`;
      }
      html += `</ul></nav>`;
      paginationContainer.innerHTML = html;
      paginationContainer.querySelectorAll(".page-link").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          renderChats(parseInt(e.target.dataset.page));
        });
      });
    } else {
      paginationContainer.classList.add("d-none");
    }
  }

  // === DELEGACJA KLIKNIĘĆ NA KARTY CZATU ===
  function setupChatClickHandler() {
    const chatList = document.getElementById("chat-list");
    if (chatList.dataset.listenerAdded) return;

    chatList.addEventListener("click", (e) => {
      const card = e.target.closest(".chat-card");
      if (!card) return;
      const chatId = card.dataset.chatId;
      if (!chatId) return;

      const chat = chatsData.find(c => c.id == chatId);
      if (!chat) return;

      currentChatId = chat.id;
      document.getElementById("chat-title").innerHTML = `
        <div><strong>Temat:</strong> ${chat.temat || "Rozmowa bez tematu"}</div>
        <div class="small text-muted"><strong>Z:</strong> ${chat.odbiorca || "Nieznany"}</div>
      `;

      const header = document.getElementById("active-chat-header");
      document.getElementById("active-chat-initial").textContent = (chat.temat || "R").charAt(0).toUpperCase();
      document.getElementById("active-chat-title").innerHTML = document.getElementById("chat-title").innerHTML;
      document.getElementById("active-chat-lastmsg").textContent =
        `Ostatnia wiadomość: ${chat.ostatnia_tresc ? chat.ostatnia_tresc : "brak"}`;
      header.classList.remove("d-none");

      const deleteTitleEl = document.getElementById("delete-chat-title-modal");
      deleteTitleEl.innerHTML = document.getElementById("chat-title").innerHTML;

      loadChatView(chat.id);
    });

    chatList.dataset.listenerAdded = "true";
  }


  function buildChatMessagesHtml(messages) {
  if (!Array.isArray(messages)) messages = [];

  // 1) PORZĄDKUJEMY PO DACIE (najstarsza na górze, najnowsza na dole)
  const sorted = [...messages].sort((a, b) => {
    const da = a.data ? new Date(a.data).getTime() : 0;
    const db = b.data ? new Date(b.data).getTime() : 0;
    return da - db;
  });

  // 2) PACJENT = od_pacjenta === 1 (albo "1")
  return sorted
    .map((m) => {
      const fromPatient = (m.od_pacjenta === 1 || m.od_pacjenta === "1");

      const dt = m.data ? new Date(m.data) : new Date();
      const timeStr = dt.toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const sideClass = fromPatient ? "text-end" : "text-start";
      const bubbleClass = fromPatient
        ? "bg-primary text-white"
        : "bg-light text-dark border";

      return `
        <div class="mb-3 chat-message-row ${sideClass}">
          <div class="d-inline-block p-3 rounded-3 shadow-sm ${bubbleClass}"
               style="max-width: 85%; word-wrap: break-word; font-size: 1rem; line-height: 1.5;">
            <div>${m.tresc || ""}</div>
            <small class="d-block mt-1 opacity-75">
              ${timeStr}
            </small>
          </div>
        </div>
      `;
    })
    .join("");
}


  async function loadChatView(chatId) {
  document.getElementById("chat-list").classList.add("d-none");
  document.getElementById("search-container-chats").classList.add("d-none");
  document.getElementById("pagination-container-chats").classList.add("d-none");

  const view = document.getElementById("chat-view");
  view.classList.remove("d-none");

  const messagesDiv = document.getElementById("chat-messages");

  try {
    const res = await fetch(`/api/czaty/${chatId}`);
    const chat = await res.json();

    // RENDER 1: od razu po wejściu
    messagesDiv.innerHTML = buildChatMessagesHtml(chat.wiadomosci || []);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // oznacz jako przeczytane
    await fetch(`/api/czaty/${chatId}/przeczytaj`, { method: "POST" });
  } catch (err) {
    console.error("Błąd ładowania czatu:", err);
    messagesDiv.innerHTML =
      '<p class="text-danger text-center">Błąd ładowania wiadomości.</p>';
  }

  // Automatyczne odświeżanie co 5 sekund
  if (chatRefreshInterval) clearInterval(chatRefreshInterval);
  chatRefreshInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/czaty/${chatId}`);
      const chat = await res.json();

      const newHtml = buildChatMessagesHtml(chat.wiadomosci || []);
      if (newHtml !== messagesDiv.innerHTML) {
        messagesDiv.innerHTML = newHtml;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // ponownie oznacz jako przeczytane
        await fetch(`/api/czaty/${chatId}/przeczytaj`, { method: "POST" });
      }
    } catch (err) {
      console.error("Błąd odświeżania czatu:", err);
    }
  }, 5000);
}


  // Usuwanie rozmowy
  let chatToDelete = null;
  const deleteModal = new bootstrap.Modal(document.getElementById("deleteChatModal"));
  const deleteTitleEl = document.getElementById("delete-chat-title-modal");
  document.getElementById("btn-delete-chat").addEventListener("click", () => {
    if (!currentChatId) return;
    const chat = chatsData.find(c => c.id === currentChatId);
    if (chat) {
      deleteTitleEl.innerHTML = `
        <div><strong>Temat:</strong> ${chat.temat || "Rozmowa bez tematu"}</div>
        <div class="small text-muted"><strong>Z:</strong> ${chat.odbiorca || "Nieznany"}</div>
      `;
      chatToDelete = currentChatId;
      deleteModal.show();
    }
  });
  document.getElementById("confirm-delete-chat").addEventListener("click", async () => {
  if (!chatToDelete) return;
  try {
    const res = await fetch(`/api/czaty/${chatToDelete}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) {
      deleteModal.hide();
      document.getElementById("chat-view").classList.add("d-none");
      document.getElementById("active-chat-header").classList.add("d-none");
      document.getElementById("chat-list").classList.remove("d-none");
      document.getElementById("search-container-chats").classList.remove("d-none");
      if (chatsData.length > CHATS_PER_PAGE) {
        document.getElementById("pagination-container-chats").classList.remove("d-none");
      }

      // ZATRZYMAJ ODŚWIEŻANIE CZATU
      if (chatRefreshInterval) {
        clearInterval(chatRefreshInterval);
        chatRefreshInterval = null;
      }

      currentChatId = null;
      loadChatList(); // odśwież listę
    } else {
      alert("Nie udało się usunąć rozmowy.");
    }
  } catch (err) {
    alert("Błąd połączenia z serwerem.");
  } finally {
    chatToDelete = null;
  }
});
  document.getElementById("deleteChatModal").addEventListener("hidden.bs.modal", () => {
    chatToDelete = null;
  });
  document.getElementById("btn-back-to-list").addEventListener("click", () => {
    document.getElementById("chat-view").classList.add("d-none");
    document.getElementById("active-chat-header").classList.add("d-none");
    document.getElementById("chat-list").classList.remove("d-none");
    document.getElementById("search-container-chats").classList.remove("d-none");
    if (chatsData.length > CHATS_PER_PAGE) {
      document.getElementById("pagination-container-chats").classList.remove("d-none");
    }
    currentChatId = null;
    if (chatRefreshInterval) clearInterval(chatRefreshInterval);
  });
  document.getElementById("form-chat-message").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const tresc = input.value.trim();
    if (!tresc) return;
    await fetch(`/api/czaty/${currentChatId}/wyslij`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tresc })
    });
    input.value = "";
    loadChatView(currentChatId);
    loadChatList();
  });

  // === CZATY – WEJŚCIE W SEKCJĘ ===
  buttons.chats.addEventListener("click", () => {
    setActive("chats");
    loadChatList();
    setupChatClickHandler(); // ← KLUCZOWE!
  });

  // === OPINIE ===
  let opinieData = [];
  let lastOpiniaTime = 0;
  const OPINIA_COOLDOWN = 10 * 60 * 1000;
  let nieocenioneData = [];
  let currentNieocenionePage = 1;
  let currentOpiniePage = 1;  // Nowe: osobny currentPage dla opinii
  let visibleNieocenione = true;  // Początkowo widoczne z paginacją dla nieocenionych
  let visibleOpinie = true;  // Początkowo widoczne z paginacją dla opinii

  async function loadOpinie() {
    const res = await fetch("/api/pacjent/opinie");
    const data = await res.json();
    opinieData = data;
    const resNieocenione = await fetch("/api/pacjent/nieocenione-wizyty");
    const dataNieocenione = await resNieocenione.json();
    nieocenioneData = dataNieocenione;
    renderNieocenioneList(nieocenioneData);
    renderOpinieList(opinieData);
  }

  function renderNieocenioneList(data) {
    nieocenioneData = data;
    visibleNieocenione = true;
    currentNieocenionePage = 1;
    const container = document.getElementById("nieocenione-lista");
    const searchContainer = document.getElementById("search-container-nieocenione");
    const showAllBtn = document.getElementById("btn-show-all-nieocenione");
    const paginationContainer = document.getElementById("pagination-container-nieocenione");
    container.innerHTML = "";
    searchContainer.classList.add("d-none");
    paginationContainer.classList.add("d-none");
    const total = data.length;
    if (total > 0) {
      searchContainer.classList.remove("d-none");
      const searchInput = document.getElementById("search-input-nieocenione");
      searchInput.value = "";
      searchInput.oninput = () => {
        currentNieocenionePage = 1;
        filterNieocenione();
      };
      showAllBtn.textContent = "Ukryj wszystkie";
      showAllBtn.onclick = toggleVisibleNieocenione;
    }
    filterNieocenione(1);
  }

  function toggleVisibleNieocenione() {
    visibleNieocenione = !visibleNieocenione;
    const showAllBtn = document.getElementById("btn-show-all-nieocenione");
    showAllBtn.textContent = visibleNieocenione ? "Ukryj wszystkie" : "Pokaż wszystkie";
    currentNieocenionePage = 1;
    filterNieocenione();
  }

      function filterNieocenione(page = 1) {
    const searchInput = document.getElementById("search-input-nieocenione");
    const searchTerm = searchInput?.value.trim().toLowerCase() || "";
    currentNieocenionePage = page;
    let filtered = nieocenioneData;
    if (searchTerm) {
      filtered = filtered.filter(w => {
        const d = new Date(w.data_godzina).toLocaleString("pl-PL").toLowerCase();
        return (w.imie_lekarza || '').toLowerCase().includes(searchTerm) || (w.nazwisko_lekarza || '').toLowerCase().includes(searchTerm) || (w.specjalizacja || '').toLowerCase().includes(searchTerm) || d.includes(searchTerm) || (w.notatki && (w.notatki || '').toLowerCase().includes(searchTerm));
      });
    }
    const total = filtered.length;
    const container = document.getElementById("nieocenione-lista");
    const paginationContainer = document.getElementById("pagination-container-nieocenione");
    if (!visibleNieocenione) {
      container.innerHTML = `<h5 class="fw-semibold mb-3">Nieocenione wizyty (${total}):</h5>`;
      paginationContainer.classList.add("d-none");
      return;
    }
    const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filtered.slice(start, end);
    container.innerHTML = `<h5 class="fw-semibold mb-3">Nieocenione wizyty (${total}):</h5>`;
    if (pageItems.length === 0) {
      container.innerHTML += '<p class="text-muted text-center mb-3">Brak nieocenionych wizyt.</p>';
      paginationContainer.classList.add("d-none");
      return;
    }
    container.innerHTML += `<div class="list-group">
      ${pageItems.map(w => {
        const d = new Date(w.data_godzina).toLocaleString("pl-PL");
        return `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <strong>Lekarz:</strong> ${w.imie_lekarza} ${w.nazwisko_lekarza}
                <small class="text-muted">(${w.specjalizacja || "Brak"})</small><br>
                <strong>Data:</strong> ${d}<br>
                ${w.notatki ? `<strong>Notatka:</strong> ${w.notatki}` : ""}
              </div>
              <button class="btn btn-sm btn-outline-primary ocen-wizyte" data-id="${w.id}">Oceń</button>
            </div>
          </div>`;
      }).join("")}
    </div>`;
    if (total > DEFAULT_ITEMS_PER_PAGE) {
      paginationContainer.classList.remove("d-none");
      let html = `<nav><ul class="pagination justify-content-center mb-0">`;
      for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === page ? 'active' : ''}">
                   <a class="page-link" href="#" data-page="${i}">${i}</a>
                 </li>`;
      }
      html += `</ul></nav>`;
      paginationContainer.innerHTML = html;
      paginationContainer.querySelectorAll(".page-link").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          filterNieocenione(parseInt(e.target.dataset.page));
        });
      });
    } else {
      paginationContainer.classList.add("d-none");
    }
    // Delegacja kliknięcia "Oceń"
    container.querySelectorAll(".ocen-wizyte").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const wizytaId = e.target.dataset.id;
        showOcenaModal(wizytaId);
      });
    });
  }

  function showOcenaModal(wizytaId) {
    const modal = new bootstrap.Modal(document.getElementById("ocenaWizytyModal"));
    modal.show();
    const form = document.getElementById("form-ocena-wizyty");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ocena = document.querySelector('input[name="ocena-wizyty"]:checked')?.value;
      const komentarz = document.getElementById("ocena-wizyty-komentarz").value.trim();
      const msg = document.getElementById("opinia-message");
      if (!ocena) {
        msg.textContent = "Wybierz ocenę.";
        msg.className = "text-danger";
        return;
      }
      try {
        const res = await fetch("/api/opinie/dodaj", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ocena: parseInt(ocena), komentarz, wizyta_id: wizytaId })
        });
        const result = await res.json();
        msg.textContent = result.message;
        msg.className = result.success ? "text-success" : "text-danger";
        if (result.success) {
          modal.hide();
          form.reset();
          await loadOpinie();
        }
      } catch (err) {
        msg.textContent = "Błąd wysyłania.";
        msg.className = "text-danger";
      }
    };
  }

  function renderOpinieList(data) {
    opinieData = data;
    visibleOpinie = true;
    currentOpiniePage = 1;
    const container = document.getElementById("opinie-lista");
    const searchContainer = document.getElementById("search-container-opinie");
    const showAllBtn = document.getElementById("btn-show-all-opinie");
    const paginationContainer = document.getElementById("pagination-container-opinie");
    container.innerHTML = "";
    searchContainer.classList.add("d-none");
    paginationContainer.classList.add("d-none");
    const total = data.length;
    if (total > 0) {
      searchContainer.classList.remove("d-none");
      const searchInput = document.getElementById("search-input-opinie");
      searchInput.value = "";
      searchInput.oninput = () => {
        currentOpiniePage = 1;
        filterOpinie();
      };
      showAllBtn.textContent = "Ukryj wszystkie";
      showAllBtn.onclick = toggleVisibleOpinie;
    }
    filterOpinie(1);
  }

  function toggleVisibleOpinie() {
    visibleOpinie = !visibleOpinie;
    const showAllBtn = document.getElementById("btn-show-all-opinie");
    showAllBtn.textContent = visibleOpinie ? "Ukryj wszystkie" : "Pokaż wszystkie";
    currentOpiniePage = 1;
    filterOpinie();
  }

    function filterOpinie(page = 1) {
    const searchInput = document.getElementById("search-input-opinie");
    const searchTerm = searchInput?.value.trim().toLowerCase() || "";
    currentOpiniePage = page;
    let filtered = opinieData;
    if (searchTerm) {
      filtered = filtered.filter(o => {
        const d = new Date(o.data);
        const dateStr = d.toLocaleDateString("pl-PL").toLowerCase();
        const timeStr = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }).toLowerCase();
        const fullDateTime = d.toLocaleString("pl-PL").toLowerCase();
        return o.ocena.toString().includes(searchTerm) ||
               (o.komentarz && o.komentarz.toLowerCase().includes(searchTerm)) ||
               dateStr.includes(searchTerm) || timeStr.includes(searchTerm) || fullDateTime.includes(searchTerm);
      });
    }
    const total = filtered.length;
    const container = document.getElementById("opinie-lista");
    const paginationContainer = document.getElementById("pagination-container-opinie");
    if (!visibleOpinie) {
      container.innerHTML = `<h5 class="fw-semibold mb-3">Twoje opinie (${total}):</h5>`;
      paginationContainer.classList.add("d-none");
      return;
    }
    const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filtered.slice(start, end);
    container.innerHTML = `<h5 class="fw-semibold mb-3">Twoje opinie (${total}):</h5>`;
    if (pageItems.length === 0) {
      container.innerHTML += '<p class="text-muted text-center mb-3">Brak opinii.</p>';
      paginationContainer.classList.add("d-none");
      return;
    }
    container.innerHTML += `<div class="list-group">
      ${pageItems.map(o => `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <div class="text-warning mb-1">
                Ocena: ${o.ocena}/5 ${"★".repeat(o.ocena)}${"☆".repeat(5 - o.ocena)}
              </div>
               ${o.komentarz ? `<p class="mb-1 text-muted small fst-italic">${o.komentarz}</p>` : ''}
              <small class="text-muted d-block">${new Date(o.data).toLocaleDateString("pl-PL")}</small>
            </div>
          </div>
        </div>
      `).join("")}
    </div>`;
    if (total > DEFAULT_ITEMS_PER_PAGE) {
      paginationContainer.classList.remove("d-none");
      let html = `<nav><ul class="pagination justify-content-center mb-0">`;
      for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === page ? 'active' : ''}">
                   <a class="page-link" href="#" data-page="${i}">${i}</a>
                 </li>`;
      }
      html += `</ul></nav>`;
      paginationContainer.innerHTML = html;
      paginationContainer.querySelectorAll(".page-link").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          filterOpinie(parseInt(e.target.dataset.page));
        });
      });
    } else {
      paginationContainer.classList.add("d-none");
    }
  }

  document.getElementById("form-opinia").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ocena = document.querySelector('input[name="ocena"]:checked')?.value;
    const komentarz = document.getElementById("opinia-komentarz").value.trim();
    const msg = document.getElementById("opinia-message");
    const submitBtn = document.getElementById("submit-opinia");
    if (!ocena) {
      msg.textContent = "Wybierz ocenę.";
      msg.className = "text-danger";
      return;
    }
    const finalKomentarz = komentarz || null;
    const now = Date.now();
    if (now - lastOpiniaTime < OPINIA_COOLDOWN) {
      const remaining = Math.ceil((OPINIA_COOLDOWN - (now - lastOpiniaTime)) / 1000 / 60);
      msg.textContent = `Poczekaj ${remaining} minut przed kolejną opinią.`;
      msg.className = "text-warning";
      return;
    }
    submitBtn.disabled = true;
    msg.textContent = "Wysyłanie...";
    msg.className = "text-info";
    try {
      const res = await fetch("/api/opinie/dodaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocena: parseInt(ocena), komentarz: finalKomentarz })
      });
      const result = await res.json();
      msg.textContent = result.message;
      msg.className = result.success ? "text-success" : "text-danger";
      if (result.success) {
        e.target.reset();
        lastOpiniaTime = Date.now();
        await loadOpinie();
      }
    } catch (err) {
      msg.textContent = "Błąd wysyłania.";
      msg.className = "text-danger";
    } finally {
      submitBtn.disabled = false;
    }
  });

  buttons.opinie.addEventListener("click", () => {
    setActive("opinie");
    loadOpinie();
  });
});