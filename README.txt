Cartographie de l'écosystème santé mentale à Marseille.
Expérimentation SIIS Santé mentale, Article 51, ARS PACA. Produit par le CIUS.

Tous les fichiers sont à la racine du dépôt : index.html charge les données en
chemin relatif nu, sans sous-dossier. Seul le dossier tests/ fait exception.

Site statique, aucun build, aucune dépendance serveur.


DÉPLOIEMENT
  1. Copier tous les fichiers à la racine d'un dépôt public.
  2. Settings > Pages > Deploy from a branch, branche main, dossier / (root).
  3. En ligne sous une minute sur https://<compte>.github.io/<depot>/

  Le fichier .nojekyll évite que Pages ne filtre des fichiers au passage.

  En local, servir le dossier en HTTP : les données sont chargées par fetch,
  qui ne fonctionne pas depuis file://.

      python3 -m http.server 8080


DONNÉES
  dispositifs.json                  101 dispositifs, dont 44 avec implantation, 34 avec adresse
                                    complète, 30 connus mais non localisés
  dispositifs.csv                   même socle, source éditable en tableur (point-virgule, UTF-8 BOM)
  contenu.json                      taxonomie (8 domaines, 4 niveaux, 6 catégories), 4 parcours
                                    patients, 7 irritants, 4 complémentarités
  arrondissements-marseille.geojson 16 arrondissements municipaux (13201-13216), repris du
                                    dépôt Carto Santé PACA

  La page se charge même si le geojson manque : la carte s'affiche alors
  désactivée avec la marche à suivre, et la vue Cartogramme prend le relais.
  Elle donne les mêmes comptages sans aucune ressource externe.


SCRIPTS
  build_dispositifs.py              dispositifs.csv vers dispositifs.json, avec validation
  run_tests.py                      12 contrôles d'intégrité avant publication

      python3 build_dispositifs.py dispositifs.csv dispositifs.json contenu.json

  Le troisième argument est facultatif ; s'il est fourni, le script vérifie que
  tous les domaines et catégories employés dans le CSV existent dans la
  taxonomie, et signale les valeurs orphelines.

  Toute anomalie bloquante interrompt l'écriture. Un JSON absent, que la page
  signale, vaut mieux qu'un JSON silencieusement faux.

      python3 run_tests.py

  Contrôle notamment que les 16 arrondissements sont présents dans le geojson,
  qu'aucun arrondissement n'est totalement vide, que la somme des occurrences
  d'irritants fait bien 38, que le périmètre SIIS déclaré correspond aux
  couvertures des équipes EMI et SIDIIS, et qu'aucune adresse e-mail
  nominative n'a été publiée dans le socle.


------------------------------------------------------------------------
dispositifs.csv

Sorti du JSON à dessein : c'est le fichier que l'ARS et les équipes SIIS
corrigent, dans un tableur, sans toucher au code. Le remplacer ne demande que
de relancer build_dispositifs.py.

  nom, porteur                      intitulé et opérateur
  categorie                         sanitaire, médico-social, social et inclusion,
                                    entraide et pair-aidance, logement et hébergement,
                                    coordination et appui
  type                              lieu (accueil physique), mobile (équipe qui se
                                    déplace), reseau (opérateur ou dispositif sans
                                    lieu propre)
  arrondissement_implantation       1 à 16, vide si non documenté
  arrondissements_couverts          séparés par des points-virgules. Les 16 valeurs
                                    signifient une couverture à l'échelle de la ville
  niveaux                           1 léger, 2 modéré, 3 intensif, 4 crise
  domaines                          les huit libellés du schéma de synthèse SIIS
  adresse, telephone                coordonnées institutionnelles uniquement
  non_localise                      oui si le dispositif existe mais n'est pas situé
  specificite_marseillaise          oui pour ce qui ne relève pas du droit commun
  note, source                      précision et provenance de la ligne

Implantation et couverture ne disent pas la même chose, et c'est le point qui
fausse le plus facilement une carte. Une équipe mobile n'a pas de lieu
d'accueil, elle a une zone d'intervention : MARSS couvre tout Marseille depuis
l'AP-HM, ULICE seulement les 8e, 9e et 10e. L'épingler sur son bureau dirait
où sont les locaux, pas qui est couvert.


------------------------------------------------------------------------
Règle d'ancrage territorial

Les comptages par arrondissement ne retiennent que les dispositifs ancrés :
implantés sur place, ou rattachés au secteur et couvrant l'arrondissement. Les
ressources à l'échelle de la ville ne sont comptées que là où elles sont
implantées, et listées à part dans le panneau de détail.

