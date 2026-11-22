/* Swing Lab — Firebase connection, sign-in, roles and the Team page.
   Coaches see everything. Players see only swings/pitches tagged with their email. */
(function () {
  const OWNER_EMAIL = "rice.chris.p4991@gmail.com"; // head coach / owner — must match firestore.rules
  const firebaseConfig = {
    apiKey: "AIzaSyDVZxbqC66nb99rr-8tlZ-wMM-AfBNKeTE",
    authDomain: "swing-lab-46465.firebaseapp.com",
    projectId: "swing-lab-46465",
    storageBucket: "swing-lab-46465.firebasestorage.app",
    messagingSenderId: "669894992236",
    appId: "1:669894992236:web:6d14f1557d86a7f7891349"
  };
  if (!window.firebase) return;
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth(), fs = firebase.firestore(), st = firebase.storage();
  const low = (s) => String(s || "").trim().toLowerCase();
  let roster = []; // [{id,name,email}]
  const emailFor = (name) => { const n = low(name); if (!n) return null; const p = roster.find(r => low(r.name) === n); return p ? p.email : null; };

  /* Writes tag each swing/pitch with the player's email so players can see their own. */
  const tag = (col, data) => {
    if (!data || typeof data !== "object") return data;
    const who = col === "pitches" ? data.pitcher : data.batter;
    if (who !== undefined) data = { ...data, playerEmail: emailFor(who) };
    return data;
  };
  const db = {
    collection: (name) => {
      const c = fs.collection(name);
      return new Proxy(c, { get: (o, k) => k === "add" ? (d) => o.add(tag(name, d)) : (typeof o[k] === "function" ? o[k].bind(o) : o[k]) });
    },
    doc: (path) => {
      const d = fs.doc(path), col = path.split("/")[0];
      return new Proxy(d, { get: (o, k) => k === "update" ? (p) => o.update(tag(col, p)) : k === "set" ? (p, x) => o.set(tag(col, p), x) : (typeof o[k] === "function" ? o[k].bind(o) : o[k]) });
    }
  };
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  const assets = {
    async upload(blob, opt) {
      const type = (opt && opt.type) || blob.type || "application/octet-stream";
      const ext = type.includes("webm") ? "webm" : type.includes("mp4") ? "mp4" : type.includes("jpeg") ? "jpg" : "bin";
      if (blob.size > 25 * 1024 * 1024) { const e = new Error("too large"); e.code = "too_large"; throw e; }
      const ref = st.ref(`media/${rid()}.${ext}`);
      await ref.put(blob, { contentType: type });
      return { id: await ref.getDownloadURL() }; // id is the playable URL
    },
    async delete(id) { try { await st.refFromURL(id).delete(); } catch (e) { } }
  };
  const downloads = {
    async save({ filename, data }) {
      const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = filename;
      document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return { status: "saved" };
    }
  };

  /* ---------- UI: sign-in gate, account bar, Team sheet ---------- */
  const css = `
  #slGate{position:fixed;inset:0;z-index:100;background:var(--bg);display:grid;place-items:center;padding:20px}
  #slGate form{width:100%;max-width:360px;display:grid;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:22px}
  #slGate h1{font-family:var(--display);text-transform:uppercase;margin:0;font-size:30px}
  #slGate input{width:100%}
  #slGate .row2{display:flex;gap:10px;flex-wrap:wrap}
  #slGate .link{background:none;border:0;padding:0;color:var(--muted);text-decoration:underline;font-size:13px;justify-self:start}
  #slAcct{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted);padding-top:10px}
  #slAcct .btn{min-height:36px;padding:6px 12px;font-size:13px}
  #slTeam ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
  #slTeam li{display:flex;gap:8px;align-items:center;background:var(--surface-2);border-radius:8px;padding:8px 10px;min-width:0}
  #slTeam li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
  #slTeam li button{border:0;background:none;color:var(--accent);font-weight:600}
  body.sl-player #addBtn,body.sl-player #newGameBtn,body.sl-player #pNewGameBtn,body.sl-player #sessAdd,body.sl-player #pSessAdd{display:none!important}`;
  const h = (tagName, attrs, kids) => { const e = document.createElement(tagName); Object.assign(e, attrs || {}); (kids || []).forEach(k => e.append(k)); return e; };

  function gate() {
    const msg = h("div", { className: "msg", hidden: true });
    const em = h("input", { type: "email", placeholder: "Email", autocomplete: "username", required: true });
    const pw = h("input", { type: "password", placeholder: "Password (6+ characters)", autocomplete: "current-password", required: true, minLength: 6 });
    const signIn = h("button", { className: "btn primary", type: "submit", textContent: "Sign in" });
    const create = h("button", { className: "btn", type: "button", textContent: "Create account" });
    const forgot = h("button", { className: "link", type: "button", textContent: "Forgot password?" });
    const show = (t, ok) => { msg.hidden = false; msg.className = "msg " + (ok ? "ok" : "err"); msg.textContent = t; };
    const nice = (e) => ({ "auth/invalid-credential": "Wrong email or password.", "auth/wrong-password": "Wrong email or password.", "auth/user-not-found": "No account with that email yet. Tap Create account.", "auth/email-already-in-use": "That email already has an account. Sign in instead.", "auth/weak-password": "Password needs at least 6 characters." }[e.code] || e.message);
    const form = h("form", {}, [h("h1", { textContent: "Swing Lab" }), h("div", { className: "note", textContent: "Players: use the email your coach added to the team." }), em, pw, h("div", { className: "row2" }, [signIn, create]), forgot, msg]);
    form.onsubmit = async (ev) => { ev.preventDefault(); try { await auth.signInWithEmailAndPassword(em.value.trim(), pw.value); } catch (e) { show(nice(e)); } };
    create.onclick = async () => { if (!form.reportValidity()) return; try { await auth.createUserWithEmailAndPassword(em.value.trim(), pw.value); } catch (e) { show(nice(e)); } };
    forgot.onclick = async () => { if (!em.value.trim()) return show("Type your email first."); try { await auth.sendPasswordResetEmail(em.value.trim()); show("Reset email sent.", true); } catch (e) { show(nice(e)); } };
    return h("div", { id: "slGate" }, [form]);
  }

  function teamSheet(ctx) {
    const wrap = h("div", { className: "sheet", id: "slTeam", hidden: true });
    const inner = h("div", { className: "sheet-in" });
    const close = h("button", { className: "btn ghost", type: "button", textContent: "Done" });
    close.onclick = () => wrap.hidden = true;
    const pList = h("ul"), cList = h("ul");
    const pName = h("input", { type: "text", placeholder: "Player name (as typed on swings)" });
    const pMail = h("input", { type: "text", placeholder: "Player email", inputMode: "email" });
    const pAdd = h("button", { className: "btn primary", type: "button", textContent: "Add player" });
    const cMail = h("input", { type: "text", placeholder: "Coach email", inputMode: "email" });
    const cAdd = h("button", { className: "btn", type: "button", textContent: "Add coach" });
    const out = h("div", { className: "note" });
    pAdd.onclick = async () => {
      const name = pName.value.trim(), email = low(pMail.value);
      if (!name || !email.includes("@")) return out.textContent = "Enter a name and an email.";
      await fs.collection("players").doc(email).set({ name, email, addedAt: new Date().toISOString() });
      // tag this player's existing swings/pitches
      let n = 0;
      for (const [col, field] of [["swings", "batter"], ["pitches", "pitcher"]]) {
        const snap = await fs.collection(col).get();
        for (const d of snap.docs) if (low(d.data()[field]) === low(name)) { await d.ref.update({ playerEmail: email }); n++; }
      }
      pName.value = pMail.value = ""; out.textContent = `Added ${name}. ${n} existing clip${n === 1 ? "" : "s"} linked.`;
    };
    cAdd.onclick = async () => {
      const email = low(cMail.value); if (!email.includes("@")) return out.textContent = "Enter an email.";
      await fs.collection("coaches").doc(email).set({ email, addedAt: new Date().toISOString() }); cMail.value = ""; out.textContent = "Coach added.";
    };
    fs.collection("players").onSnapshot(s => {
      roster = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
      pList.replaceChildren(...roster.map(p => { const x = h("button", { type: "button", textContent: "Remove" }); x.onclick = () => confirm(`Remove ${p.name}?`) && fs.collection("players").doc(p.id).delete(); return h("li", {}, [h("span", { textContent: `${p.name} · ${p.email}` }), x]); }));
      if (!roster.length) pList.append(h("li", {}, [h("span", { textContent: "No players yet." })]));
    });
    fs.collection("coaches").onSnapshot(s => {
      cList.replaceChildren(h("li", {}, [h("span", { textContent: `${OWNER_EMAIL} (owner)` })]), ...s.docs.map(d => { const x = h("button", { type: "button", textContent: "Remove" }); x.onclick = () => confirm(`Remove ${d.id}?`) && d.ref.delete(); return h("li", {}, [h("span", { textContent: d.id }), x]); }));
    });
    const imp = h("button", { className: "btn", type: "button", textContent: "Bring over old library records" });
    imp.onclick = async () => {
      imp.disabled = true;
      try { const r = await fetch("js/old-library.json"); const j = await r.json(); let n = 0;
        for (const [col, docs] of Object.entries(j)) for (const d of docs) { const { id, ...data } = d; await fs.collection(col).doc(id).set(tag(col, data), { merge: true }); n++; }
        out.textContent = `Brought over ${n} records (numbers only; the old videos stay in the Claude version).`;
      } catch (e) { out.textContent = "Couldn't import: " + e.message; imp.disabled = false; }
    };
    const panel = (title, kids) => h("div", { className: "panel" }, [h("h3", { className: "sec-h", textContent: title }), ...kids]);
    inner.append(h("div", { className: "sheet-head" }, [h("h2", { textContent: "Team" }), h("div", { className: "spacer" }), close]),
      panel("Players", [h("div", { className: "note", textContent: "Each player signs in with this email and sees only their own swings and pitches. The name must match the batter/pitcher name used on clips." }), pList, h("div", { className: "row" }, [pName, pMail, pAdd])]),
      panel("Coaches", [h("div", { className: "note", textContent: "Coaches see and edit every player." }), cList, h("div", { className: "row" }, [cMail, cAdd])]),
      panel("Old library", [imp]), out);
    if (ctx.email !== OWNER_EMAIL) cAdd.disabled = cMail.disabled = true;
    wrap.append(inner); document.body.append(wrap);
    return wrap;
  }

  let resolveReady; const readyP = new Promise(r => resolveReady = r); let started = false;
  window.SLStore = { ready: () => readyP };

  document.addEventListener("DOMContentLoaded", () => {
    document.head.append(h("style", { textContent: css }));
    const g = gate(); document.body.append(g);
    auth.onAuthStateChanged(async (u) => {
      if (!u) { g.hidden = false; if (started) location.reload(); return; }
      const email = low(u.email);
      let isCoach = email === OWNER_EMAIL;
      if (!isCoach) { try { isCoach = (await fs.collection("coaches").doc(email).get()).exists; } catch (e) { } }
      let isPlayer = false;
      if (!isCoach) { try { isPlayer = (await fs.collection("players").doc(email).get()).exists; } catch (e) { } }
      g.hidden = true; started = true;
      document.body.classList.toggle("sl-player", !isCoach);
      const ctx = { db, assets, downloads, user: u, uid: u.uid, email, isCoach };
      const bar = h("div", { id: "slAcct" }, [h("span", { textContent: `${email} · ${isCoach ? "Coach" : isPlayer ? "Player" : "Not on the team yet — ask your coach to add this email"}` })]);
      if (isCoach) { const team = teamSheet(ctx); const tb = h("button", { className: "btn", type: "button", textContent: "Team" }); tb.onclick = () => team.hidden = false; bar.append(tb); }
      else { fs.collection("players").doc(email).get().then(d => { if (d.exists) roster = [d.data()]; }).catch(() => { }); }
      const so = h("button", { className: "btn ghost", type: "button", textContent: "Sign out" }); so.onclick = () => auth.signOut(); bar.append(so);
      const top = document.querySelector("header.top"); if (top) top.after(bar); else document.body.prepend(bar);
      resolveReady(ctx);
    });
  });
})();
