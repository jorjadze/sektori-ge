(() => {
  const CATEGORIES = ["ეროვნული ლიგა", "ტრანსფერები", "ნაკრები", "მიმოხილვა", "ინტერვიუ", "ანალიტიკა", "სხვა"];
  const ERRORS = {
    wrong_password: "პაროლი არასწორია.",
    not_configured: "პაროლი Netlify-ში ჯერ არ არის დაყენებული (ADMIN_PASSWORD და SESSION_SECRET).",
    unauthorized: "სესია დასრულდა. შედი თავიდან.",
    title_length: "სათაური უნდა იყოს 3-დან 200 სიმბოლომდე.",
    category: "აირჩიე კატეგორია.",
    excerpt_length: "მოკლე აღწერა მაქსიმუმ 300 სიმბოლოა.",
    body_length: "ტექსტი ცარიელია ან ძალიან გრძელია.",
    image: "ფოტოს მისამართი არასწორია.",
    image_type: "ფოტო უნდა იყოს JPG, PNG ან WebP.",
    image_size: "ფოტო ძალიან დიდია.",
    not_found: "სიახლე ვერ მოიძებნა.",
  };

  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    kids.forEach((c) => c && n.appendChild(c));
    return n;
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: "same-origin", ...opts });
    let data = null;
    try { data = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || String(res.status));
      err.code = (data && data.error) || String(res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  const msg = (e) => ERRORS[e.code] || "შეცდომა: " + e.code;

  function toast(text, bad) {
    const t = el("div", { class: "toast" + (bad ? " bad" : ""), text });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  /* ---------- views ---------- */
  function showLogin() {
    $("#app").hidden = true;
    $("#login").hidden = false;
    $("#pw").focus();
  }
  async function showApp() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    await loadList();
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-err").textContent = "";
    try {
      await api("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: $("#pw").value }),
      });
      $("#pw").value = "";
      await showApp();
    } catch (err) {
      $("#login-err").textContent = err.status === 429 ? "ძალიან ბევრი მცდელობა. სცადე ერთ წუთში." : msg(err);
    }
  });

  $("#logout").addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST" }); } catch (_) { /* ignore */ }
    showLogin();
  });

  /* ---------- list ---------- */
  let items = [];
  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString("ka-GE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch (_) { return iso.slice(0, 10); }
  };

  async function loadList() {
    try {
      items = (await api("/api/news?all=1&limit=100")).items;
    } catch (err) {
      if (err.status === 401) return showLogin();
      return toast(msg(err), true);
    }
    const list = $("#list");
    list.textContent = "";
    $("#empty").hidden = items.length > 0;
    for (const m of items) {
      const badges = el("div", { class: "meta" });
      if (m.featured) badges.appendChild(el("span", { class: "badge f", text: "მთავარი" }));
      if (!m.published) badges.appendChild(el("span", { class: "badge d", text: "დრაფტი" }));
      badges.appendChild(document.createTextNode(m.category + " · " + fmt(m.date)));
      const thumb = m.image ? el("img", { class: "thumb", src: m.image, alt: "", loading: "lazy" }) : el("div", { class: "thumb" });
      const item = el("div", { class: "item" + (m.featured ? " feat" : "") + (m.published ? "" : " draft") }, thumb, el("div", {}, el("h3", { text: m.title }), badges));
      item.addEventListener("click", () => openSheet(m.id));
      list.appendChild(item);
    }
  }

  /* ---------- bottom sheet ---------- */
  let editingId = null;
  let imageUrl = "";

  const catSel = $("#f-cat");
  CATEGORIES.forEach((c) => catSel.appendChild(el("option", { value: c, text: c })));

  function setImage(url) {
    imageUrl = url || "";
    const p = $("#f-preview");
    p.hidden = !imageUrl;
    if (imageUrl) p.src = imageUrl;
    $("#f-remove-img").hidden = !imageUrl;
  }

  function showSheet(show) {
    $("#overlay").hidden = !show;
    $("#sheet").hidden = !show;
    document.body.style.overflow = show ? "hidden" : "";
  }

  async function openSheet(id) {
    editingId = id || null;
    $("#sheet-err").textContent = "";
    $("#f-file").value = "";
    $("#f-file-status").textContent = "ფოტო ავტომატურად დაპატარავდება ატვირთვისას.";
    $("#sheet-title").textContent = id ? "სიახლის რედაქტირება" : "ახალი სიახლე";
    $("#delete").hidden = !id;

    if (id) {
      try {
        const a = await api("/api/news/" + encodeURIComponent(id));
        $("#f-title").value = a.title;
        catSel.value = a.category;
        $("#f-excerpt").value = a.excerpt;
        $("#f-body").value = a.body;
        $("#f-feat").checked = a.featured;
        $("#f-pub").checked = a.published;
        setImage(a.image);
      } catch (err) {
        return toast(msg(err), true);
      }
    } else {
      $("#f-title").value = "";
      catSel.value = CATEGORIES[0];
      $("#f-excerpt").value = "";
      $("#f-body").value = "";
      $("#f-feat").checked = false;
      $("#f-pub").checked = true;
      setImage("");
    }
    showSheet(true);
    if (!id) $("#f-title").focus();
  }

  $("#new").addEventListener("click", () => openSheet(null));
  $("#close").addEventListener("click", () => showSheet(false));
  $("#overlay").addEventListener("click", () => showSheet(false));
  $("#f-remove-img").addEventListener("click", () => setImage(""));

  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("image_type"))), "image/jpeg", 0.85));
  }

  $("#f-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = $("#f-file-status");
    status.textContent = "იტვირთება...";
    try {
      const blob = await shrink(file);
      const r = await api("/api/upload", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
      setImage(r.url);
      status.textContent = "ფოტო აიტვირთა.";
    } catch (err) {
      status.textContent = "";
      $("#sheet-err").textContent = err.code ? msg(err) : "ფოტოს ატვირთვა ვერ მოხერხდა.";
    }
  });

  $("#sheet").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#sheet-err").textContent = "";
    const btn = $("#save");
    btn.disabled = true;
    const payload = {
      title: $("#f-title").value,
      category: catSel.value,
      excerpt: $("#f-excerpt").value,
      body: $("#f-body").value,
      image: imageUrl,
      featured: $("#f-feat").checked,
      published: $("#f-pub").checked,
    };
    try {
      await api(editingId ? "/api/news/" + encodeURIComponent(editingId) : "/api/news", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      showSheet(false);
      toast("შენახულია");
      await loadList();
    } catch (err) {
      if (err.status === 401) { showSheet(false); return showLogin(); }
      $("#sheet-err").textContent = msg(err);
    } finally {
      btn.disabled = false;
    }
  });

  $("#delete").addEventListener("click", async () => {
    if (!editingId || !confirm("დარწმუნებული ხარ, რომ გინდა წაშლა?")) return;
    try {
      await api("/api/news/" + encodeURIComponent(editingId), { method: "DELETE" });
      showSheet(false);
      toast("წაიშალა");
      await loadList();
    } catch (err) {
      $("#sheet-err").textContent = err.code ? msg(err) : "წაშლა ვერ მოხერხდა.";
    }
  });

  /* ---------- start ---------- */
  (async () => {
    try {
      const me = await api("/api/me");
      if (me.admin) await showApp(); else showLogin();
    } catch (_) {
      showLogin();
    }
  })();
})();
