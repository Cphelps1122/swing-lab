/* Swing Lab physics: game-day air from the clip's own time and GPS, ball flight with drag + backspin lift + wind,
   pitch speed out of the hand, a bat-ball collision check, and combining scale from ball size and bat length. */
(function () {
  const MPS = 0.44704, FT = 3.28084;

  // ---- clip metadata: iPhone .mov files carry creation time and GPS; DJI files carry the time in the file name
  async function clipInfo(file) {
    const out = { when: null, lat: null, lon: null, altM: null, src: [] };
    try {
      const chunk = async (a, b) => new TextDecoder("latin1").decode(await file.slice(Math.max(0, a), Math.min(file.size, b)).arrayBuffer());
      const txt = (await chunk(0, 3e6)) + (await chunk(file.size - 3e6, file.size));
      const g = txt.match(/([+-]\d{1,2}\.\d{3,})([+-]\d{1,3}\.\d{3,})([+-]\d+(?:\.\d+)?)?\//);
      if (g) { out.lat = +g[1]; out.lon = +g[2]; if (g[3]) out.altM = +g[3]; out.src.push("GPS from clip"); }
      const d = txt.match(/(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:?\d\d)/);
      if (d) { out.when = new Date(d[1].replace(/([+-]\d\d)(\d\d)$/, "$1:$2")); out.src.push("time from clip"); }
    } catch (e) { }
    if (!out.when) { const m = /(20\d\d)(\d\d)(\d\d)_(\d\d)(\d\d)(\d\d)/.exec(file.name || ""); if (m) { out.when = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); out.src.push("time from file name"); } }
    if (!out.when && file.lastModified) { out.when = new Date(file.lastModified); out.src.push("time from file date"); }
    return out;
  }

  // ---- weather at that place and hour (Open-Meteo, free, no key)
  function airDensity(tC, rh, pHpa) {
    const es = 6.1078 * Math.pow(10, 7.5 * tC / (tC + 237.3)), pv = rh / 100 * es, pd = pHpa - pv, T = tC + 273.15;
    return (pd * 100) / (287.058 * T) + (pv * 100) / (461.495 * T);
  }
  async function weather(info, home) {
    let lat = info.lat, lon = info.lon, where = "clip GPS";
    if (lat == null && home && home.lat != null) { lat = home.lat; lon = home.lon; where = "home field"; }
    if (lat == null || !info.when) return null;
    const day = info.when.toISOString().slice(0, 10), ageDays = (Date.now() - info.when) / 864e5;
    const q = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&timezone=UTC&start_date=${day}&end_date=${day}`;
    const url = (ageDays > 5 ? "https://archive-api.open-meteo.com/v1/archive?" : "https://api.open-meteo.com/v1/forecast?") + q;
    try {
      const j = await (await fetch(url)).json(); const H = j.hourly; if (!H) return null;
      const hr = info.when.getUTCHours(), i = Math.max(0, H.time.findIndex(t => +t.slice(11, 13) === hr));
      const tC = H.temperature_2m[i], rh = H.relative_humidity_2m[i], p = H.surface_pressure[i];
      if (![tC, rh, p].every(Number.isFinite)) return null;
      return { tempF: tC * 9 / 5 + 32, rh, pressHpa: p, windMph: H.wind_speed_10m[i], windFrom: H.wind_direction_10m[i], rho: airDensity(tC, rh, p), where };
    } catch (e) { return null; }
  }

  // ---- ball flight: drag + backspin lift (Magnus) + wind along the line of the hit
  // spin: typical backspin off the bat rises with launch angle; lift coefficient from spin factor (Nathan's fits)
  function flight(SPC, evMph, laDeg, hFt, air) {
    const m = SPC.mass, r = SPC.dm / 2, A = Math.PI * r * r, rho = (air && air.rho) || 1.18, Cd = SPC.cd;
    const rpm = laDeg <= 0 ? 0 : Math.min(3000, (SPC.k === "baseball" ? 1200 : 900) + 45 * laDeg);
    const w = rpm * 2 * Math.PI / 60, tail = (air && air.tailMph || 0) * MPS;   // + = blowing out
    let vx = evMph * MPS * Math.cos(laDeg * Math.PI / 180), vy = evMph * MPS * Math.sin(laDeg * Math.PI / 180);
    let X = 0, Y = hFt / FT, t = 0, ap = Y; const dt = 0.002, path = [[0, Y]];
    while (Y > 0 && t < 12) {
      const ux = vx - tail, uy = vy, sp = Math.hypot(ux, uy) || 1e-6;
      const S = r * w / sp, CL = Math.min(0.35, 1.5 * S / (1 + 2.2 * S));
      const kd = 0.5 * rho * Cd * A * sp / m, kl = 0.5 * rho * CL * A * sp / m;
      const ax = -kd * ux - kl * uy, ay = -9.81 - kd * uy + kl * ux;   // lift is perpendicular to air velocity (backspin lifts)
      vx += ax * dt; vy += ay * dt; X += vx * dt; Y += vy * dt; t += dt; if (Y > ap) ap = Y;
      if (((t / dt) | 0) % 10 === 0) path.push([X, Math.max(Y, 0)]);
    }
    return { dist: X * FT, hang: t, apex: ap * FT, rpm, path: path.map(([x, y]) => [x * FT, y * FT]) };
  }

  // ---- pitch: the clip sees the ball near the plate; radar guns read out of the hand, so add back what drag took
  function releaseSpeed(SPC, plateMph, air, ftTravelled) {
    const rho = (air && air.rho) || 1.18, k = 0.5 * rho * SPC.cd * Math.PI * (SPC.dm / 2) ** 2 / SPC.mass; // per metre
    return plateMph * Math.exp(k * (ftTravelled / FT));
  }

  // ---- bat-ball collision: exit speed can't beat q*pitch + (1+q)*bat (q ≈ 0.20 softball, 0.21 baseball)
  function maxExit(SPC, pitchMph, batMph) { const q = SPC.k === "baseball" ? 0.21 : 0.20; return q * (pitchMph || 0) + (1 + q) * batMph; }

  // ---- scale from more than one ruler: ball diameter and the bat's knob-to-tip length (from the bat model)
  // bat keypoints sit ~28.5 in apart on a 33 in bat (measured on team film against ball size)
  function fuseScale(SPC, ball, ballDiamPx, batLenPx) {
    const est = [];
    if (ball && ballDiamPx) est.push({ s: ball, w: Math.pow(ballDiamPx / 1.0, 2) });              // ±1 px on the ball's diameter
    if (batLenPx) { const batFt = (SPC.k === "baseball" ? 29.5 : 28.5) / 12; est.push({ s: batLenPx / batFt, w: 156 }); /* ~8% uncertainty */ }
    if (!est.length) return null;
    const W = est.reduce((a, e) => a + e.w, 0); return { scale: est.reduce((a, e) => a + e.s * e.w, 0) / W, parts: est.map(e => e.s) };
  }

  window.SLPhys = { clipInfo, weather, airDensity, flight, releaseSpeed, maxExit, fuseScale };
})();
