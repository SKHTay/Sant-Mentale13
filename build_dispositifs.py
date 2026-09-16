#!/usr/bin/env python3
"""Régénère dispositifs.json depuis dispositifs.csv.

Le CSV est la source éditable : c'est le fichier que l'ARS et les équipes SIIS
corrigent dans un tableur. Le JSON est l'artefact servi par la page.

    python3 build_dispositifs.py dispositifs.csv dispositifs.json contenu.json

Le troisième argument est facultatif ; s'il est fourni, le script vérifie que
tous les domaines, niveaux et catégories employés dans le CSV existent bien
dans la taxonomie de contenu.json, et signale les valeurs orphelines.

Toute anomalie bloquante interrompt l'écriture : mieux vaut un JSON absent,
que la page signale, qu'un JSON silencieusement faux.
"""

import csv
import json
import sys
from collections import Counter

ARR = list(range(1, 17))
TYPES = {"lieu", "mobile", "reseau"}

COLONNES = [
    "nom", "porteur", "categorie", "type", "arrondissement_implantation",
    "arrondissements_couverts", "niveaux", "domaines", "adresse", "telephone",
    "non_localise", "specificite_marseillaise", "note", "source",
]


def liste(valeur, entier=False):
    if not valeur or not valeur.strip():
        return []
    morceaux = [m.strip() for m in valeur.split(";") if m.strip()]
    return [int(m) for m in morceaux] if entier else morceaux


def cle_inverse(mapping, libelle, champ, ligne, erreurs):
    """Retrouve la clé courte d'un libellé long, en tolérant la casse."""
    for k, v in mapping.items():
        if v.strip().lower() == libelle.strip().lower():
            return k
    erreurs.append("ligne %d, %s inconnu : %r" % (ligne, champ, libelle))
    return None


def lire(chemin_csv, taxonomie):
    erreurs, avertissements, dispositifs = [], [], []

    with open(chemin_csv, newline="", encoding="utf-8-sig") as f:
        lecteur = csv.DictReader(f, delimiter=";")
        manquantes = [c for c in COLONNES if c not in (lecteur.fieldnames or [])]
        if manquantes:
            erreurs.append("colonnes absentes du CSV : " + ", ".join(manquantes))
            return None, erreurs, avertissements

        for i, r in enumerate(lecteur, start=2):
            nom = (r["nom"] or "").strip()
            if not nom:
                erreurs.append("ligne %d, nom vide" % i)
                continue

            d = {"n": nom, "p": (r["porteur"] or "").strip()}

            if taxonomie:
                cat = cle_inverse(taxonomie["categories"], r["categorie"], "catégorie", i, erreurs)
                if cat:
                    d["c"] = cat
                doms = []
                for lib in liste(r["domaines"]):
                    k = cle_inverse(taxonomie["domaines"], lib, "domaine", i, erreurs)
                    if k:
                        doms.append(k)
                d["dm"] = doms
            else:
                d["c"] = (r["categorie"] or "").strip()
                d["dm"] = liste(r["domaines"])

            t = (r["type"] or "").strip()
            if t not in TYPES:
                erreurs.append("ligne %d, type inconnu : %r" % (i, t))
            d["t"] = t

            brut = (r["arrondissement_implantation"] or "").strip()
            if brut:
                try:
                    a = int(brut)
                except ValueError:
                    erreurs.append("ligne %d, arrondissement non numérique : %r" % (i, brut))
                    a = None
                else:
                    if a not in ARR:
                        erreurs.append("ligne %d, arrondissement hors 1-16 : %d" % (i, a))
                        a = None
                d["a"] = a
            else:
                d["a"] = None

            cov = liste(r["arrondissements_couverts"], entier=True)
            hors = [c for c in cov if c not in ARR]
            if hors:
                erreurs.append("ligne %d, couverture hors 1-16 : %s" % (i, hors))
            d["cov"] = sorted(set(c for c in cov if c in ARR))

            lv = liste(r["niveaux"], entier=True)
            hors = [n for n in lv if n not in (1, 2, 3, 4)]
            if hors:
                erreurs.append("ligne %d, niveau hors 1-4 : %s" % (i, hors))
            d["lv"] = sorted(set(n for n in lv if n in (1, 2, 3, 4)))

            if not d["lv"]:
                erreurs.append("ligne %d, aucun niveau de besoin" % i)
            if not d["dm"]:
                erreurs.append("ligne %d, aucun domaine d'accompagnement" % i)
            if not d["cov"]:
                avertissements.append("ligne %d, aucune couverture territoriale" % i)

            for src, dst in (("adresse", "ad"), ("telephone", "tel"), ("note", "note"), ("source", "src")):
                v = (r[src] or "").strip()
                if v:
                    d[dst] = v

            if (r["non_localise"] or "").strip().lower() in ("oui", "true", "1", "x"):
                d["lacune"] = True
            if (r["specificite_marseillaise"] or "").strip().lower() in ("oui", "true", "1", "x"):
                d["specif"] = True

            # cohérence : un dispositif localisé ne peut pas être marqué non localisé
            if d.get("lacune") and d["a"] is not None:
                avertissements.append(
                    "ligne %d, marqué non localisé alors qu'un arrondissement est renseigné" % i)

            dispositifs.append(d)

    doublons = [n for n, c in Counter(d["n"] + "|" + d["p"] for d in dispositifs).items() if c > 1]
    for n in doublons:
        avertissements.append("doublon nom + porteur : " + n.replace("|", ", porteur "))

    return dispositifs, erreurs, avertissements


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2

    chemin_csv, chemin_json = argv[1], argv[2]
    taxonomie = None
    if len(argv) > 3:
        with open(argv[3], encoding="utf-8") as f:
            taxonomie = json.load(f)

    dispositifs, erreurs, avertissements = lire(chemin_csv, taxonomie)

    for a in avertissements:
        print("  avertissement : " + a)
    for e in erreurs:
        print("  ERREUR : " + e)
    if erreurs:
        print("\n%d erreur(s). %s n'a pas été réécrit." % (len(erreurs), chemin_json))
        return 1

    meta = {
        "titre": "Cartographie de l'écosystème santé mentale à Marseille",
        "perimetre": "Marseille intra-muros",
        "sources": [
            "Kit Ressources DAC 13 Sud, 07/05/2026",
            "SIIS Cartographie de l'offre, 11/05/2026",
            "Atelier de cartographie SIIS, 4 parcours patients",
        ],
        "avertissement": "Recensement non exhaustif. Version de travail à consolider avec les acteurs du territoire.",
    }
    try:
        with open(chemin_json, encoding="utf-8") as f:
            meta = json.load(f).get("meta", meta)
    except (OSError, ValueError):
        pass

    with open(chemin_json, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "dispositifs": dispositifs}, f, ensure_ascii=False, indent=1)

    localises = sum(1 for d in dispositifs if d["a"] is not None)
    adresses = sum(1 for d in dispositifs if d.get("ad"))
    non_loc = sum(1 for d in dispositifs if d.get("lacune"))
    print("\n%s écrit : %d dispositifs" % (chemin_json, len(dispositifs)))
    print("  %d avec implantation, %d avec adresse complète, %d non localisés"
          % (localises, adresses, non_loc))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
