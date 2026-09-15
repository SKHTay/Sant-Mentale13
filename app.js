/* Cartographie de l'écosystème santé mentale — Marseille
   CIUS — Centre d'Innovation et d'Usages en Santé
   Données chargées depuis dispositifs.json et arrondissements-marseille.geojson */

(function () {
"use strict";

var SOCLE = null, CONTENU = null, GEO = null;
var DISPOSITIFS, DOMAINES, NIVEAUX, CATEGORIES, PARCOURS, IRRITANTS, COMPLEMENTARITES;
var ARR = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
var SIIS_ARR = [8,9,10,11,12];
var MANQUE = [];

var S = {
  niv:new Set([1,2,3,4]), dom:new Set(), cat:new Set(), typ:new Set(["lieu","mobile","reseau"]),
  mode:"carte", base:"clair", arr:null, couvArr:null, parc:null
};

var $ = function (s) { return document.querySelector(s); };
function el(t,c,h){ var e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; }
function ord(a){ return a + (a===1 ? "er" : "e"); }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ---------- chargement ---------- */
function loadJSON(url){
  return fetch(url, {cache:"no-cache"}).then(function(r){
    if(!r.ok) throw new Error(url + " — " + r.status);
    return r.json();
  });
}
function option(url){
  return loadJSON(url).catch(function(){ MANQUE.push(url); return null; });
}

Promise.all([loadJSON("dispositifs.json"), loadJSON("contenu.json"), option("arrondissements-marseille.geojson")])
  .then(function(res){ SOCLE = res[0]; CONTENU = res[1]; GEO = res[2]; boot(); })
  .catch(function(e){
    var l = $("#loader");
    l.className = "err";
    l.innerHTML = "Les données n'ont pas pu être chargées.<br>" + esc(e.message) +
      "<br><br>Servir le dossier en HTTP, par exemple <code>python3 -m http.server</code>. " +
      "Le chargement par <code>fetch</code> ne fonctionne pas depuis <code>file://</code>.";
  });

/* ---------- démarrage ---------- */
function boot(){
  DISPOSITIFS = SOCLE.dispositifs;
  DOMAINES = CONTENU.domaines; NIVEAUX = CONTENU.niveaux; CATEGORIES = CONTENU.categories;
  PARCOURS = CONTENU.parcours; IRRITANTS = CONTENU.irritants; COMPLEMENTARITES = CONTENU.complementarites;
  Object.keys(DOMAINES).forEach(function(k){ S.dom.add(k); });
  Object.keys(CATEGORIES).forEach(function(k){ S.cat.add(k); });
  S.parc = PARCOURS[0].id;

  buildNav(); buildFilters(); buildModes(); buildLegend(); buildCouvChoix();
  buildSynthese(); buildParcours(); buildIrritants();
  initMap(); render();

  var l = $("#loader"); l.className = "off";
  setTimeout(function(){ if(l && l.parentNode) l.parentNode.removeChild(l); }, 500);
}

/* ---------- navigation ---------- */
var VUES = [["synthese","Synthèse"],["carto","Cartographie"],["couv","Couverture"],
            ["parc","Parcours"],["irr","Irritants"],["meth","Méthode"]];
function buildNav(){
  var nav = $("#nav");
  VUES.forEach(function(v, i){
    var b = el("button", i===0 ? "on" : "", v[1]);
    b.onclick = function(){
      Array.prototype.forEach.call(document.querySelectorAll("nav button"), function(x){ x.classList.remove("on"); });
      b.classList.add("on");
      Array.prototype.forEach.call(document.querySelectorAll(".view"), function(x){ x.classList.remove("on"); });
      $("#v" + "-" + v[0]).classList.add("on");
      history.replaceState(null, "", "#" + v[0]);
      window.scrollTo({top:0, behavior:"smooth"});
      if(v[0]==="carto" && map) setTimeout(function(){ map.invalidateSize(); }, 140);
    };
    nav.appendChild(b);
  });
  var h = (location.hash || "").replace("#","");
  var i = VUES.map(function(v){ return v[0]; }).indexOf(h);
  if(i > 0) nav.children[i].click();
}

/* ---------- filtres ---------- */
function mkPills(host, items, set, cb){
  host.innerHTML = "";
  items.forEach(function(it){
    var p = el("span", "pill" + (set.has(it[0]) ? " on" : ""), it[1]);
    p.onclick = function(){
      if(set.has(it[0])) set.delete(it[0]); else set.add(it[0]);
      p.classList.toggle("on"); cb();
    };
    host.appendChild(p);
  });
}
function domLabels(){
  return Object.keys(DOMAINES).map(function(k){
    return [k, DOMAINES[k].split(" et ")[0].split(",")[0]];
  });
}
function catLabels(){ return Object.keys(CATEGORIES).map(function(k){ return [k, CATEGORIES[k]]; }); }
var NIV_LABELS = [[1,"1 · léger"],[2,"2 · modéré"],[3,"3 · intensif"],[4,"4 · crise"]];
var TYP_LABELS = [["lieu","Lieu d'accueil"],["mobile","Équipe mobile"],["reseau","Réseau ou opérateur"]];

function buildFilters(){
  mkPills($("#f-niv"), NIV_LABELS, S.niv, render);
  mkPills($("#f-dom"), domLabels(), S.dom, render);
  mkPills($("#f-cat"), catLabels(), S.cat, render);
  mkPills($("#f-typ"), TYP_LABELS, S.typ, render);
  buildBaseFilter();
  $("#f-reset").onclick = function(){
    S.niv = new Set([1,2,3,4]);
    S.dom = new Set(Object.keys(DOMAINES));
    S.cat = new Set(Object.keys(CATEGORIES));
    S.typ = new Set(["lieu","mobile","reseau"]);
    S.arr = null;
    buildFilters(); render();
  };
}

/* ---------- modes d'affichage ---------- */
var MODES = [["carte","Carte"],["cartogramme","Cartogramme"],["liste","Liste"]];
function buildModes(){
  var h = $("#modes"); h.innerHTML = "";
  MODES.forEach(function(m){
    var p = el("span", "pill" + (S.mode===m[0] ? " on" : ""), m[1]);
    p.onclick = function(){
      S.mode = m[0]; buildModes(); render();
      if(m[0]==="carte" && map) setTimeout(function(){ map.invalidateSize(); }, 80);
    };
    h.appendChild(p);
  });
}
var BASES = [["clair","Clair"],["plan","Plan"],["relief","Relief"]];
function buildBaseFilter(){
  var h = $("#f-base"); h.innerHTML = "";
  BASES.forEach(function(b){
    var p = el("span", "pill" + (S.base===b[0] ? " on" : ""), b[1]);
    p.onclick = function(){ S.base = b[0]; buildBaseFilter(); setBase(); };
    h.appendChild(p);
  });
}

/* ---------- logique métier ---------- */
function inter(a, set){ return a.some(function(x){ return set.has(x); }); }
function match(d){ return inter(d.lv, S.niv) && inter(d.dm, S.dom) && S.cat.has(d.c) && S.typ.has(d.t); }
function ville(d){ return (d.cov || []).length === 16; }
function ancre(d, a){ return d.a === a || (!ville(d) && (d.cov || []).indexOf(a) > -1); }
function ancres(a){ return DISPOSITIFS.filter(function(d){ return match(d) && ancre(d, a); }); }
function teinte(n){ return n===0 ? "#FFECEC" : n<=3 ? "#E0F2F9" : n<=6 ? "#CDEAF5" : "#DFF3E8"; }
function encre(n){ return n===0 ? "#B4302F" : n<=6 ? "#1F94B7" : "#1D7A52"; }

/* ---------- carte ---------- */
var map = null, gjLayer = null, baseLayers = {}, current = null;

function couchePerdue(msg){
  $("#mapwarn").innerHTML = "<div class='fallback'>" + msg +
    "<br><br>La vue <b>Cartogramme</b> ci-dessous affiche les mêmes comptages par arrondissement " +
    "et ne demande aucune ressource externe.</div>";
  $("#map").innerHTML = "";
  MODES = MODES.filter(function(m){ return m[0] !== "carte"; });
  S.mode = "cartogramme";
  buildModes();
}
function initMap(){
  if(typeof L === "undefined"){
    couchePerdue("Leaflet n'a pas pu être chargé, ni en local ni depuis unpkg. Vérifier la présence de <code>leaflet.js</code> à la racine.");
    return;
  }
  if(!GEO){
    couchePerdue("Le fichier <code>arrondissements-marseille.geojson</code> est absent ou illisible. Le récupérer à la racine du dépôt Carto Santé PACA.");
    return;
  }
  map = L.map("map", { zoomControl:true, preferCanvas:true, scrollWheelZoom:false })
         .setView([43.295, 5.400], 11.5);

  baseLayers.clair = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    { maxZoom:16, attribution:"Fond © Esri" });
  baseLayers.plan = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom:18, attribution:"© OpenStreetMap" });
  baseLayers.relief = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { maxZoom:16, attribution:"© OpenTopoMap, © OpenStreetMap" });

  baseLayers.clair.addTo(map); current = baseLayers.clair;

  gjLayer = L.geoJSON(GEO, {
    style: styleArr,
    onEachFeature: function(f, lyr){
      var a = numArr(f);
      lyr.on("mouseover", function(){
        lyr.setStyle({ weight:2.5, fillOpacity:.92 });
        var n = ancres(a).length;
        $("#hoverbar").innerHTML = "<b>" + ord(a) + " arrondissement</b> · " + n +
          " dispositif" + (n>1 ? "s" : "") + " ancré" + (n>1 ? "s" : "") +
          (SIIS_ARR.indexOf(a)>-1 ? " · couvert par une équipe SIIS" : " · hors périmètre SIIS");
      });
      lyr.on("mouseout", function(){ gjLayer.resetStyle(lyr); $("#hoverbar").innerHTML = ""; });
      lyr.on("click", function(){
        S.arr = a; drawPanel(); paintMap();
        $("#panel-arr").scrollIntoView({ behavior:"smooth", block:"nearest" });
      });
    }
  }).addTo(map);

  L.control.scale({ imperial:false }).addTo(map);
}
function numArr(f){ return parseInt(f.properties.c, 10) - 13200; }
function styleArr(f){
  var a = numArr(f), n = ancres(a).length, sel = (S.arr === a);
  return {
    color: SIIS_ARR.indexOf(a) > -1 ? "#6D48E8" : "#8f8d86",
    weight: sel ? 3.5 : (SIIS_ARR.indexOf(a) > -1 ? 2 : 0.9),
    fillColor: teinte(n),
    fillOpacity: sel ? 0.95 : 0.8,
    dashArray: SIIS_ARR.indexOf(a) > -1 ? null : "3 3"
  };
}
function paintMap(){ if(map && gjLayer) gjLayer.setStyle(styleArr); }
function setBase(){
  if(!map) return;
  if(current) map.removeLayer(current);
  current = baseLayers[S.base] || baseLayers.clair;
  current.addTo(map);
  if(gjLayer) gjLayer.bringToFront();
}

