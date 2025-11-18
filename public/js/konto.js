// public/js/konto.js
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const phoneInput = document.getElementById('regPhone');
  const firstNameInput = document.getElementById('regFirstName');
  const lastNameInput = document.getElementById('regLastName');
  const peselInput = document.getElementById('regPesel');
  const forgotLink = document.getElementById('forgotPasswordLink');
  const forgotForm = document.getElementById('forgotPasswordForm');
  const resetForm = document.getElementById('resetPasswordForm');

  // BLOKADA WPISYWANIA
  if (firstNameInput) {
    firstNameInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\- ]/g, '').slice(0, 30);
    });
  }

  if (lastNameInput) {
    lastNameInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\- ]/g, '').slice(0, 50);
    });
  }

  if (peselInput) {
    peselInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 9) value = value.slice(0, 9);
      if (value.length > 6) {
        value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6);
      } else if (value.length > 3) {
        value = value.slice(0, 3) + ' ' + value.slice(3);
      }
      e.target.value = value;
    });
  }

  // FUNKCJA KOMUNIKATU
  function showMessage(text, type) {
    const msgBox = document.getElementById('authMessage');
    const msgText = msgBox.querySelector('p');
    const msgDiv = msgBox.querySelector('div');

    msgText.textContent = text;
    msgDiv.className = `p-3 rounded-3 text-center bg-${type === 'success' ? 'success' : 'danger'} text-white`;
    msgBox.style.display = 'block';
    msgBox.classList.remove('d-none');
  }

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

  // === FORMATOWANIE PESEL ===
  function formatPesel(input) {
    let value = input.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 9) {
      value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6, 8) + ' ' + value.slice(8);
    } else if (value.length > 6) {
      value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6);
    } else if (value.length > 3) {
      value = value.slice(0, 3) + ' ' + value.slice(3);
    }
    input.value = value;
  }

  // REJESTRACJA
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const termsCheckbox = document.getElementById('terms');
      if (!termsCheckbox.checked) {
        showMessage('Musisz zaakceptować regulamin i politykę prywatności.', 'danger');
        return;
      }

      const cleanPhone = (phoneInput?.value || '').replace(/[^0-9]/g, '').trim();

      const data = {
        regFirstName: document.getElementById('regFirstName').value.trim(),
        regLastName: document.getElementById('regLastName').value.trim(),
        regPhone: cleanPhone,
        regEmail: document.getElementById('regEmail').value.trim(),
        regBirthdate: document.getElementById('regBirthdate').value,
        regPesel: document.getElementById('regPesel').value.trim().replace(/\s/g, '') || null,
        regPassword: document.getElementById('regPassword').value,
        regConfirm: document.getElementById('regConfirm').value
      };

      if (!validateRegister(data)) return;

      try {
        const res = await fetch('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
          showMessage('Zostałeś pomyślnie zarejestrowany!', 'success');
          setTimeout(() => {
            document.querySelector('#login-tab').click();
            registerForm.reset();
            if (phoneInput) phoneInput.value = '';
            if (peselInput) peselInput.value = '';
          }, 1500);
        } else {
          let message = result.message || 'Wystąpił błąd';
          if (message.includes('email')) message = 'E-mail już istnieje';
          if (message.includes('telefon')) message = 'Ten numer telefonu jest już zajęty';
          if (message.includes('PESEL')) message = 'Ten PESEL jest już w systemie';
          showMessage(message, 'danger');
        }
      } catch (err) {
        console.error(err);
        showMessage('Błąd połączenia z serwerem', 'danger');
      }
    });
  }

  // LOGOWANIE
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        showMessage('Wypełnij wszystkie pola', 'danger');
        return;
      }

      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (data.success) {
          showMessage('Zalogowano pomyślnie!', 'success');
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else {
          showMessage(data.message || 'Nieprawidłowy e-mail lub hasło', 'danger');
        }
      } catch (err) {
        console.error(err);
        showMessage('Błąd połączenia z serwerem', 'danger');
      }
    });
  }

  // KOMUNIKAT PO WYLOGOWANIU Z URL
  if (window.location.search.includes('logout=success')) {
    showMessage('Zostałeś wylogowany!', 'success');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }

