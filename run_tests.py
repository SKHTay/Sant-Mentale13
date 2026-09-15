#!/usr/bin/env python3
"""Vérifie l'intégrité du dépôt avant publication.

    python3 run_tests.py

Sortie 0 si tout passe, 1 sinon. Aucune dépendance externe.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests"))

import test_dispositifs as T  # noqa: E402


def main():
    fonctions = sorted(
        (n, getattr(T, n)) for n in dir(T) if n.startswith("test_")
    )
    total_echecs = 0
    for nom, fn in fonctions:
        libelle = nom[5:].replace("_", " ")
        try:
            echecs = fn() or []
        except Exception as e:
            echecs = ["exception : %s" % e]
        if echecs:
            total_echecs += len(echecs)
            print("  ÉCHEC  %s" % libelle)
            for e in echecs[:12]:
                print("         %s" % e)
            if len(echecs) > 12:
                print("         … et %d autres" % (len(echecs) - 12))
        else:
            print("  ok     %s" % libelle)

    print("")
    if total_echecs:
        print("%d problème(s) à corriger avant publication." % total_echecs)
        return 1
    print("%d contrôles passés. Le dépôt est publiable." % len(fonctions))
    return 0


if __name__ == "__main__":
    sys.exit(main())