/* ---------- cartogramme ---------- */
var GRID = [15,16,14,13, 2,3,4,12, 1,5,10,11, 7,6,8,9];
function drawCarto(){
  var h = $("#cartogram"); h.innerHTML = "";
  GRID.forEach(function(a){
    var n = ancres(a).length;
    var d = el("div", "cg" + (SIIS_ARR.indexOf(a)>-1 ? " siis" : ""),
      "<b>" + ord(a) + "</b><span>" + n + "</span>");
    d.style.background = teinte(n); d.style.color = encre(n);
    d.onclick = function(){ S.arr = a; drawPanel(); paintMap(); };
    h.appendChild(d);
  });
}

/* ---------- liste ---------- */
function drawList(){
  var t = $("#tbody"); t.innerHTML = "";
  DISPOSITIFS.filter(match).sort(function(x,y){ return x.n.localeCompare(y.n,"fr"); }).forEach(function(d){
    var cov = (d.cov||[]).length === 16 ? "tout Marseille"
            : ((d.cov||[]).map(function(a){ return ord(a); }).join(", ") || "—");
    t.appendChild(el("tr","",
      "<td><span class='dn'>" + esc(d.n) + "</span><br><span class='dp'>" + esc(d.p) + "</span></td>" +
      "<td class='small'>" + CATEGORIES[d.c] + "</td>" +
      "<td class='small'>" + d.lv.join(", ") + "</td>" +
      "<td class='small'>" + (d.a ? ord(d.a) + " arr." : (d.lacune ? "<span class='chip warn'>non localisé</span>" : "—")) + "</td>" +
      "<td class='small'>" + cov + "</td>"));
  });
}

