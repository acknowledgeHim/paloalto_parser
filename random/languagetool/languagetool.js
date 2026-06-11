(function () {
  var LT_ENDPOINT = "/lt/check/";
  var DEBOUNCE_MS = 900;
  var MIN_LENGTH  = 20;

  var ISSUE_COLORS = {
    misspelling:   "#e53935",
    grammar:       "#2e7d32",
    style:         "#1565c0",
    typographical: "#e65100",
  };

  function colorFor(t) { return ISSUE_COLORS[t] || "#e65100"; }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── element helpers ──────────────────────────────────────────────────

  function isTextarea(el) { return el.tagName === "TEXTAREA"; }

  function getText(el) {
    return isTextarea(el) ? el.value : (el.innerText || el.textContent || "");
  }

  // Character offset of the caret inside the element
  function getCaretOffset(el) {
    if (isTextarea(el)) return el.selectionStart || 0;
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;
    var r = sel.getRangeAt(0).cloneRange();
    r.selectNodeContents(el);
    r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    return r.toString().length;
  }

  function replaceAt(el, offset, len, replacement, currentText) {
    if (isTextarea(el)) {
      el.value = currentText.slice(0, offset) + replacement + currentText.slice(offset + len);
      el.dispatchEvent(new Event("input"));
    } else {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var node, pos = 0, sN = null, sO = 0, eN = null, eO = 0;
      while ((node = walker.nextNode())) {
        var nl = node.textContent.length;
        if (!sN && pos + nl > offset)       { sN = node; sO = offset - pos; }
        if (!eN && pos + nl >= offset + len) { eN = node; eO = (offset + len) - pos; break; }
        pos += nl;
      }
      if (sN && eN) {
        var range = document.createRange();
        range.setStart(sN, sO); range.setEnd(eN, eO);
        range.deleteContents();
        var tn = document.createTextNode(replacement);
        range.insertNode(tn);
        range.setStartAfter(tn); range.collapse(true);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }

  // ── LT API ───────────────────────────────────────────────────────────

  function checkText(text) {
    return fetch(LT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text: text, language: "auto", level: "picky" }),
    }).then(function (r) {
      if (!r.ok) throw new Error("LT " + r.status);
      return r.json();
    });
  }

  // ── overlay rendering ────────────────────────────────────────────────

  function buildOverlayHTML(text, matches) {
    var sorted = matches.slice().sort(function (a, b) { return a.offset - b.offset; });
    var html = "", pos = 0;
    sorted.forEach(function (m) {
      if (m.offset < pos) return;
      html += escapeHtml(text.slice(pos, m.offset));
      var color = colorFor(m.rule.issueType);
      html +=
        "<span class='lt-mark'" +
        " style='border-bottom:2.5px solid " + color + ";'>" +
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
      "fontFamily","fontSize","fontWeight","fontStyle","fontVariant",
      "lineHeight","letterSpacing","wordSpacing","textAlign",
      "paddingTop","paddingRight","paddingBottom","paddingLeft",
      "borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth",
      "borderTopStyle","borderRightStyle","borderBottomStyle","borderLeftStyle",
      "boxSizing","tabSize","whiteSpace","overflowWrap","wordBreak",
    ].forEach(function (p) { overlay.style[p] = cs[p]; });
  }

  // ── popup positioning ────────────────────────────────────────────────

  function positionNear(floater, anchor, above) {
    floater.style.visibility = "hidden";
    floater.style.display    = "block";
    var rect = anchor.getBoundingClientRect();
    var sy   = window.scrollY || window.pageYOffset;
    var sx   = window.scrollX || window.pageXOffset;
    var fh   = floater.offsetHeight;
    var fw   = floater.offsetWidth;
    floater.style.top  = (above && rect.top - fh > 10
      ? rect.top  + sy - fh - 5
      : rect.bottom + sy + 5) + "px";
    var left = rect.left + sx;
    if (left + fw > window.innerWidth - 10) left = window.innerWidth - fw - 10 + sx;
    floater.style.left = Math.max(sx, left) + "px";
    floater.style.visibility = "visible";
  }

  function positionAtClick(floater, clientX, clientY) {
    floater.style.visibility = "hidden";
    floater.style.display    = "block";
    var sy = window.scrollY || window.pageYOffset;
    var sx = window.scrollX || window.pageXOffset;
    floater.style.top  = (clientY + sy + 10) + "px";
    var left = clientX + sx;
    if (left + floater.offsetWidth > window.innerWidth - 10)
      left = window.innerWidth - floater.offsetWidth - 10 + sx;
    floater.style.left = Math.max(sx, left) + "px";
    floater.style.visibility = "visible";
  }

  // ── inline popup ─────────────────────────────────────────────────────

  function buildPopupContent(popup, match, el, onReplace) {
    var capturedTxt = getText(el);
    popup.innerHTML = "";
    var msgEl = document.createElement("div");
    msgEl.className = "lt-popup-msg"; msgEl.textContent = match.message;
    popup.appendChild(msgEl);
    if (match.replacements.length) {
      var row = document.createElement("div"); row.className = "lt-popup-sugs";
      match.replacements.slice(0, 5).forEach(function (r) {
        var btn = document.createElement("button");
        btn.className = "lt-popup-btn"; btn.textContent = r.value;
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
          replaceAt(el, match.offset, match.length, r.value, capturedTxt);
          onReplace();
        });
        row.appendChild(btn);
      });
      popup.appendChild(row);
    }
  }

  // ── badge + issues panel ─────────────────────────────────────────────

  function buildIssuesPanel(panel, matches, el) {
    panel.innerHTML = "";
    var hdr = document.createElement("div");
    hdr.className   = "lt-panel-hdr";
    hdr.textContent = matches.length + " issue" + (matches.length !== 1 ? "s" : "") + " found";
    panel.appendChild(hdr);
    matches.forEach(function (m) {
      var capturedTxt = getText(el);
      var color = colorFor(m.rule.issueType);
      var item  = document.createElement("div"); item.className = "lt-panel-item";
      var top   = document.createElement("div"); top.className  = "lt-panel-item-top";
      var typeEl = document.createElement("span");
      typeEl.className = "lt-panel-type"; typeEl.style.color = color;
      typeEl.textContent = m.rule.issueType;
      var msgEl = document.createElement("span");
      msgEl.className = "lt-panel-item-msg"; msgEl.textContent = " " + m.message;
      top.appendChild(typeEl); top.appendChild(msgEl); item.appendChild(top);
      if (m.replacements.length) {
        var row = document.createElement("div"); row.className = "lt-panel-sugs";
        m.replacements.slice(0, 5).forEach(function (r) {
          var btn = document.createElement("button");
          btn.className = "lt-popup-btn"; btn.textContent = r.value;
          btn.addEventListener("mousedown", function (e) {
            e.preventDefault();
            replaceAt(el, m.offset, m.length, r.value, capturedTxt);
            panel.style.display = "none";
          });
          row.appendChild(btn);
        });
        item.appendChild(row);
      }
      panel.appendChild(item);
    });
  }

  function updateBadge(badge, panel, matches, el) {
    if (matches === null) {
      badge.className = "lt-badge lt-badge-checking"; badge.textContent = "…"; return;
    }
    if (matches.length === 0) {
      badge.className = "lt-badge lt-badge-ok"; badge.innerHTML = "&#10003;";
      panel.style.display = "none";
    } else {
      badge.className = "lt-badge lt-badge-err"; badge.textContent = matches.length;
      buildIssuesPanel(panel, matches, el);
    }
  }

  // ── core attach ──────────────────────────────────────────────────────

  function attachToElement(el) {
    if (el.dataset.ltBound) return;
    el.dataset.ltBound = "1";

    var cs = window.getComputedStyle(el);
    var container = document.createElement("div");
    container.style.position = "relative";
    container.style.display  = cs.display === "block" ? "block" : "inline-block";
    el.parentNode.insertBefore(container, el);
    container.appendChild(el);

    // Overlay sits BELOW the element (z-index 1) so the element's caret
    // always renders on top and stays fully visible
    var overlay = document.createElement("div");
    overlay.className   = "lt-overlay";
    overlay.style.color = cs.color;
    container.appendChild(overlay);
    mirrorStyles(el, overlay);

    // Element sits above the overlay so its caret is never hidden
    el.style.position   = "relative";
    el.style.zIndex     = "2";
    el.style.color      = "transparent";
    el.style.caretColor = cs.color;
    el.style.background = "transparent";

    // Badge
    var badge = document.createElement("div");
    badge.className = "lt-badge lt-badge-checking"; badge.textContent = "…";
    container.appendChild(badge);

    // Issues panel
    var issuesPanel = document.createElement("div");
    issuesPanel.className = "lt-panel"; issuesPanel.style.display = "none";
    document.body.appendChild(issuesPanel);

    // Inline popup
    var inlinePopup = document.createElement("div");
    inlinePopup.className = "lt-popup"; inlinePopup.style.display = "none";
    document.body.appendChild(inlinePopup);

    var lastMatches = null;

    function hideAll() {
      inlinePopup.style.display = "none";
      issuesPanel.style.display = "none";
    }

    // Badge click → toggle issues panel
    badge.addEventListener("mousedown", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (issuesPanel.style.display === "none" && issuesPanel.children.length) {
        positionNear(issuesPanel, badge, true);
      } else {
        issuesPanel.style.display = "none";
      }
    });

    // Close floaters on outside click
    document.addEventListener("mousedown", function (e) {
      if (!inlinePopup.contains(e.target)) inlinePopup.style.display = "none";
      if (!issuesPanel.contains(e.target) && e.target !== badge) issuesPanel.style.display = "none";
    }, true);

    // Scroll sync
    el.addEventListener("scroll", function () {
      overlay.scrollTop  = el.scrollTop;
      overlay.scrollLeft = el.scrollLeft;
    });

    // Click within the element: if caret landed inside a match, show inline popup
    el.addEventListener("mouseup", function (e) {
      if (!lastMatches || !lastMatches.length) return;
      var mx = e.clientX, my = e.clientY;
      setTimeout(function () {
        var pos = getCaretOffset(el);
        for (var i = 0; i < lastMatches.length; i++) {
          var m = lastMatches[i];
          if (pos >= m.offset && pos <= m.offset + m.length) {
            buildPopupContent(inlinePopup, m, el, hideAll);
            positionAtClick(inlinePopup, mx, my);
            return;
          }
        }
        inlinePopup.style.display = "none";
      }, 10);
    });

    var timer = null, lastChecked = null;

    function runCheck() {
      var text = getText(el);
      if (text === lastChecked) return;
      updateBadge(badge, issuesPanel, null, el);
      if (text.trim().length < MIN_LENGTH) {
        overlay.innerHTML = escapeHtml(text);
        lastChecked = text; lastMatches = [];
        updateBadge(badge, issuesPanel, [], el);
        return;
      }
      checkText(text)
        .then(function (data) {
          if (text !== getText(el)) return;
          lastMatches = data.matches;
          overlay.innerHTML = buildOverlayHTML(text, data.matches);
          lastChecked = text;
          updateBadge(badge, issuesPanel, data.matches, el);
        })
        .catch(function (err) { console.warn("LanguageTool:", err); });
    }

    el.addEventListener("input", function () {
      overlay.innerHTML = escapeHtml(getText(el));
      clearTimeout(timer);
      timer = setTimeout(runCheck, DEBOUNCE_MS);
    });

    el.addEventListener("focus", function () {
      if (getText(el) !== lastChecked && getText(el).trim().length >= MIN_LENGTH) runCheck();
    });

    var initialized = false;
    function initOverlay() {
      if (initialized) return; initialized = true;
      mirrorStyles(el, overlay);
      overlay.innerHTML = escapeHtml(getText(el));
      if (getText(el).trim().length >= MIN_LENGTH) runCheck();
      else updateBadge(badge, issuesPanel, [], el);
    }

    if (window.ResizeObserver) {
      var initRO = new ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        if (r.width > 0 || r.height > 0) {
          initRO.disconnect(); initOverlay();
          new ResizeObserver(function () { mirrorStyles(el, overlay); }).observe(el);
        }
      });
      initRO.observe(el);
    } else {
      requestAnimationFrame(initOverlay);
    }
  }

  // ── CSS ──────────────────────────────────────────────────────────────

  var style = document.createElement("style");
  style.textContent =
    ".lt-overlay{" +
      "position:absolute;top:0;left:0;right:0;bottom:0;" +
      "box-sizing:border-box!important;" +
      "pointer-events:none;overflow:hidden;" +
      "border-color:transparent;background:transparent;" +
      "z-index:1;" +
    "}" +
    ".lt-badge{" +
      "position:absolute;bottom:5px;right:6px;z-index:10;" +
      "min-width:20px;height:20px;border-radius:10px;padding:0 6px;" +
      "font-size:11px;font-weight:700;line-height:20px;text-align:center;" +
      "cursor:pointer;user-select:none;" +
      "box-shadow:0 1px 4px rgba(0,0,0,.25);transition:background .2s;" +
    "}" +
    ".lt-badge-checking{background:#90a4ae;color:#fff;}" +
    ".lt-badge-ok{background:#1565c0;color:#fff;}" +
    ".lt-badge-err{background:#e53935;color:#fff;}" +
    ".lt-popup{" +
      "position:absolute;z-index:9999;" +
      "background:#fff;border:1px solid #ddd;border-radius:6px;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.18);" +
      "padding:9px 12px;max-width:300px;" +
      "font-size:13px;font-family:sans-serif;" +
    "}" +
    ".lt-popup-msg{color:#333;margin-bottom:7px;line-height:1.4;}" +
    ".lt-popup-sugs,.lt-panel-sugs{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}" +
    ".lt-popup-btn{" +
      "background:#1565c0;color:#fff;" +
      "border:none;border-radius:4px;" +
      "padding:3px 10px;cursor:pointer;font-size:12px;" +
    "}" +
    ".lt-popup-btn:hover{background:#0d47a1;}" +
    ".lt-panel{" +
      "position:absolute;z-index:9999;" +
      "background:#fff;border:1px solid #ddd;border-radius:8px;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.18);" +
      "min-width:280px;max-width:340px;max-height:360px;" +
      "overflow-y:auto;font-size:13px;font-family:sans-serif;" +
    "}" +
    ".lt-panel-hdr{" +
      "padding:9px 12px;font-weight:700;font-size:12px;" +
      "color:#555;border-bottom:1px solid #eee;" +
      "position:sticky;top:0;background:#fff;z-index:1;" +
    "}" +
    ".lt-panel-item{padding:9px 12px;border-bottom:1px solid #f0f0f0;}" +
    ".lt-panel-item:last-child{border-bottom:none;}" +
    ".lt-panel-item-top{line-height:1.4;}" +
    ".lt-panel-type{font-weight:700;font-size:11px;text-transform:uppercase;}" +
    ".lt-panel-item-msg{color:#333;}";
  document.head.appendChild(style);

  // ── discovery ────────────────────────────────────────────────────────

  function attachAll() {
    document.querySelectorAll("textarea").forEach(attachToElement);
    // document.querySelectorAll("[contenteditable='true']").forEach(attachToElement);
  }

  function init() {
    attachAll();
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === "TEXTAREA") attachToElement(node);
          // if (node.getAttribute("contenteditable") === "true") attachToElement(node);
          if (node.querySelectorAll)
            node.querySelectorAll("textarea").forEach(attachToElement);
            // node.querySelectorAll("[contenteditable='true']").forEach(attachToElement);
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
