(function () {
  'use strict';

  const MIN_PRICE = 3500;
  const URGENT_RATE = 1.2;
  const DESKTOP_QUERY = '(min-width: 1024px)';

  function formatPrice(value) {
    return value.toLocaleString('ru-RU') + ' ₽';
  }

  /* ---------- Меню ---------- */

  function initMenu() {
    const header = document.querySelector('.header');
    const burger = document.querySelector('.burger');
    const nav = document.getElementById('site-nav');
    if (!header || !burger || !nav) return;

    const desktop = window.matchMedia(DESKTOP_QUERY);

    function setOpen(isOpen) {
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
      nav.classList.toggle('nav--open', isOpen);
      document.body.classList.toggle('is-locked', isOpen);
    }

    function isOpen() {
      return burger.getAttribute('aria-expanded') === 'true';
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

    desktop.addEventListener('change', function (event) {
      if (event.matches) setOpen(false);
    });

    function updateHeaderShadow() {
      header.classList.toggle('header--scrolled', window.scrollY > 8);
    }

    window.addEventListener('scroll', updateHeaderShadow, { passive: true });
    updateHeaderShadow();
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
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  /* ---------- Калькулятор ---------- */

  function initCalculator() {
    const form = document.getElementById('calc-form');
    if (!form) return;

    const range = document.getElementById('calc-area-range');
    const areaInput = document.getElementById('calc-area');
    const urgentInput = document.getElementById('calc-urgent');
    const totalOutput = document.getElementById('calc-total');
    const stickyTotal = document.getElementById('calc-sticky-total');
    const breakdown = document.getElementById('calc-breakdown');
    const cta = document.getElementById('calc-cta');
    const minArea = Number(areaInput.min);
    const maxArea = Number(areaInput.max);

    function clampArea(value) {
      if (!Number.isFinite(value)) return minArea;
      return Math.min(maxArea, Math.max(minArea, Math.round(value)));
    }

    function getState() {
      return {
        area: clampArea(Number(areaInput.value)),
        type: form.querySelector('input[name="type"]:checked'),
        extras: Array.from(form.querySelectorAll('input[name="extra"]:checked')),
        urgent: urgentInput.checked
      };
    }

    function calculate(state) {
      const base = Math.max(state.area * Number(state.type.dataset.rate), MIN_PRICE);
      const extrasSum = state.extras.reduce(function (sum, input) {
        return sum + Number(input.dataset.price);
      }, 0);
      const subtotal = base + extrasSum;
      const urgentFee = state.urgent ? subtotal * (URGENT_RATE - 1) : 0;
      // итог округляем до 50 ₽, чтобы не показывать «копеечные» суммы
      const total = Math.round((subtotal + urgentFee) / 50) * 50;

      return { base: base, urgentFee: urgentFee, total: total };
    }

    function getLines(state, result) {
      const lines = [
        [state.type.dataset.label + ', ' + state.area + ' м²', result.base]
      ];
      state.extras.forEach(function (input) {
        lines.push([input.dataset.label, Number(input.dataset.price)]);
      });
      if (state.urgent) {
        lines.push(['Срочный выезд, +20%', Math.round(result.urgentFee)]);
      }
      return lines;
    }

    function renderBreakdown(lines) {
      breakdown.replaceChildren();
      lines.forEach(function (line) {
        const item = document.createElement('li');
        const label = document.createElement('span');
        const value = document.createElement('span');
        item.className = 'calc__breakdown-item';
        value.className = 'calc__breakdown-value';
        label.textContent = line[0];
        value.textContent = formatPrice(line[1]);
        item.append(label, value);
        breakdown.append(item);
      });
    }

    function updateRangeFill() {
      const percent = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--fill', percent + '%');
    }

    function render() {
      const state = getState();
      const result = calculate(state);
      totalOutput.textContent = formatPrice(result.total);
      stickyTotal.textContent = totalOutput.textContent;
      renderBreakdown(getLines(state, result));
      updateRangeFill();
    }

    range.addEventListener('input', function () {
      areaInput.value = range.value;
      render();
    });

    areaInput.addEventListener('input', function () {
      if (areaInput.value !== '') range.value = clampArea(Number(areaInput.value));
      render();
    });

    areaInput.addEventListener('change', function () {
      areaInput.value = clampArea(Number(areaInput.value));
      range.value = areaInput.value;
      render();
    });

    form.addEventListener('change', render);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
    });

    // переносим расчёт в комментарий заявки, чтобы клиенту не пришлось повторять
    cta.addEventListener('click', function () {
      const comment = document.getElementById('order-comment');
      if (!comment) return;
      const state = getState();
      const lines = getLines(state, calculate(state)).map(function (line) {
        return line[0];
      });
      comment.value = 'Расчёт: ' + lines.join('; ') + '. Итого ' + totalOutput.textContent + '.';
    });

    render();
  }

  /* ---------- FAQ ---------- */

  function initAccordion() {
    document.querySelectorAll('.faq__trigger').forEach(function (trigger) {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;

      trigger.addEventListener('click', function () {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
      });
    });
  }

  /* ---------- Форма заявки ---------- */

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
    if (!name) return 'Введите имя';
    if (name.length < 2) return 'Имя слишком короткое';
    if (!/^[a-zа-яё\s'-]+$/i.test(name)) return 'Используйте только буквы';
    return '';
  }

  function validatePhone(value) {
    if (!value.trim()) return 'Введите телефон';
    if (!normalizePhone(value)) return 'Проверьте номер: нужно 10 цифр после +7';
    return '';
  }

  function setFieldError(input, message) {
    const field = input.closest('.field');
    const error = document.getElementById(input.id + '-error');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    field.classList.toggle('field--error', Boolean(message));
    error.textContent = message;
  }

  function initOrderForm() {
    const form = document.getElementById('order-form');
    const success = document.getElementById('order-success');
    const againButton = document.getElementById('order-again');
    if (!form || !success) return;

    const rules = [
      { input: form.elements.name, validate: validateName },
      { input: form.elements.phone, validate: validatePhone }
    ];
    let submitted = false;

    function checkField(rule) {
      const message = rule.validate(rule.input.value);
      setFieldError(rule.input, message);
      return !message;
    }

    rules.forEach(function (rule) {
      rule.input.addEventListener('blur', function () {
        if (submitted || rule.input.value) checkField(rule);
      });
      rule.input.addEventListener('input', function () {
        if (rule.input.getAttribute('aria-invalid') === 'true') checkField(rule);
      });
    });

    form.elements.phone.addEventListener('blur', function () {
      const digits = normalizePhone(form.elements.phone.value);
      if (digits) form.elements.phone.value = formatPhone(digits);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitted = true;

      const invalid = rules.filter(function (rule) {
        return !checkField(rule);
      });

      if (invalid.length) {
        invalid[0].input.focus();
        return;
      }

      form.reset();
      submitted = false;
      form.hidden = true;
      success.hidden = false;
      success.focus();
    });

    againButton.addEventListener('click', function () {
      success.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
  }

  initMenu();
  initReveal();
  initCalculator();
  initAccordion();
  initOrderForm();
})();