Sans cette règle, les seize arrondissements affichaient un total quasi
identique, entre 62 et 70, et tout écart territorial disparaissait. Avec, les
valeurs vont de 3 dans le 7e à 12 dans le 15e.


------------------------------------------------------------------------
Rouge et hachuré

Dans la matrice de couverture, deux absences qui ne disent pas la même chose :

  rouge     aucun dispositif ancré sur ce territoire. Information sur le territoire
  hachuré   dispositif connu mais implantation non documentée. Information sur
            l'état du recensement

Les confondre ferait dire à la carte plus que ce qu'elle sait. Le bloc
logement et hébergement est presque intégralement hachuré : c'est un constat
sur nos sources, pas sur Marseille.


------------------------------------------------------------------------
LES SIX VUES

  Synthèse        contexte, objectifs, gradation de l'offre par niveau de besoin,
                  spécificités marseillaises face au droit commun
  Cartographie    carte des 16 arrondissements, cartogramme, liste filtrable.
                  Filtres : niveau, domaine, catégorie, périmètre d'action.
                  Clic sur un arrondissement : ce qui y est implanté, ce qui y
                  intervient depuis ailleurs, ce qui ne le couvre pas
  Couverture      matrice 8 domaines x 4 niveaux, par territoire
  Parcours        les 4 parcours patients, étapes, dispositifs, doublons
  Irritants       7 familles, 38 occurrences, bonnes pratiques et pistes
  Méthode         sources, indicateurs de couverture de la donnée, limites, RGPD

Fonds de carte : Esri Light Gray Canvas par défaut, OpenStreetMap, OpenTopoMap.
Leaflet 1.9.4 vendorisé à la racine, avec repli sur unpkg si le fichier manque.


------------------------------------------------------------------------
CE QUI RESTE À FAIRE, PAR ORDRE D'IMPACT

  1. Logement et hébergement. SAMSAH, SAVS, ACT, pensions de famille, CHRS,
     IML : aucune liste territoriale n'existe dans les sources disponibles. Ce
     bloc concentre huit des trente-huit irritants et apparaît dans trois
     parcours sur quatre. Piste à instruire : le fichier FINESS en open data.

  2. Géocodage à l'adresse. 34 dispositifs portent une adresse complète.
     De quoi passer d'un aplat par arrondissement à des points.

  3. Validation du classement. L'attribution d'un niveau et d'un domaine à
     chaque structure est un travail éditorial, construit à partir de la grille
     d'évaluation des besoins SIIS. À valider par l'ARS et les équipes avant
     diffusion externe.

  4. Données populationnelles. La grille québécoise fournit la clé de calcul :
     2 000 personnes avec troubles sévères et persistants pour 100 000
     habitants, dont 3,5 à 5 % relevant du suivi intensif. Il manque la
     population par arrondissement et la file active SIIS par secteur pour
     comparer offre recensée et besoin théorique.


------------------------------------------------------------------------
DONNÉES ET CONFIDENTIALITÉ

Les quatre parcours patients sont fictifs, construits à partir d'entretiens
préparatoires. Aucune donnée de santé individuelle n'est traitée ni
reproduite, aucun hébergement HDS n'est requis.

Les coordonnées nominatives figurant dans le kit DAC 13 Sud ne sont pas
reprises. Seuls les numéros institutionnels des structures sont publiés, et
run_tests.py le vérifie à chaque passage.


SOURCES

  Kit Ressources, écosystème de la santé mentale du territoire Marseille,
  Aubagne, La Ciotat. DAC 13 Sud, mise à jour du 7 mai 2026.

  Cartographie de l'offre sur le territoire de Marseille. SIIS Santé mentale,
  11 mai 2026.

  Atelier de cartographie SIIS, quatre parcours patients consolidés et validés.

  Grille d'évaluation des besoins en soutien, adaptée de la grille de Denver
  (Sherman et Ryan, 2008) par le CNESM puis par les équipes SIIS.

  Contours des arrondissements : arrondissements-marseille.geojson, repris du
  dépôt Carto Santé PACA.

  Fonds de carte : Esri, OpenStreetMap, OpenTopoMap.


CRÉDITS

CIUS, Centre d'Innovation et d'Usages en Santé. Nice, Marseille, Paris.
Projet accompagné dans le cadre du dispositif Article 51.
Leaflet 1.9.4, licence BSD 2-Clause.

Version de travail. Recensement non exhaustif, à consolider avec les acteurs
du territoire.