/* ---------- panneau arrondissement ---------- */
function rows(list){
  if(!list.length) return "<p class='small' style='margin:4px 0 0;color:var(--cius-mute)'>Aucun dispositif pour ces filtres.</p>";
  return list.map(function(d){
    return "<div class='row'><span>" + esc(d.n) + (d.lacune ? " <span class='chip warn'>non localisé</span>" : "") +
           "</span><em>" + esc(d.ad || d.p) + "</em></div>";
  }).join("");
}
function drawPanel(){
  var h = $("#panel-arr");
  if(S.arr === null){ h.innerHTML = ""; return; }
  var a = S.arr, sel = DISPOSITIFS.filter(match);
  var ici = sel.filter(function(d){ return d.a === a; });
  var dehors = sel.filter(function(d){ return d.a !== a && !ville(d) && (d.cov||[]).indexOf(a) > -1; });
  var absents = sel.filter(function(d){ return d.a !== a && !ville(d) && (d.cov||[]).indexOf(a) === -1; });
  var partout = sel.filter(function(d){ return d.a !== a && ville(d); });
  var siis = SIIS_ARR.indexOf(a) > -1;

  h.innerHTML =
   "<div class='panel'><div style='display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap'>" +
   "<h3>" + ord(a) + " arrondissement</h3>" +
   "<span class='chip " + (siis ? "violet" : "warn") + "'>" + (siis ? "couvert par une équipe SIIS" : "hors périmètre SIIS") + "</span></div>" +
   "<div class='blk'><p class='blkh' style='color:#1D7A52'>Implantés ici — " + ici.length + "</p>" + rows(ici) + "</div>" +
   "<div class='blk'><p class='blkh' style='color:#1F94B7'>Interviennent ici depuis ailleurs — " + dehors.length + "</p>" + rows(dehors) + "</div>" +
   "<div class='blk'><p class='blkh' style='color:#B4302F'>Ne couvrent pas cet arrondissement — " + absents.length + "</p>" +
     (absents.length ? absents.map(function(d){
        return "<div class='row'><span>" + esc(d.n) + "</span><em>" +
               (d.cov||[]).map(function(x){ return ord(x); }).join(", ") + "</em></div>"; }).join("")
      : "<p class='small' style='margin:4px 0 0;color:var(--cius-mute)'>Aucun.</p>") + "</div>" +
   "<div class='blk'><p class='blkh' style='color:#5733C9'>Ressources à l'échelle de la ville — " + partout.length + "</p>" +
     "<div class='chips'>" + partout.map(function(d){
        return "<span class='chip" + (d.lacune ? " warn" : "") + "'>" + esc(d.n) + "</span>"; }).join("") + "</div></div>" +
   "<p class='micro' style='margin-top:16px'>Le comptage territorial ne retient que les dispositifs implantés sur place ou rattachés au secteur. " +
   "Le bloc logement et hébergement n'est pas localisé à l'arrondissement dans les sources disponibles.</p></div>";
}

