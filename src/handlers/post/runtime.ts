/**
 * The browser runtime the post handler wraps a form with. It is a SELF-CONTAINED
 * vanilla-JS string (no imports -- it runs in the page) and it is STATIC: it
 * reads everything from the DOM hooks the renderer stamped (`name`/`data-path`,
 * `data-error-for`, `data-variant-of`/`data-variant`/`data-when`,
 * `data-add-row`/`data-remove-row`/`data-row`), so one script fits every form.
 * That is the `Handler` contract made real -- uniform over paths, blind to
 * components.
 *
 * It owns ALL interactivity the renderer left inert:
 *  - submit: native HTML5 validation gates the client (NO zod in the browser),
 *    then values are collected by `name` (= path), un-flattened to nested JSON,
 *    and `fetch`-POSTed to the form's action;
 *  - the server validates with `~standard` and returns issues, which are routed
 *    to each control's path-addressed error slot (unbound issues -> a form-level
 *    sink, never dropped);
 *  - union variant show/hide (inactive panels are DISABLED, so they neither
 *    submit nor block native validation);
 *  - array add/remove (clones the `<template>` row and re-indexes `*` -> 0,1,2).
 *
 * `pathToId` is inlined here (it must run in the browser to re-index cloned row
 * ids); a test cross-checks it against kelex's `pathToId` so the two cannot drift.
 */
export const RUNTIME = `(function () {
  // Initialize every form the handler marked (once each) -- robust to how/when
  // the script runs, and to more than one form on the page.
  document.querySelectorAll("form[data-kelex-post]").forEach(function (form) {
    if (form.getAttribute("data-kelex-init") === "1") return;
    form.setAttribute("data-kelex-init", "1");
    init(form);
  });

  function init(form) {
  // Mirrors kelex pathToId -- injective escape so a re-indexed row id stays unique.
  function pathToId(p) {
    return p.replace(/[_.*-]/g, function (c) {
      return { "_": "__", ".": "_d", "*": "_x", "-": "_h" }[c];
    });
  }

  // A form-level sink for issues that bind to no control (root/refine errors).
  var sink = form.querySelector("[data-form-error]");
  if (!sink) {
    sink = document.createElement("div");
    sink.setAttribute("data-form-error", "");
    sink.setAttribute("role", "alert");
    sink.setAttribute("aria-live", "polite");
    form.insertBefore(sink, form.firstChild);
  }

  // --- union switch: show the chosen panel, DISABLE the rest (so they are not
  // submitted and do not block native validation via a hidden required field) ---
  function syncVariants() {
    form.querySelectorAll("[data-variant-of]").forEach(function (selector) {
      var chosen = selector.value;
      var scope = selector.closest("fieldset") || form;
      scope.querySelectorAll("[data-variant]").forEach(function (panel) {
        var active = panel.getAttribute("data-when") === chosen;
        panel.hidden = !active;
        panel.querySelectorAll("input, select, textarea").forEach(function (el) {
          el.disabled = !active;
        });
      });
    });
  }

  // --- array add/remove: re-index a cloned row's paths and ids by a monotonic
  // index (unique even after removes); gaps are compacted at collect time ---
  function reindexRow(html, slot, n) {
    var concrete = slot.replace(/\\*$/, String(n));
    return html
      .split(slot).join(concrete)                      // literal path attrs (name/data-*)
      .split(pathToId(slot)).join(pathToId(concrete)); // encoded id attrs (id/for/describedby)
  }

  form.addEventListener("click", function (e) {
    var add = e.target.closest && e.target.closest("[data-add-row]");
    if (add && form.contains(add)) {
      e.preventDefault();
      var group = add.closest("fieldset");
      var tpl = group && group.querySelector("template[data-row]");
      if (!tpl) return;
      var slot = tpl.getAttribute("data-row");
      var next = parseInt(group.getAttribute("data-next-index") || "0", 10);
      group.setAttribute("data-next-index", String(next + 1));
      var row = document.createElement("div");
      row.setAttribute("data-row-instance", "");
      // The source is the renderer's own <template> markup (trusted, not user
      // input) with a numeric index substituted -- the standard repeater clone.
      row.innerHTML = reindexRow(tpl.innerHTML, slot, next);
      group.insertBefore(row, add);
      return;
    }
    var remove = e.target.closest && e.target.closest("[data-remove-row]");
    if (remove && form.contains(remove)) {
      e.preventDefault();
      var inst = remove.closest("[data-row-instance]");
      if (inst) inst.remove();
    }
  });

  form.addEventListener("change", function (e) {
    if (e.target.matches && e.target.matches("[data-variant-of]")) syncVariants();
  });

  // --- collect by name (= path) -> nested JSON; compact arrays to close gaps ---
  function assign(root, segs, value) {
    var cur = root;
    for (var i = 0; i < segs.length - 1; i++) {
      var key = segs[i];
      var nextIsIndex = /^\\d+$/.test(segs[i + 1]);
      if (cur[key] == null) cur[key] = nextIsIndex ? [] : {};
      cur = cur[key];
    }
    cur[segs[segs.length - 1]] = value;
  }
  function compact(node) {
    if (Array.isArray(node)) {
      for (var i = node.length - 1; i >= 0; i--) {
        if (node[i] === undefined) node.splice(i, 1);
        else compact(node[i]);
      }
    } else if (node && typeof node === "object") {
      Object.keys(node).forEach(function (k) { compact(node[k]); });
    }
  }
  function collect() {
    var out = {};
    new FormData(form).forEach(function (value, name) {
      assign(out, name.split("."), value);
    });
    compact(out);
    return out;
  }

  // --- route server issues to their path-addressed slots; unbound -> the sink ---
  function normalizePath(path) {
    return (path || [])
      .map(function (seg) {
        return seg && typeof seg === "object" && "key" in seg ? seg.key : seg;
      })
      .join(".");
  }
  function clearErrors() {
    form.querySelectorAll("[data-error-for]").forEach(function (s) { s.textContent = ""; });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (c) {
      c.setAttribute("aria-invalid", "false");
    });
    sink.textContent = "";
  }
  function route(issues) {
    var unbound = [];
    (issues || []).forEach(function (issue) {
      var path = normalizePath(issue.path);
      var slot = path && form.querySelector('[data-error-for="' + path + '"]');
      if (slot) {
        slot.textContent = issue.message || "Invalid";
        var control = form.querySelector('[name="' + path + '"]');
        if (control) control.setAttribute("aria-invalid", "true");
      } else {
        unbound.push(issue.message || "Invalid");
      }
    });
    sink.textContent = unbound.join("; ");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    syncVariants();
    clearErrors();
    if (typeof form.checkValidity === "function" && !form.checkValidity()) {
      if (form.reportValidity) form.reportValidity();
      return;
    }
    fetch(form.getAttribute("action") || location.href, {
      method: (form.getAttribute("method") || "post").toUpperCase(),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collect()),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (res) { route(res && res.issues); })
      .catch(function () { sink.textContent = "Submission failed."; });
  });

  syncVariants();
  }
})();`;
