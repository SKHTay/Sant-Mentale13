"""Tests d'intégrité du socle de dispositifs et de la taxonomie.

Lancés par run_tests.py. Aucune dépendance externe.
Chaque fonction test_* retourne une liste d'échecs, vide si tout va bien.
"""

import json
import os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARR = list(range(1, 17))
SIIS_ARR = [8, 9, 10, 11, 12]


def charger(nom):
    with open(os.path.join(RACINE, nom), encoding="utf-8") as f:
        return json.load(f)


def test_fichiers_presents():
    attendus = [
        "index.html", "styles.css", "app.js",
        "dispositifs.json", "contenu.json", "dispositifs.csv",
        "arrondissements-marseille.geojson", "leaflet.js", "leaflet.css",
    ]
    return ["fichier absent : " + n for n in attendus
            if not os.path.exists(os.path.join(RACINE, n))]


def test_json_valides():
    echecs = []
    for n in ("dispositifs.json", "contenu.json", "arrondissements-marseille.geojson"):
        try:
            charger(n)
        except Exception as e:
            echecs.append("%s illisible : %s" % (n, e))
    return echecs


def test_taxonomie_couverte():
    """Tout domaine, niveau et catégorie employé doit exister dans contenu.json."""
    socle, contenu = charger("dispositifs.json"), charger("contenu.json")
    echecs = []
    for d in socle["dispositifs"]:
        if d["c"] not in contenu["categories"]:
            echecs.append("%s — catégorie inconnue : %s" % (d["n"], d["c"]))
        for k in d["dm"]:
            if k not in contenu["domaines"]:
                echecs.append("%s — domaine inconnu : %s" % (d["n"], k))
        for n in d["lv"]:
            if str(n) not in contenu["niveaux"]:
                echecs.append("%s — niveau inconnu : %s" % (d["n"], n))
    return echecs


def test_champs_obligatoires():
    socle = charger("dispositifs.json")
    echecs = []
    for d in socle["dispositifs"]:
        for champ in ("n", "p", "c", "t", "lv", "dm", "cov"):
            if champ not in d:
                echecs.append("%s — champ manquant : %s" % (d.get("n", "?"), champ))
        if not d.get("lv"):
            echecs.append("%s — aucun niveau de besoin" % d.get("n"))
        if not d.get("dm"):
            echecs.append("%s — aucun domaine" % d.get("n"))
    return echecs


def test_arrondissements_valides():
    socle = charger("dispositifs.json")
    echecs = []
    for d in socle["dispositifs"]:
        if d.get("a") is not None and d["a"] not in ARR:
            echecs.append("%s — implantation hors 1-16 : %s" % (d["n"], d["a"]))
        for c in d.get("cov", []):
            if c not in ARR:
                echecs.append("%s — couverture hors 1-16 : %s" % (d["n"], c))
    return echecs


def test_coherence_localisation():
    """Un dispositif marqué non localisé ne doit pas porter d'arrondissement."""
    socle = charger("dispositifs.json")
    return ["%s — marqué non localisé mais implanté dans le %se" % (d["n"], d["a"])
            for d in socle["dispositifs"] if d.get("lacune") and d.get("a") is not None]


def test_geojson_seize_arrondissements():
    gj = charger("arrondissements-marseille.geojson")
    nums = sorted(int(f["properties"]["c"]) - 13200 for f in gj["features"])
    if nums != ARR:
        return ["le geojson ne porte pas les 16 arrondissements : %s" % nums]
    return []


def test_secteurs_siis():
    """Les équipes EMI et SIDIIS doivent couvrir exactement les cinq secteurs annoncés."""
    socle, contenu = charger("dispositifs.json"), charger("contenu.json")
    echecs = []
    index = {d["n"].split(" —")[0]: d for d in socle["dispositifs"]}
    for nom, attendu in contenu["secteursSIIS"].items():
        d = index.get(nom)
        if d is None:
            echecs.append("équipe absente du socle : " + nom)
        elif sorted(d.get("cov", [])) != sorted(attendu):
            echecs.append("%s couvre %s, attendu %s" % (nom, d.get("cov"), attendu))
    couverture = sorted(set(sum(contenu["secteursSIIS"].values(), [])))
    if couverture != sorted(SIIS_ARR):
        echecs.append("périmètre SIIS incohérent : %s" % couverture)
    return echecs


def test_tout_arrondissement_a_un_ancrage():
    """Aucun arrondissement ne doit être totalement vide : ce serait un trou de recensement."""
    socle = charger("dispositifs.json")
    def ville(d):
        return len(d.get("cov", [])) == 16
    def ancre(d, a):
        return d.get("a") == a or (not ville(d) and a in d.get("cov", []))
    echecs = []
    for a in ARR:
        n = sum(1 for d in socle["dispositifs"] if ancre(d, a))
        if n == 0:
            echecs.append("aucun dispositif ancré dans le %se arrondissement" % a)
    return echecs


def test_irritants_somme_38():
    contenu = charger("contenu.json")
    total = sum(i["occ"] for i in contenu["irritants"])
    if total != 38:
        return ["la somme des occurrences vaut %d, attendu 38" % total]
    return []


def test_parcours_complets():
    contenu = charger("contenu.json")
    echecs = []
    for p in contenu["parcours"]:
        if len(p["etapes"]) != p["chiffres"]["etapes"]:
            echecs.append("%s — %d étapes listées, %d annoncées"
                          % (p["nom"], len(p["etapes"]), p["chiffres"]["etapes"]))
        if not p.get("doublon"):
            echecs.append("%s — rubrique doublons non renseignée" % p["nom"])
    return echecs


def test_aucune_donnee_nominative():
    """Contrôle RGPD : pas d'adresse e-mail personnelle dans le socle publié."""
    brut = open(os.path.join(RACINE, "dispositifs.json"), encoding="utf-8").read()
    return ["le socle contient une adresse e-mail"] if "@" in brut else []