// WALIDACJA
function validateRegister(d) {
  const nameRegex = /^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\- ]+$/;

  if (!d.regFirstName || !nameRegex.test(d.regFirstName)) {
    showMessage('Imię: tylko litery, spacja i myślnik', 'danger');
    return false;
  }
  if (!d.regLastName || !nameRegex.test(d.regLastName)) {
    showMessage('Nazwisko: tylko litery, spacja i myślnik', 'danger');
    return false;
  }
  if (!d.regPhone || !/^\d{9}$/.test(d.regPhone)) {
    showMessage('Podaj 9-cyfrowy numer telefonu!', 'danger');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!d.regEmail || !emailRegex.test(d.regEmail)) {
    showMessage('Niepoprawny adres e-mail', 'danger');
    return false;
  }

  if (!d.regBirthdate) {
    showMessage('Wybierz datę urodzenia', 'danger');
    return false;
  }

  const birth = new Date(d.regBirthdate);
  const today = new Date();
  if (birth > today || birth.getFullYear() < 1900) {
    showMessage('Niepoprawna data urodzenia', 'danger');
    return false;
  }

  if (!d.regPassword || d.regPassword.length < 8) {
    showMessage('Hasło musi mieć minimum 8 znaków', 'danger');
    return false;
  }

  if (d.regPassword !== d.regConfirm) {
    showMessage('Hasła się różnią', 'danger');
    return false;
  }

  if (d.regPesel) {
    if (!/^\d{11}$/.test(d.regPesel)) {
      showMessage('PESEL musi mieć dokładnie 11 cyfr.', 'danger');
      return false;
    }
    if (!validatePesel(d.regPesel)) {
      showMessage('Nieprawidłowa suma kontrolna PESEL.', 'danger');
      return false;
    }
  }

  return true;
}

  // Formatowanie PESEL przy wpisywaniu
  if (peselInput) {
    peselInput.addEventListener('input', () => formatPesel(peselInput));
    peselInput.addEventListener('focus', () => {
      peselInput.value = peselInput.value.replace(/\s/g, '');
    });
    peselInput.addEventListener('blur', () => formatPesel(peselInput));
  }

  // === RESET HASŁA – OTWÓRZ MODAL ===
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
      modal.show();
    });
  }

  // === WYSYŁKA E-MAILA RESET ===
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmail').value.trim();
      if (!email) {
        showMessage('Podaj e-mail', 'danger');
        return;
      }
      try {
        const res = await fetch('/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const result = await res.json();
        showMessage(result.message, result.success ? 'success' : 'danger');
        if (result.success) {
          forgotForm.reset();
          bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal')).hide();
        }
      } catch (err) {
        showMessage('Błąd połączenia', 'danger');
      }
    });
  }

  // === ZMIANA HASŁA PO LINKU ===
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset');
  if (resetToken) {
    document.getElementById('resetToken').value = resetToken;
    const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
    modal.show();
  }

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('resetToken').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      if (newPassword !== confirmPassword) {
        showMessage('Hasła się różnią', 'danger');
        return;
      }
      if (newPassword.length < 8) {
        showMessage('Hasło musi mieć min. 8 znaków', 'danger');
        return;
      }
      try {
        const res = await fetch('/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword })
        });
        const result = await res.json();
        showMessage(result.message, result.success ? 'success' : 'danger');
        if (result.success) {
          resetForm.reset();
          bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal')).hide();
          setTimeout(() => window.location.href = '/konto', 1500);
        }
      } catch (err) {
        showMessage('Błąd połączenia', 'danger');
      }
    });
  }
});

// FUNKCJA: Wylogowanie z komunikatem OD RAZU
function handleLogout(event) {
  event.preventDefault();
  
  if (typeof showMessage === 'function') {
    showMessage('Zostałeś wylogowany!', 'success');
  }
  
  fetch('/logout', { method: 'GET', credentials: 'include' })
    .then(() => {
      setTimeout(() => {
        window.location.href = '/konto';
      }, 800);
    })
    .catch(() => {
      setTimeout(() => {
        window.location.href = '/konto';
      }, 800);
    });
}