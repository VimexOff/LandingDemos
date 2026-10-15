(function () {
  'use strict';

  const DESKTOP_QUERY = '(min-width: 1024px)';
  const OPEN_HOUR = 10;
  const LAST_SLOT_HOUR = 21;
  const BOOKING_DAYS_AHEAD = 60;
  const JOURNAL_DAYS = 7;
  const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const CLIENT_NAMES = ['Олег', 'Денис', 'Игорь', 'Антон', 'Саша', 'Рома', 'Макс', 'Влад', 'Тимур', 'Никита', 'Паша', 'Егор'];

  /* ---------- Меню ---------- */

  function initMenu() {
    const burger = document.querySelector('.burger');
    const nav = document.getElementById('site-nav');
    if (!burger || !nav) return;

    function isOpen() {
      return burger.getAttribute('aria-expanded') === 'true';
    }

    function setOpen(open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      nav.classList.toggle('nav--open', open);
      document.body.classList.toggle('is-locked', open);
    }

    burger.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        burger.focus();
      }
    });

    window.matchMedia(DESKTOP_QUERY).addEventListener('change', function (event) {
      if (event.matches) setOpen(false);
    });
  }

  /* ---------- Появление секций ---------- */

  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (item) {
        item.classList.add('is-visible');
      });
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1 });

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  /* ---------- Даты ---------- */

  function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // toISOString() даёт дату в UTC, поэтому собираем строку из локальных значений
  function toInputDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  function parseInputDate(value) {
    const parts = value.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  // время записи на день; для сегодняшнего дня не раньше чем через полчаса
  function getTimes(dateValue) {
    const times = [];
    const now = new Date();
    const minMinutes = dateValue === toInputDate(now) ? now.getHours() * 60 + now.getMinutes() + 30 : 0;

    for (let hour = OPEN_HOUR; hour <= LAST_SLOT_HOUR; hour++) {
      [0, 30].forEach(function (minute) {
        if (hour * 60 + minute < minMinutes) return;
        times.push(String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'));
      });
    }
    return times;
  }

  /* ---------- Расписание ---------- */

  function hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i++) {
      result = (result * 31 + text.charCodeAt(i)) % 100003;
    }
    return result;
  }

  // Мастера и рабочие дни берём из разметки, чтобы не дублировать данные
  function readMasters() {
    const masters = {};
    document.querySelectorAll('.master[data-master]').forEach(function (row) {
      masters[row.dataset.master] = {
        name: row.querySelector('.master__name').textContent.split(' ')[0],
        days: row.dataset.days.split(',').map(Number)
      };
    });
    return masters;
  }

  function createSchedule(masters) {
    const booked = {};

    function key(dateValue, time, masterId) {
      return dateValue + '|' + time + '|' + masterId;
    }

    function works(masterId, dateValue) {
      return masters[masterId].days.includes(parseInputDate(dateValue).getDay());
    }

    // Для демо занятость условная, но стабильная: одна и та же клетка всегда занята одним и тем же клиентом
    function clientAt(dateValue, time, masterId) {
      const id = key(dateValue, time, masterId);
      if (booked[id]) return booked[id];
      const value = hash(id);
      return value % 100 < 35 ? CLIENT_NAMES[value % CLIENT_NAMES.length] : '';
    }

    function isFree(dateValue, time, masterId) {
      return works(masterId, dateValue) && !clientAt(dateValue, time, masterId);
    }

    function freeMasters(dateValue, time) {
      return Object.keys(masters).filter(function (masterId) {
        return isFree(dateValue, time, masterId);
      });
    }

    function freeTimes(dateValue, masterId) {
      return getTimes(dateValue).filter(function (time) {
        return masterId === 'any' ? freeMasters(dateValue, time).length > 0 : isFree(dateValue, time, masterId);
      });
    }

    function book(dateValue, time, masterId, clientName) {
      booked[key(dateValue, time, masterId)] = clientName;
    }

    return {
      masters: masters,
      works: works,
      clientAt: clientAt,
      freeMasters: freeMasters,
      freeTimes: freeTimes,
      book: book
    };
  }

  /* ---------- Валидация ---------- */

  function normalizePhone(value) {
    let digits = value.replace(/\D/g, '');
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
      digits = digits.slice(1);
    }
    return digits.length === 10 ? digits : '';
  }

  function formatPhone(digits) {
    return '+7 (' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' +
      digits.slice(6, 8) + '-' + digits.slice(8);
  }

  function validateName(value) {
    const name = value.trim();
    if (!name) return 'Как к вам обращаться?';
    if (name.length < 2) return 'Имя слишком короткое';
    if (!/^[a-zа-яё\s'-]+$/i.test(name)) return 'Только буквы, без цифр';
    return '';
  }

  function validatePhone(value) {
    if (!value.trim()) return 'Нужен телефон, чтобы подтвердить запись';
    if (!normalizePhone(value)) return 'Не хватает цифр: нужно 10 после +7';
    return '';
  }

  function setFieldError(input, message) {
    const error = document.getElementById(input.id + '-error');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    input.closest('.field').classList.toggle('field--error', Boolean(message));
    if (error) error.textContent = message;
  }

  /* ---------- Форма записи ---------- */

  function initBooking(schedule, onBooked) {
    const form = document.getElementById('booking-form');
    const success = document.getElementById('booking-success');
    if (!form || !success) return null;

    const fields = form.elements;
    const masters = schedule.masters;
    const today = startOfToday();
    let submitted = false;

    fields.date.min = toInputDate(today);
    fields.date.max = toInputDate(addDays(today, BOOKING_DAYS_AHEAD));

    function validateDate(value) {
      if (!value) return 'Выберите день';
      const date = parseInputDate(value);
      if (Number.isNaN(date.getTime())) return 'Не получается разобрать дату';
      if (date < today) return 'Этот день уже прошёл';
      if (date > addDays(today, BOOKING_DAYS_AHEAD)) return 'Записываем не дальше чем на 60 дней';

      const masterId = fields.master.value;
      if (masterId !== 'any' && !schedule.works(masterId, value)) {
        const days = masters[masterId].days.slice().sort(function (a, b) {
          return ((a + 6) % 7) - ((b + 6) % 7);
        }).map(function (day) {
          return DAY_NAMES[day];
        });
        return masters[masterId].name + ' в этот день не работает. Его дни: ' + days.join(', ');
      }
      if (!schedule.freeTimes(value, masterId).length) return 'На этот день всё занято, выберите другой';
      return '';
    }

    // пока дата не выбрана, ошибку показываем только у даты
    function validateTime(value) {
      return value || !fields.date.value ? '' : 'Выберите время';
    }

    const rules = {
      name: validateName,
      phone: validatePhone,
      date: validateDate,
      time: validateTime
    };

    function checkField(name) {
      const message = rules[name](fields[name].value);
      setFieldError(fields[name], message);
      return !message;
    }

    function renderTimeOptions() {
      const select = fields.time;
      const previous = select.value;
      const dateValue = fields.date.value;
      const ready = dateValue && !validateDate(dateValue);
      const free = ready ? schedule.freeTimes(dateValue, fields.master.value) : [];

      select.replaceChildren(new Option(dateValue ? 'Выберите время' : 'Сначала выберите дату', ''));
      (ready ? getTimes(dateValue) : []).forEach(function (time) {
        const isFree = free.includes(time);
        const option = new Option(isFree ? time : time + ' (занято)', time);
        option.disabled = !isFree;
        select.append(option);
      });
      select.disabled = !free.length;
      if (free.includes(previous)) select.value = previous;
    }

    function revalidateDate() {
      if (!fields.date.value) return;
      renderTimeOptions();
      checkField('date');
    }

    function goToForm() {
      document.querySelector('.booking').scrollIntoView();
      fields.name.focus({ preventScroll: true });
    }

    Object.keys(rules).forEach(function (name) {
      fields[name].addEventListener('blur', function () {
        if (submitted || fields[name].value) checkField(name);
      });
      fields[name].addEventListener('input', function () {
        if (fields[name].getAttribute('aria-invalid') === 'true') checkField(name);
      });
    });

    fields.phone.addEventListener('blur', function () {
      const digits = normalizePhone(fields.phone.value);
      if (digits) fields.phone.value = formatPhone(digits);
    });

    fields.date.addEventListener('change', function () {
      renderTimeOptions();
      checkField('date');
    });

    fields.master.addEventListener('change', revalidateDate);

    fields.time.addEventListener('change', function () {
      checkField('time');
    });

    document.querySelectorAll('[data-book-master]').forEach(function (button) {
      button.addEventListener('click', function () {
        fields.master.value = button.dataset.bookMaster;
        revalidateDate();
        goToForm();
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitted = true;

      const invalid = Object.keys(rules).filter(function (name) {
        return !checkField(name);
      });

      if (invalid.length) {
        fields[invalid[0]].focus();
        return;
      }

      const dateValue = fields.date.value;
      const time = fields.time.value;
      const masterId = fields.master.value === 'any'
        ? schedule.freeMasters(dateValue, time)[0]
        : fields.master.value;
      const day = parseInputDate(dateValue).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

      schedule.book(dateValue, time, masterId, fields.name.value.trim().split(' ')[0]);
      document.getElementById('booking-success-text').textContent =
        masters[masterId].name + ' ждёт вас ' + day + ' в ' + time +
        '. Администратор перезвонит, чтобы подтвердить запись.';

      form.reset();
      submitted = false;
      renderTimeOptions();
      form.hidden = true;
      success.hidden = false;
      success.focus();
      onBooked(dateValue);
    });

    document.getElementById('booking-again').addEventListener('click', function () {
      success.hidden = true;
      form.hidden = false;
      fields.name.focus();
    });

    renderTimeOptions();

    return {
      // подставляет выбранную в журнале клетку в форму
      pick: function (dateValue, time, masterId) {
        success.hidden = true;
        form.hidden = false;
        fields.master.value = masterId;
        fields.date.value = dateValue;
        renderTimeOptions();
        fields.time.value = time;
        setFieldError(fields.date, '');
        setFieldError(fields.time, '');
        goToForm();
      }
    };
  }

  /* ---------- Журнал записи ---------- */

  function initJournal(schedule, onPick) {
    const daysBox = document.getElementById('journal-days');
    const table = document.getElementById('journal-table');
    if (!daysBox || !table) return null;

    const masterIds = Object.keys(schedule.masters);
    const today = startOfToday();
    const dates = [];
    for (let i = 0; i < JOURNAL_DAYS; i++) {
      dates.push(addDays(today, i));
    }

    // по умолчанию открываем первый день, где есть свободное время
    let current = toInputDate(dates.find(function (date) {
      return schedule.freeTimes(toInputDate(date), 'any').length;
    }) || today);

    function cell(tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text) element.textContent = text;
      return element;
    }

    function hiddenText(text) {
      return cell('span', 'visually-hidden', text);
    }

    function renderDays() {
      daysBox.replaceChildren();
      dates.forEach(function (date, index) {
        const value = toInputDate(date);
        const button = cell('button', 'journal__day');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(value === current));
        button.append(
          index === 0 ? 'Сегодня' : DAY_NAMES[date.getDay()],
          document.createElement('br'),
          date.getDate() + '.' + String(date.getMonth() + 1).padStart(2, '0')
        );
        button.addEventListener('click', function () {
          current = value;
          render();
        });
        daysBox.append(button);
      });
    }

    function renderHead() {
      const row = document.createElement('tr');
      row.append(cell('th', '', 'Время'));
      masterIds.forEach(function (masterId) {
        const th = cell('th', '', schedule.masters[masterId].name);
        th.scope = 'col';
        if (!schedule.works(masterId, current)) th.append(cell('span', 'journal__off-label', 'выходной'));
        row.append(th);
      });
      const head = document.createElement('thead');
      head.append(row);
      return head;
    }

    function renderSlot(time, masterId) {
      const td = document.createElement('td');
      const masterName = schedule.masters[masterId].name;

      if (!schedule.works(masterId, current)) {
        td.className = 'journal__cell--off';
        td.append(hiddenText('выходной'));
        return td;
      }

      const client = schedule.clientAt(current, time, masterId);
      if (client) {
        td.append(cell('span', 'journal__client', client), hiddenText(', занято'));
        return td;
      }

      const button = cell('button', 'journal__free', 'свободно');
      button.type = 'button';
      button.setAttribute('aria-label', time + ', ' + masterName + ', свободно. Записаться');
      button.addEventListener('click', function () {
        onPick(current, time, masterId);
      });
      td.append(button);
      return td;
    }

    function renderBody() {
      const body = document.createElement('tbody');
      const times = getTimes(current);

      if (!times.length) {
        const row = document.createElement('tr');
        const td = cell('td', 'journal__empty', 'На сегодня запись закончилась, выберите другой день.');
        td.colSpan = masterIds.length + 1;
        row.append(td);
        body.append(row);
        return body;
      }

      times.forEach(function (time) {
        const row = document.createElement('tr');
        const th = cell('th', 'journal__time', time);
        th.scope = 'row';
        row.append(th);
        masterIds.forEach(function (masterId) {
          row.append(renderSlot(time, masterId));
        });
        body.append(row);
      });
      return body;
    }

    function render() {
      renderDays();
      table.replaceChildren(renderHead(), renderBody());
    }

    render();

    return {
      show: function (dateValue) {
        if (dates.some(function (date) { return toInputDate(date) === dateValue; })) current = dateValue;
        render();
      }
    };
  }

  initMenu();
  initReveal();

  const schedule = createSchedule(readMasters());
  let journal = null;
  const booking = initBooking(schedule, function (dateValue) {
    if (journal) journal.show(dateValue);
  });
  if (booking) journal = initJournal(schedule, booking.pick);
})();