/* ---------- légende ---------- */
function buildLegend(){
  $("#map-legend").innerHTML =
    "<span><i class='sw' style='background:#FFECEC'></i>aucun dispositif ancré</span>" +
    "<span><i class='sw' style='background:#E0F2F9'></i>1 à 3</span>" +
    "<span><i class='sw' style='background:#CDEAF5'></i>4 à 6</span>" +
    "<span><i class='sw' style='background:#DFF3E8'></i>7 et plus</span>" +
    "<span style='border-left:1px solid var(--cius-line);padding-left:16px'>" +
    "<i class='sw' style='background:#fff;border:2px solid #6D48E8'></i>couvert par une équipe SIIS</span>";
}

/* ---------- matrice de couverture ---------- */
function buildCouvChoix(){
  var h = $("#couv-arr"); h.innerHTML = "";
  var choix = [["all","Tout Marseille"]].concat(ARR.map(function(a){ return [String(a), ord(a)]; }));
  choix.forEach(function(c){
    var on = (S.couvArr === null && c[0] === "all") || String(S.couvArr) === c[0];
    var p = el("span", "pill" + (on ? " on" : ""), c[1]);
    p.onclick = function(){ S.couvArr = (c[0]==="all") ? null : parseInt(c[0],10); buildCouvChoix(); drawMatrix(); };
    h.appendChild(p);
  });
}
function drawMatrix(){
  var m = $("#matrix"); if(!m) return;
  var pool = (S.couvArr === null) ? DISPOSITIFS
           : DISPOSITIFS.filter(function(d){ return ancre(d, S.couvArr) || d.lacune; });
  var html = "<span></span>" + [1,2,3,4].map(function(n){
    return "<span class='mxh'>" + NIVEAUX[n].replace("Besoin ","") + "</span>"; }).join("");
  Object.keys(DOMAINES).forEach(function(k){
    html += "<span class='mxl'>" + DOMAINES[k] + "</span>";
    [1,2,3,4].forEach(function(n){
      var hits = pool.filter(function(d){ return d.dm.indexOf(k) > -1 && d.lv.indexOf(n) > -1; });
      var loc = hits.filter(function(d){ return d.a !== null; });
      var cls, val;
      if(hits.length === 0){ cls = "z"; val = "0"; }
      else if(loc.length === 0){ cls = "h"; val = hits.length; }
      else if(loc.length <= 2){ cls = "a"; val = loc.length; }
      else { cls = "b"; val = loc.length; }
      html += "<span class='cl " + cls + "' title='" + esc(hits.map(function(d){ return d.n; }).join(" · ")) + "'>" + val + "</span>";
    });
  });
  m.innerHTML = html;
}

