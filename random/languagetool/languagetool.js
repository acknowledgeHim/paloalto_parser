(function () {
  var LT_ENDPOINT = "/lt/check/";
  var DEBOUNCE_MS = 900;
  var MIN_LENGTH = 20;

  var ISSUE_COLORS = {
    misspelling:   "#e53935",
    grammar:       "#2e7d32",
    style:         "#1565c0",
    typographical: "#e65100",
  };

  function colorFor(issueType) {
    return ISSUE_COLORS[issueType] || "#e65100";
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function checkText(text) {
    return fetch(LT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text: text, language: "auto" }),
    }).then(function (r) {
      if (!r.ok) throw new Error("LT " + r.status);
      return r.json();
    });
  }

  function buildOverlayHTML(text, matches) {
    var sorted = matches.slice().sort(function (a, b) { return a.offset - b.offset; });
    var html = "";
    var pos = 0;

    sorted.forEach(function (m) {
      if (m.offset < pos) return; // skip overlapping matches
      html += escapeHtml(text.slice(pos, m.offset));
      var color = colorFor(m.rule.issueType);
      var sugs = JSON.stringify(
        m.replacements.slice(0, 5).map(function (r) { return r.value; })
      );
      html +=
        "<span class='lt-mark'" +
        " data-msg=\"" + m.message.replace(/"/g, "&quot;") + "\"" +
        " data-sugs='" + sugs.replace(/'/g, "&#39;") + "'" +
        " data-offset='" + m.offset + "'" +
        " data-len='" + m.length + "'" +
        " style='border-bottom:2.5px solid " + color + ";cursor:pointer;'>" +
        escapeHtml(text.slice(m.offset, m.offset + m.length)) +
        "</span>";
      pos = m.offset + m.length;
    });

    html += escapeHtml(text.slice(pos));
    return html;
  }

  function mirrorStyles(textarea, overlay) {
    var cs = window.getComputedStyle(textarea);
    [
      "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant",
      "lineHeight", "letterSpacing", "wordSpacing", "textAlign",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
      "boxSizing", "tabSize",
    ].forEach(function (p) { overlay.style[p] = cs[p]; });
    overlay.style.width  = textarea.offsetWidth  + "px";
    overlay.style.height = textarea.offsetHeight + "px";
  }

  function positionPopup(popup, mark) {
    popup.style.display = "block";
    var rect    = mark.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var scrollX = window.scrollX || window.pageXOffset;
    popup.style.top  = (rect.bottom + scrollY + 5) + "px";
    popup.style.left = (rect.left   + scrollX) + "px";
    // nudge left if it overflows the viewport
    var pr = popup.getBoundingClientRect();
    if (pr.right > window.innerWidth - 10) {
      popup.style.left = (window.innerWidth - pr.width - 10 + scrollX) + "px";
    }
  }

  function showPopup(popup, mark, textarea) {
    var offset = parseInt(mark.dataset.offset);
    var len    = parseInt(mark.dataset.len);
    var sugs   = JSON.parse(mark.dataset.sugs || "[]");

    popup.innerHTML = "";

    var msgEl = document.createElement("div");
    msgEl.className = "lt-popup-msg";
    msgEl.textContent = mark.dataset.msg;
    popup.appendChild(msgEl);

    if (sugs.length) {
      var row = document.createElement("div");
      row.className = "lt-popup-sugs";
      sugs.forEach(function (s) {
        var btn = document.createElement("button");
        btn.className = "lt-popup-btn";
        btn.textContent = s;
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
          var val = textarea.value;
          textarea.value = val.slice(0, offset) + s + val.slice(offset + len);
          textarea.dispatchEvent(new Event("input"));
          popup.style.display = "none";
        });
        row.appendChild(btn);
      });
      popup.appendChild(row);
    }

    positionPopup(popup, mark);
  }

  function attachToTextarea(textarea) {
    if (textarea.dataset.ltBound) return;
    textarea.dataset.ltBound = "1";

    // Wrap in a relative container so overlay aligns to textarea
    var cs = window.getComputedStyle(textarea);
    var container = document.createElement("div");
    container.style.position = "relative";
    container.style.display  = cs.display === "block" ? "block" : "inline-block";
    textarea.parentNode.insertBefore(container, textarea);
    container.appendChild(textarea);

    // Overlay: sits on top, passes all pointer events through except on .lt-mark spans
    var overlay = document.createElement("div");
    overlay.className = "lt-overlay";
    container.appendChild(overlay);
    mirrorStyles(textarea, overlay);

    // Make textarea text invisible; keep caret colour
    var origColor = cs.color;
    textarea.style.color     = "transparent";
    textarea.style.caretColor = origColor;

    // Popup appended to <body> so it is never clipped by overflow:hidden parents
    var popup = document.createElement("div");
    popup.className  = "lt-popup";
    popup.style.display = "none";
    document.body.appendChild(popup);

    // Scroll sync: overlay scrolls with textarea
    textarea.addEventListener("scroll", function () {
      overlay.scrollTop  = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    });

    // Clicks on underlined words open the popup
    overlay.addEventListener("mousedown", function (e) {
      var mark = e.target.closest && e.target.closest(".lt-mark");
      if (mark) {
        e.preventDefault();
        showPopup(popup, mark, textarea);
      }
    });

    // Close popup when clicking elsewhere
    document.addEventListener("mousedown", function (e) {
      if (!popup.contains(e.target) && !overlay.contains(e.target)) {
        popup.style.display = "none";
      }
    }, true);

    // Re-mirror if textarea is resized (e.g. user drags the resize handle)
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        mirrorStyles(textarea, overlay);
      }).observe(textarea);
    }

    var timer = null;
    var lastText = null;

    function runCheck() {
      var text = textarea.value;
      if (text === lastText) return;
      if (text.trim().length < MIN_LENGTH) {
        overlay.innerHTML = escapeHtml(text);
        lastText = text;
        return;
      }
      checkText(text)
        .then(function (data) {
          if (text !== textarea.value) return; // response is stale
          overlay.innerHTML = buildOverlayHTML(text, data.matches);
          lastText = text;
        })
        .catch(function (err) { console.warn("LanguageTool:", err); });
    }

    textarea.addEventListener("input", function () {
      // Sync overlay text immediately so it tracks the cursor
      overlay.innerHTML = escapeHtml(textarea.value);
      clearTimeout(timer);
      timer = setTimeout(runCheck, DEBOUNCE_MS);
    });

    textarea.addEventListener("focus", function () {
      if (!overlay.querySelector(".lt-mark") && textarea.value.trim().length >= MIN_LENGTH) {
        runCheck();
      }
    });
  }

  // Inject required CSS
  var style = document.createElement("style");
  style.textContent =
    ".lt-overlay{" +
      "position:absolute;top:0;left:0;" +
      "pointer-events:none;" +          /* pass clicks through to textarea… */
      "overflow:hidden;" +
      "white-space:pre-wrap;" +
      "word-wrap:break-word;" +
      "border-color:transparent;" +
      "background:transparent;" +
      "z-index:2;" +
      "color:#000;" +
    "}" +
    ".lt-mark{pointer-events:all;}" +   /* …except on underlined words */
    ".lt-popup{" +
      "position:absolute;z-index:9999;" +
      "background:#fff;" +
      "border:1px solid #ddd;" +
      "border-radius:6px;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.18);" +
      "padding:9px 12px;" +
      "max-width:300px;" +
      "font-size:13px;font-family:sans-serif;" +
    "}" +
    ".lt-popup-msg{color:#333;margin-bottom:7px;line-height:1.4;}" +
    ".lt-popup-sugs{display:flex;flex-wrap:wrap;gap:5px;}" +
    ".lt-popup-btn{" +
      "background:#4caf50;color:#fff;" +
      "border:none;border-radius:4px;" +
      "padding:3px 10px;cursor:pointer;font-size:13px;" +
    "}" +
    ".lt-popup-btn:hover{background:#388e3c;}";
  document.head.appendChild(style);

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
          if (node.querySelectorAll) node.querySelectorAll("textarea").forEach(attachToTextarea);
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
