Step 3 — Create the JS file

  Save as static/js/languagetool.js:

  (function () {
    const API = "/lt/check/";
    const DEBOUNCE_MS = 800;
    const timers = new WeakMap();

    function getCsrf() {
      return document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
    }

    async function check(text) {
      const r = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": getCsrf(),
        },
        body: new URLSearchParams({ text, language: "auto" }),
      });
      return r.json();
    }

    function renderErrors(wrapper, matches) {
      let ul = wrapper.querySelector(".lt-errors");
      if (!ul) {
        ul = document.createElement("ul");
        ul.className = "lt-errors";
        wrapper.appendChild(ul);
      }
      ul.innerHTML = matches.map((m) => {
        const suggestions = m.replacements.slice(0, 3).map((r) => r.value).join(", ");
        return `<li><b>${m.rule.issueType}:</b> ${m.message}${suggestions ? ` — <em>${suggestions}</em>` : ""}</li>`;
      }).join("");
    }

    function attach(textarea) {
      if (textarea.dataset.ltAttached) return;
      textarea.dataset.ltAttached = "1";

      const wrapper = document.createElement("div");
      wrapper.className = "lt-wrapper";
      textarea.parentNode.insertBefore(wrapper, textarea);
      wrapper.appendChild(textarea);

      let timer;
      textarea.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const text = textarea.value.trim();
          if (text.length < 20) return;
          try {
            const data = await check(text);
            renderErrors(wrapper, data.matches);
          } catch (_) {}
        }, DEBOUNCE_MS);
      });
    }

    function attachAll() {
      document.querySelectorAll("textarea").forEach(attach);
    }

    attachAll();
    new MutationObserver(attachAll).observe(document.body, { childList: true, subtree: true });
  })();

  ---