/* ---------- parcours ---------- */
function buildParcours(){
  var t = $("#parc-tabs"); t.innerHTML = "";
  PARCOURS.forEach(function(p){
    var b = el("span", "pill" + (S.parc === p.id ? " on" : ""), p.nom);
    b.onclick = function(){ S.parc = p.id; buildParcours(); };
    t.appendChild(b);
  });
  drawParcours();
}
function drawParcours(){
  var p = PARCOURS.filter(function(x){ return x.id === S.parc; })[0];
  $("#parc-body").innerHTML =
    "<div class='grid g2'><div><h3>" + p.nom + "</h3>" +
    "<p class='lead' style='font-size:17px;margin-top:10px'>" + p.resume + "</p>" +
    "<div class='grid g4' style='margin-top:18px'>" +
      "<div class='stat'><div class='v'>" + p.chiffres.etapes + "</div><div class='k'>étapes</div></div>" +
      "<div class='stat'><div class='v'>" + p.chiffres.dispositifs + "</div><div class='k'>dispositifs mobilisés</div></div>" +
      "<div class='stat'><div class='v'>" + p.chiffres.outils + "</div><div class='k'>outils partagés</div></div>" +
      "<div class='stat'><div class='v'>" + p.chiffres.irritants + "</div><div class='k'>irritants signalés</div></div>" +
    "</div><div class='card soft' style='margin-top:18px'><h4>Doublons</h4><p class='small'>" + p.doublon + "</p></div></div>" +
    "<div class='card'><p class='eyebrow'>Parcours chronologique</p><div class='steps'>" +
      p.etapes.map(function(e){ return "<div class='step'><b>" + e[0] + "</b><p>" + e[1] + "</p></div>"; }).join("") +
    "</div></div></div>";
}

