/* Serenis validation MVP — single-page funnel.
   Landing → reflection → result → application → price test → done.
   No cookies, no localStorage: a random session id lives in memory for one visit. */
(function () {
  "use strict";

  var C = window.SERENIS_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var isLocal = ["localhost", "127.0.0.1"].indexOf(location.hostname) !== -1;

  // Local testing only: allow endpoint/contact overrides via query string.
  var endpoint = (isLocal && params.get("endpoint")) || C.endpoint || "";
  var contactEmail = (isLocal && params.get("contact")) || C.contactEmail || "";
  var isOpen = Boolean(endpoint && contactEmail);
  var isTest = params.get("test") === "1" || (isLocal && params.get("test") !== "0");

  function rid(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  var sid = rid(8);
  var arms = Array.isArray(C.priceArms) && C.priceArms.length ? C.priceArms : [29, 39, 49];
  var priceArm = arms[Math.floor(Math.random() * arms.length)];

  var HEROES = {
    a: {
      title: "Fiecare întâlnire are loc — sau nu plătești.",
      lede: "Serenis nu e o aplicație de swipe. Te prezentăm doar cuiva care merită cunoscut. Dacă amândoi spuneți da, întâlnirea se confirmă — și abia atunci plătești. Dacă celălalt nu apare, îți dăm banii înapoi."
    },
    b: {
      title: "Mai bine niciun match decât unul greșit.",
      lede: "Nu-ți arătăm sute de profiluri. Te prezentăm doar când găsim pe cineva care chiar merită o seară din viața ta. Dacă amândoi spuneți da, întâlnirea se confirmă — și abia atunci plătești."
    },
    c: {
      title: "Nu-ți lipsesc match-urile. Îți lipsesc întâlnirile.",
      lede: "Aplicațiile sunt construite să te țină pe ecran. Serenis e construit să te scoată de acolo: o introducere atentă, un da de ambele părți, o întâlnire confirmată. Plătești doar dacă are loc."
    }
  };
  var variant = HEROES[(params.get("h") || "").toLowerCase()] ? params.get("h").toLowerCase() : "a";

  var referrerHost = "";
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { referrerHost = ""; }
  if (referrerHost === location.hostname) referrerHost = "";

  var ctx = {
    variant: variant,
    price_arm: priceArm,
    utm_source: (params.get("utm_source") || "").slice(0, 40),
    utm_medium: (params.get("utm_medium") || "").slice(0, 40),
    utm_campaign: (params.get("utm_campaign") || "").slice(0, 60),
    ref: (params.get("ref") || "").replace(/[^a-z0-9]/gi, "").slice(0, 16),
    referrer_host: referrerHost.slice(0, 80),
    device: window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop",
    test: isTest ? 1 : 0
  };

  // ── transport ────────────────────────────────────────────
  function post(type, payload, keepalive) {
    if (!isOpen) return Promise.resolve({ ok: false, closed: true });
    var body = JSON.stringify(Object.assign({ type: type, sid: sid, ctx: ctx, ts_client: new Date().toISOString() }, payload));
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      keepalive: Boolean(keepalive),
      redirect: "follow"
    }).then(function (r) { return r.json(); });
  }
  var fired = {};
  function track(event, data, once) {
    if (once) { if (fired[event]) return; fired[event] = true; }
    post("event", { event: event, data: data || {} }, true).catch(function () {});
  }

  // ── dom helpers ──────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function setText(sel, text) { $$(sel).forEach(function (el) { el.textContent = text; }); }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  var current = "landing";
  function show(name, push) {
    $$(".screen").forEach(function (s) { s.classList.toggle("is-active", s.getAttribute("data-screen") === name); });
    current = name;
    if (push !== false) history.pushState({ screen: name, q: qIndex }, "", location.pathname + location.search);
    window.scrollTo(0, 0);
    var h = $('[data-screen="' + name + '"] h1');
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  // ── hero + static config ─────────────────────────────────
  $("[data-hero-title]").textContent = HEROES[variant].title;
  $("[data-hero-lede]").textContent = HEROES[variant].lede;
  if (C.controller) setText("[data-controller]", C.controller);
  setText("[data-price]", String(priceArm));

  // ── reflection ───────────────────────────────────────────
  var QUESTIONS = [
    { id: "intent", title: "Ce cauți, sincer, în acest moment?", options: [
      ["lt", "O relație pe termen lung"],
      ["serious", "Ceva serios, dacă apare persoana potrivită"],
      ["unsure", "Încă îmi dau seama"],
      ["casual", "Ceva relaxat, fără așteptări"]] },
    { id: "capacity", title: "Dacă mâine ai cunoaște pe cineva cu adevărat potrivit, ai avea loc pentru el sau ea în viața ta?", options: [
      ["now", "Da — mi-aș face loc chiar săptămâna asta"],
      ["tight", "Da, deși programul meu e destul de plin"],
      ["no", "Sincer, nu prea, în perioada asta"]] },
    { id: "last_rel", title: "Ultima ta relație importantă s-a încheiat…", options: [
      ["12plus", "De peste un an"],
      ["6to12", "În ultimul an"],
      ["under6", "În ultimele șase luni"],
      ["ongoing", "Nu s-a încheiat complet încă"],
      ["none", "N-am avut încă o relație importantă"]] },
    { id: "last_date", title: "Ultima dată când ai fost la o primă întâlnire:", options: [
      ["month", "Luna aceasta"],
      ["3m", "În ultimele trei luni"],
      ["12m", "Acum trei până la douăsprezece luni"],
      ["year_plus", "De peste un an"]] },
    { id: "fatigue", title: "Ce te-a obosit cel mai mult în dating?", options: [
      ["nodate", "Match-uri care nu ajung niciodată la o întâlnire"],
      ["unclear", "Oameni care nu știu ce vor"],
      ["chat", "Conversații care mor după trei mesaje"],
      ["ghost", "Oameni care dispar sau nu apar"],
      ["overload", "Prea multe opțiuni, prea puțină substanță"],
      ["fresh", "Încă nimic — abia încep"]] },
    { id: "pace", title: "Când cunoști pe cineva nou, ce e mai adevărat pentru tine?", options: [
      ["fast", "Prefer să ne vedem repede și să văd dacă e ceva acolo"],
      ["slow", "Am nevoie de câteva conversații înainte să mă văd cu cineva"]] }
  ];
  var answers = {};
  var qIndex = 0;
  var result = null;

  function renderQuestion() {
    var q = QUESTIONS[qIndex];
    $("[data-reflection-intro]").hidden = qIndex !== 0;
    $("[data-q-count]").textContent = "Întrebarea " + (qIndex + 1) + " din " + QUESTIONS.length;
    $("[data-progress]").style.width = ((qIndex) / QUESTIONS.length * 100) + "%";
    $("[data-q-title]").textContent = q.title;
    var box = $("[data-q-options]");
    box.innerHTML = "";
    q.options.forEach(function (o) {
      var b = el("button", { "class": "option" + (answers[q.id] === o[0] ? " is-selected" : ""), type: "button" }, o[1]);
      b.addEventListener("click", function () { answer(q.id, o[0]); });
      box.appendChild(b);
    });
  }

  function answer(id, value) {
    answers[id] = value;
    track("reflection_answer", { q: id, a: value });
    if (qIndex < QUESTIONS.length - 1) {
      qIndex += 1;
      renderQuestion();
      history.pushState({ screen: "reflection", q: qIndex }, "", location.pathname + location.search);
      window.scrollTo(0, 0);
    } else {
      $("[data-progress]").style.width = "100%";
      result = computeResult(answers);
      track("reflection_complete", { result: result, answers: answers }, true);
      renderResult();
      show("result");
    }
  }

  function computeResult(a) {
    if (a.intent === "casual") return "not_now";
    if (a.intent === "unsure" || a.capacity === "no" || a.last_rel === "ongoing") return "almost";
    return "ready";
  }

  var FATIGUE = {
    nodate: "Spui că te-au obosit match-urile care nu ajung niciodată la o întâlnire. La Serenis, un da de ambele părți nu duce la încă o conversație, ci la o întâlnire confirmată.",
    unclear: "Spui că te-au obosit oamenii care nu știu ce vor. De aceea întrebăm, înainte de orice, exact ce te-am întrebat și pe tine.",
    chat: "Spui că te-au obosit conversațiile care mor după trei mesaje. La Serenis, conversația care contează are loc față în față.",
    ghost: "Spui că te-au obosit oamenii care dispar sau nu apar. De aceea plătești doar întâlnirea confirmată — iar dacă celălalt nu apare, banii se întorc la tine.",
    overload: "Spui că te-au obosit prea multe opțiuni și prea puțină substanță. Noi îți arătăm mai puțin, intenționat.",
    fresh: "Abia începi. E cel mai bun moment să nu-ți formezi obiceiul swipe-ului."
  };

  function resultCopy(r, a) {
    if (r === "not_now") {
      return {
        title: "Serenis probabil nu e ce cauți acum.",
        body: [
          "Construim Serenis pentru oameni care își doresc o relație pe termen lung. Dacă acum vrei ceva relaxat, o aplicație obișnuită îți va servi mai bine — și e perfect în regulă.",
          "Dacă se schimbă ceva, te așteptăm."
        ]
      };
    }
    if (r === "almost") {
      var why = a.capacity === "no"
        ? "Spui că în perioada asta nu prea ai loc pentru cineva nou. E mai bine să știi asta acum decât după a treia întâlnire amânată."
        : a.last_rel === "ongoing"
          ? "Spui că ultima ta relație nu s-a încheiat complet. Merită să-i dai spațiul ăsta înainte să faci loc altcuiva."
          : "Spui că încă îți dai seama ce cauți. E un răspuns onest — și mai rar decât crezi.";
      return {
        title: "Poate că momentul tău e aproape.",
        body: [
          "Serenis funcționează cel mai bine pentru oameni care au, acum, loc pentru cineva nou.",
          why,
          FATIGUE[a.fatigue],
          "Poți aplica oricum. Îți scriem când Sezonul Fondator se deschide, iar tu decizi atunci dacă e momentul."
        ]
      };
    }
    return {
      title: "Ești într-un moment bun pentru ceva real.",
      body: [
        a.intent === "lt"
          ? "Știi ce cauți: o relație pe termen lung. Sună simplu, dar e exact lucrul pe care cei mai mulți oameni din aplicații nu-l spun clar."
          : "Vrei ceva serios, dacă apare persoana potrivită. E o poziție matură: nu forțezi nimic, dar nici nu închizi ușa.",
        a.capacity === "now"
          ? "Și ai loc pentru cineva nou chiar acum. Asta contează mai mult decât orice algoritm."
          : "Programul tău e plin — motiv în plus să nu-ți mai pierzi serile pe conversații care nu duc nicăieri.",
        FATIGUE[a.fatigue],
        a.pace === "fast"
          ? "Și preferi să vezi repede dacă e ceva acolo. Exact așa funcționează Serenis."
          : "Ai nevoie de câteva conversații înainte de o întâlnire — e firesc. De aceea îți spunem de ce credem că merită să vă cunoașteți, ca prima întâlnire să nu fie un salt în gol.",
        "Pentru oameni exact în acest punct construim Sezonul Fondator."
      ]
    };
  }

  function renderResult() {
    var copy = resultCopy(result, answers);
    $("[data-result-title]").textContent = copy.title;
    var body = $("[data-result-body]");
    body.innerHTML = "";
    copy.body.filter(Boolean).forEach(function (t) { body.appendChild(el("p", {}, t)); });
    var cta = $("[data-result-cta]");
    cta.innerHTML = "";
    if (result === "not_now") {
      cta.appendChild(button("Mi-am schimbat răspunsul", "btn btn-ghost", restartReflection));
      cta.appendChild(button("Înapoi la început", "btn btn-ghost", goHome));
    } else {
      cta.appendChild(button(result === "ready" ? "Continuă spre aplicație" : "Aplică oricum", "btn btn-primary", openApplication));
      if (result === "almost") cta.appendChild(button("Revin altă dată", "btn btn-ghost", goHome));
    }
  }

  function button(label, cls, fn) {
    var b = el("button", { "class": cls, type: "button" }, label);
    b.addEventListener("click", fn);
    return b;
  }

  function startReflection(where) {
    track("reflection_start", { cta: where || "" }, true);
    qIndex = 0;
    renderQuestion();
    show("reflection");
  }
  function restartReflection() { answers = {}; startReflection("restart"); }
  function goHome() { show("landing"); }

  // ── application ──────────────────────────────────────────
  var form = $("[data-form]");
  var appId = null;
  var applicant = null;

  (function fillAges() {
    ["age_min", "age_max"].forEach(function (name) {
      var s = form.elements[name];
      s.appendChild(el("option", { value: "" }, name === "age_min" ? "De la" : "Până la"));
      for (var i = 18; i <= 65; i++) s.appendChild(el("option", { value: String(i) }, String(i)));
    });
  })();

  $$('input[name="city"]', form).forEach(function (r) {
    r.addEventListener("change", function () { $("[data-city-other]").hidden = form.elements.city.value !== "other"; });
  });

  function openApplication() {
    $("[data-closed]").hidden = isOpen;
    form.hidden = !isOpen;
    track("application_view", { result: result }, true);
    show("apply");
  }

  function readForm() {
    var f = form.elements;
    var availability = $$('input[name="availability"]:checked', form).map(function (i) { return i.value; });
    return {
      first_name: f.first_name.value.trim(),
      email: f.email.value.trim().toLowerCase(),
      age: parseInt(f.age.value, 10),
      gender: f.gender.value,
      seeking: f.seeking.value,
      age_min: parseInt(f.age_min.value, 10),
      age_max: parseInt(f.age_max.value, 10),
      city: f.city.value,
      city_other: f.city.value === "other" ? f.city_other.value.trim() : "",
      availability: availability,
      reason: f.reason.value,
      source: f.source.value,
      consent_privacy: f.consent_privacy.checked,
      consent_preference: f.consent_preference.checked,
      website: f.website.value
    };
  }

  function validate(d) {
    if (!d.first_name) return "Scrie-ne prenumele tău.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return "Adresa de email nu pare corectă.";
    if (!(d.age >= 18 && d.age <= 99)) return "Serenis e doar pentru persoane de peste 18 ani. Verifică vârsta.";
    if (!d.gender) return "Alege cum te descrii.";
    if (!d.seeking) return "Spune-ne pe cine vrei să cunoști.";
    if (!(d.age_min >= 18) || !(d.age_max >= 18)) return "Alege intervalul de vârstă care te interesează.";
    if (d.age_min > d.age_max) return "Vârsta minimă nu poate fi mai mare decât cea maximă.";
    if (!d.city) return "Spune-ne unde locuiești.";
    if (!d.availability.length) return "Alege măcar un moment în care ai putea ieși.";
    if (!d.reason) return "Spune-ne ce te-a făcut să aplici.";
    if (!d.source) return "Spune-ne cum ai aflat de Serenis.";
    if (!d.consent_privacy || !d.consent_preference) return "Avem nevoie de ambele acorduri ca să-ți putem evalua aplicația.";
    return "";
  }

  function qualified(d) {
    var pool = (d.gender === "f" && d.seeking === "m") || (d.gender === "m" && d.seeking === "f");
    return d.age >= 25 && d.age <= 38 && (d.city === "bucuresti" || d.city === "ilfov") &&
      (answers.intent === "lt" || answers.intent === "serious") && pool;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $("[data-form-error]");
    var d = readForm();
    var msg = validate(d);
    if (msg) { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: "center" }); return; }
    err.hidden = true;
    if (d.website) { show("done"); return; } // honeypot: silently stop bots
    var btn = $("[data-submit]");
    btn.disabled = true; btn.textContent = "Se trimite…";
    appId = appId || rid(6);
    var payload = Object.assign({}, d, { app_id: appId, reflection: answers, result: result });
    delete payload.website;
    post("application", { application: payload })
      .then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || "failed");
        applicant = d;
        track("application_submit", { app_id: appId, qualified: qualified(d) ? 1 : 0, gender: d.gender, city: d.city });
        track("price_shown", { price: priceArm, app_id: appId }, true);
        show("price");
      })
      .catch(function () {
        err.textContent = "N-am putut trimite aplicația. Verifică conexiunea și încearcă din nou.";
        err.hidden = false;
      })
      .then(function () { btn.disabled = false; btn.textContent = "Trimite aplicația"; });
  });

  // ── price test ───────────────────────────────────────────
  var priceChoice = null;
  $$("[data-price-choice]").forEach(function (b) {
    b.addEventListener("click", function () {
      priceChoice = b.getAttribute("data-price-choice");
      $$("[data-price-choice]").forEach(function (x) { x.classList.toggle("is-selected", x === b); });
      if (priceChoice === "lower") {
        $("[data-price-max]").hidden = false;
        $('[name="price_max"]').focus();
      } else {
        submitPrice(null);
      }
    });
  });
  $('[data-action="price-max-continue"]').addEventListener("click", function () {
    var v = parseInt($('[name="price_max"]').value, 10);
    if (!(v >= 0 && v <= 500)) {
      var e = $("[data-price-error]"); e.textContent = "Scrie o sumă între 0 și 500 de lei."; e.hidden = false; return;
    }
    submitPrice(v);
  });

  function submitPrice(max) {
    var data = { app_id: appId, price: priceArm, choice: priceChoice, max: max };
    track("price_selected", data, true);
    post("price", { price: data }).catch(function () {
      return post("price", { price: data }).catch(function () {});
    });
    finish();
  }

  function finish() {
    setText("[data-first-name]", applicant ? applicant.first_name : "");
    setText("[data-email]", applicant ? applicant.email : "");
    var link = $("[data-contact-link]");
    link.textContent = contactEmail;
    link.setAttribute("href", "mailto:" + contactEmail);
    track("confirm_view", { app_id: appId }, true);
    show("done");
  }

  // ── share ────────────────────────────────────────────────
  $('[data-action="share"]').addEventListener("click", function () {
    var url = location.origin + location.pathname + "?ref=" + (appId || "");
    var status = $("[data-share-status]");
    track("share_click", { app_id: appId });
    if (navigator.share) {
      navigator.share({ title: "Serenis", text: "Fiecare întâlnire are loc — sau nu plătești.", url: url }).catch(function () {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(function () { status.textContent = "Linkul a fost copiat."; })
      .catch(function () { status.textContent = url; });
  });

  // ── wiring ───────────────────────────────────────────────
  $$('[data-action="start"]').forEach(function (b) {
    b.addEventListener("click", function () { track("cta_click", { cta: b.getAttribute("data-cta") }); startReflection(b.getAttribute("data-cta")); });
  });
  $('[data-action="back"]').addEventListener("click", function () { history.back(); });
  $('[data-action="home"]').addEventListener("click", function (e) { e.preventDefault(); if (current !== "done") show("landing"); });
  $$("[data-track]").forEach(function (a) { a.addEventListener("click", function () { track(a.getAttribute("data-track"), { from: current }); }); });

  window.addEventListener("popstate", function (e) {
    var s = (e.state && e.state.screen) || "landing";
    if (current === "done" || current === "price") { history.pushState({ screen: current }, "", location.pathname + location.search); return; }
    if (s === "reflection") { qIndex = e.state.q || 0; renderQuestion(); }
    show(s, false);
  });

  history.replaceState({ screen: "landing" }, "", location.pathname + location.search);
  track("landing_view", {}, true);
})();
