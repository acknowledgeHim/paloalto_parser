(function () {
  const LT_ENDPOINT = "/lt/check/";
  const DEBOUNCE_MS = 900;
  const MIN_LENGTH = 20;

  async function checkText(text) {
    const resp = await fetch(LT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text: text, language: "auto" }),
    });
    if (!resp.ok) throw new Error("LT request failed: " + resp.status);
    return resp.json();
  }

  function renderErrors(errorBox, matches) {
    if (!matches.length) {
      errorBox.innerHTML = "";
      return;
    }
    errorBox.innerHTML = matches
      .map(function (m) {
        var suggestions = m.replacements
          .slice(0, 3)
          .map(function (r) { return r.value; })
          .join(", ");
        return (
          '<li class="lt-error-item">' +
          '<span class="lt-rule-type">' + m.rule.issueType + "</span> " +
          m.message +
          (suggestions ? ' &mdash; <span class="lt-suggestions">' + suggestions + "</span>" : "") +
          "</li>"
        );
      })
      .join("");
  }

  function attachToTextarea(textarea) {
    if (textarea.dataset.ltBound) return;
    textarea.dataset.ltBound = "1";

    var errorBox = document.createElement("ul");
    errorBox.className = "lt-error-box";
    textarea.insertAdjacentElement("afterend", errorBox);

    var timer = null;

    textarea.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var text = textarea.value.trim();
        if (text.length < MIN_LENGTH) {
          errorBox.innerHTML = "";
          return;
        }
        checkText(text)
          .then(function (data) { renderErrors(errorBox, data.matches); })
          .catch(function (err) { console.warn("LanguageTool error:", err); });
      }, DEBOUNCE_MS);
    });
  }

  function attachAll() {
    document.querySelectorAll("textarea").forEach(attachToTextarea);
  }

  function init() {
    attachAll();
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === "TEXTAREA") attachToTextarea(node);
          node.querySelectorAll && node.querySelectorAll("textarea").forEach(attachToTextarea);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