/* ---------- irritants ---------- */
function buildIrritants(){
  $("#irr-list").innerHTML = IRRITANTS.map(function(i){
    return "<div class='card' style='margin-bottom:16px'>" +
      "<div style='display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap'>" +
      "<h3 style='font-size:20px'>" + i.rang + ". " + i.titre + "</h3>" +
      "<div class='chips'><span class='chip'>" + i.fam + "</span>" +
      "<span class='chip violet'>" + i.occ + " occurrences sur 38</span></div></div>" +
      "<div class='bar' style='margin:12px 0 16px'><i style='width:" + Math.round(i.occ/11*100) + "%'></i></div>" +
      "<div class='grid g2'><div><p class='small'>" + i.texte + "</p>" +
        i.cit.map(function(c){ return "<p class='q' style='font-size:14px'>«&#8239;" + c + "&#8239;»</p>"; }).join("") + "</div>" +
      "<div class='card soft'><h4>Bonnes pratiques identifiées</h4><ul class='small'>" +
        i.bp.map(function(b){ return "<li>" + b + "</li>"; }).join("") + "</ul>" +
        "<h4>Piste d'amélioration</h4><p class='small'>" + i.piste + "</p></div></div></div>";
  }).join("");

  $("#compl").innerHTML = COMPLEMENTARITES.map(function(c){
    return "<div class='card'><h4>" + c[0] + "</h4><p class='small'>" + c[1] + "</p></div>";
  }).join("");
}

/* ---------- synthèse et méthode ---------- */
function buildSynthese(){
  $("#s-disp").textContent = DISPOSITIFS.length;
  $("#m-total").textContent = DISPOSITIFS.length;
  $("#m-loc").textContent = DISPOSITIFS.filter(function(d){ return d.a !== null; }).length;
  $("#m-adr").textContent = DISPOSITIFS.filter(function(d){ return !!d.ad; }).length;
  $("#m-lac").textContent = DISPOSITIFS.filter(function(d){ return !!d.lacune; }).length;

  var niv = [
   [1,"Médecine de ville, psychiatres libéraux, GEM marseillais, médiateurs de santé pairs, UNAFAM, CCAS, MDPH, Working First."],
   [2,"CMP, hôpitaux de jour, SAMSAH, SAVS handicap psychique, EMPP et EMMSP, DAC 13, CATTP, ACT, pensions de famille."],
   [3,"SIIS Santé mentale, équipes EMI et SIDIIS, équipes mobiles ESAMH et EDI, Un Chez-Soi d'Abord, appartements thérapeutiques, MARSS."],
   [4,"Hospitalisation temps plein, AP-HM, CH Valvert, CH Édouard Toulouse, ULICE, Lieu de Répit, LHSS et LAM."]];
  $("#niv-cards").innerHTML = niv.map(function(x){
    return "<div style='padding:12px 0;border-bottom:1px solid var(--cius-line)'>" +
      "<div style='display:flex;gap:10px;align-items:baseline'><span class='chip violet'>Niveau " + x[0] + "</span>" +
      "<b style='font-size:14px;font-weight:600'>" + NIVEAUX[x[0]] + "</b></div>" +
      "<p class='small' style='margin:6px 0 0'>" + x[1] + "</p></div>";
  }).join("");

  $("#specif").innerHTML = DISPOSITIFS.filter(function(d){ return d.specif; })
    .map(function(d){ return "<span class='chip cyan'>" + esc(d.n) + "</span>"; }).join("");
}

/* ---------- rendu global ---------- */
function render(){
  $("#pane-map").style.display   = (S.mode === "carte") ? "block" : "none";
  $("#pane-carto").style.display = (S.mode === "cartogramme") ? "block" : "none";
  $("#pane-list").style.display  = (S.mode === "liste") ? "block" : "none";
  $("#map-legend").style.display = (S.mode === "liste") ? "none" : "flex";

  var sel = DISPOSITIFS.filter(match);
  var loc = sel.filter(function(d){ return d.a !== null; }).length;
  var pct = sel.length ? Math.round(loc / sel.length * 100) : 0;
  $("#cover-badge").innerHTML = "<span class='chip " + (pct < 60 ? "warn" : "cyan") + "'>" +
    sel.length + " dispositifs · " + pct + " % localisés</span>";

  paintMap(); drawCarto(); drawList(); drawPanel(); drawMatrix();
}

})();
