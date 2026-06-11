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

  // --- element type helpers -------------------------------------------

  function isTextarea(el) {
    return el.tagName === "TEXTAREA";
  }

  function getText(el) {
    return isTextarea(el) ? el.value : (el.innerText || el.textContent || "");
  }

  function replaceAt(el, offset, len, replacement, currentText) {
    if (isTextarea(el)) {
      el.value = currentText.slice(0, offset) + replacement + currentText.slice(offset + len);
      el.dispatchEvent(new Event("input"));
    } else {
      // Walk text nodes to find the range matching the offset
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var node, pos = 0, startNode = null, startOff = 0, endNode = null, endOff = 0;
      while ((node = walker.nextNode())) {
        var nodeLen = node.textContent.length;
        if (!startNode && pos + nodeLen > offset) {
          startNode = node;
          startOff  = offset - pos;
        }
        if (!endNode && pos + nodeLen >= offset + len) {
          endNode = node;
          endOff  = (offset + len) - pos;
          break;
        }
        pos += nodeLen;
      }
      if (startNode && endNode) {
        var range = document.createRange();
        range.setStart(startNode, startOff);
        range.setEnd(endNode, endOff);
        range.deleteContents();
        var textNode = document.createTextNode(replacement);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }

  // --- LT API ---------------------------------------------------------

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

  // --- overlay rendering ----------------------------------------------

  function buildOverlayHTML(text, matches) {
    var sorted = matches.slice().sort(function (a, b) { return a.offset - b.offset; });
    var html = "";
    var pos  = 0;
    sorted.forEach(function (m) {
      if (m.offset < pos) return;
      html += escapeHtml(text.slice(pos, m.offset));
      var color = colorFor(m.rule.issueType);
      var sugs  = JSON.stringify(m.replacements.slice(0, 5).map(function (r) { return r.value; }));
      html +=
        "<span class='lt-mark'" +
        " data-msg=\""    + m.message.replace(/"/g, "&quot;") + "\"" +
        " data-sugs='"    + sugs.replace(/'/g, "&#39;")       + "'" +
        " data-offset='"  + m.offset  + "'" +
        " data-len='"     + m.length  + "'" +
        " style='border-bottom:2.5px solid " + color + ";cursor:pointer;'>" +
        escapeHtml(text.slice(m.offset, m.offset + m.length)) +
        "</span>";
      pos = m.offset + m.length;
    });
    html += escapeHtml(text.slice(pos));
    return html;
  }

  function mirrorStyles(el, overlay) {
    var cs = window.getComputedStyle(el);
    [
      "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant",
      "lineHeight", "letterSpacing", "wordSpacing", "textAlign",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
      "boxSizing", "tabSize", "whiteSpace", "overflowWrap", "wordBreak",
    ].forEach(function (p) { overlay.style[p] = cs[p]; });
  }

  // --- popup ----------------------------------------------------------

  function positionPopup(popup, mark) {
    popup.style.display = "block";
    var rect    = mark.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var scrollX = window.scrollX || window.pageXOffset;
    popup.style.top  = (rect.bottom + scrollY + 5) + "px";
    popup.style.left = (rect.left   + scrollX) + "px";
    var pr = popup.getBoundingClientRect();
    if (pr.right > window.innerWidth - 10) {
      popup.style.left = (window.innerWidth - pr.width - 10 + scrollX) + "px";
    }
  }

  function showPopup(popup, mark, el) {
    var offset = parseInt(mark.dataset.offset);
    var len    = parseInt(mark.dataset.len);
    var sugs   = JSON.parse(mark.dataset.sugs || "[]");
    var capturedText = getText(el);

    popup.innerHTML = "";

    var msgEl = document.createElement("div");
    msgEl.className   = "lt-popup-msg";
    msgEl.textContent = mark.dataset.msg;
    popup.appendChild(msgEl);

    if (sugs.length) {
      var row = document.createElement("div");
      row.className = "lt-popup-sugs";
      sugs.forEach(function (s) {
        var btn = document.createElement("button");
        btn.className   = "lt-popup-btn";
        btn.textContent = s;
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
          replaceAt(el, offset, len, s, capturedText);
          popup.style.display = "none";
        });
        row.appendChild(btn);
      });
      popup.appendChild(row);
    }

    positionPopup(popup, mark);
  }

  // --- core attach ----------------------------------------------------

  function attachToElement(el) {
    if (el.dataset.ltBound) return;
    el.dataset.ltBound = "1";

    var cs = window.getComputedStyle(el);

    // Wrap in a relative container so the overlay can be positioned over el
    var container = document.createElement("div");
    container.style.position = "relative";
    container.style.display  = cs.display === "block" ? "block" : "inline-block";
    el.parentNode.insertBefore(container, el);
    container.appendChild(el);

    // Overlay sits on top; pointer-events none except on .lt-mark spans
    var overlay = document.createElement("div");
    overlay.className = "lt-overlay";
    container.appendChild(overlay);
    mirrorStyles(el, overlay);

    // Make element text invisible but keep caret visible
    var origColor = cs.color;
    el.style.color      = "transparent";
    el.style.caretColor = origColor;

    // Popup appended to body to avoid overflow clipping
    var popup = document.createElement("div");
    popup.className     = "lt-popup";
    popup.style.display = "none";
    document.body.appendChild(popup);

    // Scroll sync
    el.addEventListener("scroll", function () {
      overlay.scrollTop  = el.scrollTop;
      overlay.scrollLeft = el.scrollLeft;
    });

    // Click underlined word → popup
    overlay.addEventListener("mousedown", function (e) {
      var mark = e.target.closest && e.target.closest(".lt-mark");
      if (mark) {
        e.preventDefault();
        showPopup(popup, mark, el);
      }
    });

    // Close popup on outside click
    document.addEventListener("mousedown", function (e) {
      if (!popup.contains(e.target) && !overlay.contains(e.target)) {
        popup.style.display = "none";
      }
    }, true);

    var timer       = null;
    var lastChecked = null;

    function runCheck() {
      var text = getText(el);
      if (text === lastChecked) return;
      if (text.trim().length < MIN_LENGTH) {
        overlay.innerHTML = escapeHtml(text);
        lastChecked = text;
        return;
      }
      checkText(text)
        .then(function (data) {
          if (text !== getText(el)) return; // stale
          overlay.innerHTML = buildOverlayHTML(text, data.matches);
          lastChecked = text;
        })
        .catch(function (err) { console.warn("LanguageTool:", err); });
    }

    el.addEventListener("input", function () {
      overlay.innerHTML = escapeHtml(getText(el));
      clearTimeout(timer);
      timer = setTimeout(runCheck, DEBOUNCE_MS);
    });

    el.addEventListener("focus", function () {
      if (getText(el) !== lastChecked && getText(el).trim().length >= MIN_LENGTH) {
        runCheck();
      }
    });

    var initialized = false;

    function initOverlay() {
      if (initialized) return;
      initialized = true;
      mirrorStyles(el, overlay);
      overlay.innerHTML = escapeHtml(getText(el));
      if (getText(el).trim().length >= MIN_LENGTH) runCheck();
    }

    if (window.ResizeObserver) {
      var initRO = new ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        if (r.width > 0 || r.height > 0) {
          initRO.disconnect();
          initOverlay();
          new ResizeObserver(function () { mirrorStyles(el, overlay); }).observe(el);
        }
      });
      initRO.observe(el);
    } else {
      requestAnimationFrame(initOverlay);
    }
  }

  // --- CSS injection --------------------------------------------------

  var style = document.createElement("style");
  style.textContent =
    ".lt-overlay{" +
      "position:absolute;top:0;left:0;right:0;bottom:0;" +
      "box-sizing:border-box!important;" +
      "pointer-events:none;" +
      "overflow:hidden;" +
      "border-color:transparent;" +
      "background:transparent;" +
      "z-index:2;" +
      "color:#000;" +
    "}" +
    ".lt-mark{pointer-events:all;}" +
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

  // --- discovery ------------------------------------------------------

  function attachAll() {
    document.querySelectorAll("textarea").forEach(attachToElement);
    document.querySelectorAll("[contenteditable='true']").forEach(attachToElement);
  }

  function init() {
    attachAll();
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === "TEXTAREA" || node.getAttribute("contenteditable") === "true") {
            attachToElement(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll("textarea,[contenteditable='true']").forEach(attachToElement);
          }
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
