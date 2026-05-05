
actor {

  public type RecetteIngredient = {
    ingredientId: Text;
    quantite: Float;
    unite: Text;
  };

  public type Ingredient = {
    id: Text;
    nom: Text;
    unite: Text;
    prixUnitaireHT: Float;
    seuilSecurite: Float;
    stockInitial: Float;
  };

  public type Recette = {
    id: Text;
    nom: Text;
    categorie: Text;
    categorieTVA: Text;
    tauxTVA: Float;
    ingredients: [RecetteIngredient];
    consommablesHT: Float;
    prixVenteTTC: Float;
  };

  public type LigneFraisFixes = {
    nom: Text;
    montantMensuelAvecRemu: Float;
    montantMensuelHorsRemu: Float;
  };

  public type ParametresRentabilite = {
    ticketMoyenHT: Float;
    nbClientsParSemaine: Float;
    nbSemainesSaison: Float;
    tauxFoodCostParCategorie: [(Text, Float)];
  };

  public type MouvementStock = {
    id: Text;
    ingredientId: Text;
    date: Text;
    typeOp: Text;
    quantite: Float;
    motif: Text;
  };

  // Legacy type retained for stable-variable upgrade compatibility (do not remove)
  type MouvementStockLegacy = {
    id: Text;
    ingredientId: Text;
    date: Text;
    type_: Text;
    quantite: Float;
    motif: Text;
  };

  public type VenteRecette = {
    id: Text;
    recetteId: Text;
    date: Text;
    quantite: Float;
  };

  public type Emprunt = {
    id: Text;
    nom: Text;
    montant: Float;
    tauxAnnuel: Float;
    dureeMois: Nat;
    dateDebut: Text;
    differeMois: Nat;
  };

  public type AssocieGerant = {
    id: Text;
    nom: Text;
    statut: Text;
    remunerationAnnuelle: Float;
  };

  public type Salarie = {
    id: Text;
    nom: Text;
    poste: Text;
    salaireAnnuelBrut: Float;
  };

  public type ParametresJuridiques = {
    formeJuridique: Text;
    regimeFiscal: Text;
    regimeSocial: Text;
  };

  public type LigneAmortissement = {
    id: Text;
    nom: Text;
    coutTotal: Float;
    dureeMois: Nat;
  };

  // --- State variables ---
  var ingredients: [Ingredient] = [];
  var recettes: [Recette] = [];
  var fraisFixes: [LigneFraisFixes] = [
    { nom = "Location / amenagement"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Equipements Cuisine / bar (Amortissement)"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Licences / Assurances"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Energie / eau"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Communication / marketing"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Animation / musique"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Salaire / cotisations"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Emprunt"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
    { nom = "Stock boissons / nourritures"; montantMensuelAvecRemu = 0.0; montantMensuelHorsRemu = 0.0 },
  ];
  var parametres: ParametresRentabilite = {
    ticketMoyenHT = 0.0;
    nbClientsParSemaine = 0.0;
    nbSemainesSaison = 24.0;
    tauxFoodCostParCategorie = [
      ("Boissons froides (hors alcool)", 25.0),
      ("Sandwichs froids et Wraps", 30.0),
      ("Plats chauds", 33.0),
      ("Desserts maison", 30.0),
      ("Accompagnements", 28.0),
      ("Les formules ou menus", 31.0),
    ];
  };
  var joursOuvertureParSemaineSV: Float = 6.0;
  var mixProduitParCategorieSV: [(Text, Float)] = [
    ("Boissons froides (hors alcool)", 0.0),
    ("Sandwichs froids et Wraps", 0.0),
    ("Plats chauds", 0.0),
    ("Desserts maison", 0.0),
    ("Accompagnements", 0.0),
    ("Les formules ou menus", 0.0),
  ];
  // Legacy stable var retained for upgrade compatibility (always empty after migration)
  var mouvementsStock: [MouvementStockLegacy] = [];
  var mouvementsStockV2: [MouvementStock] = [];
  var ventesRecettes: [VenteRecette] = [];
  var emprunts: [Emprunt] = [];
  var associesGerants: [AssocieGerant] = [];
  var salaries: [Salarie] = [];
  var parametresJuridiques: ParametresJuridiques = {
    formeJuridique = "EI";
    regimeFiscal = "IR";
    regimeSocial = "TNS";
  };
  var amortissements: [LigneAmortissement] = [];
  var nextId: Nat = 1;

  func genId() : Text {
    let id = nextId.toText();
    nextId += 1;
    id
  };

  // INGREDIENTS

  public query func getIngredients() : async [Ingredient] { ingredients };

  public func createIngredient(nom: Text, unite: Text, prixUnitaireHT: Float, seuilSecurite: Float, stockInitial: Float) : async Ingredient {
    let ing: Ingredient = { id = genId(); nom; unite; prixUnitaireHT; seuilSecurite; stockInitial };
    ingredients := ingredients.concat([ing]);
    ing
  };

  public func updateIngredient(id: Text, nom: Text, unite: Text, prixUnitaireHT: Float, seuilSecurite: Float, stockInitial: Float) : async Bool {
    var found = false;
    ingredients := ingredients.map(func(i) {
      if (i.id == id) { found := true; { id; nom; unite; prixUnitaireHT; seuilSecurite; stockInitial } }
      else { i }
    });
    found
  };

  public func deleteIngredient(id: Text) : async Bool {
    let before = ingredients.size();
    ingredients := ingredients.filter(func i = i.id != id);
    ingredients.size() < before
  };

  // RECETTES

  public query func getRecettes() : async [Recette] { recettes };

  public func createRecette(nom: Text, categorie: Text, categorieTVA: Text, tauxTVA: Float, ings: [RecetteIngredient], consommablesHT: Float, prixVenteTTC: Float) : async Recette {
    let r: Recette = { id = genId(); nom; categorie; categorieTVA; tauxTVA; ingredients = ings; consommablesHT; prixVenteTTC };
    recettes := recettes.concat([r]);
    r
  };

  public func updateRecette(id: Text, nom: Text, categorie: Text, categorieTVA: Text, tauxTVA: Float, ings: [RecetteIngredient], consommablesHT: Float, prixVenteTTC: Float) : async Bool {
    var found = false;
    recettes := recettes.map(func(r) {
      if (r.id == id) { found := true; { id; nom; categorie; categorieTVA; tauxTVA; ingredients = ings; consommablesHT; prixVenteTTC } }
      else { r }
    });
    found
  };

  public func deleteRecette(id: Text) : async Bool {
    let before = recettes.size();
    recettes := recettes.filter(func r = r.id != id);
    recettes.size() < before
  };

  // FRAIS FIXES

  public query func getFraisFixes() : async [LigneFraisFixes] { fraisFixes };

  public func saveFraisFixes(lignes: [LigneFraisFixes]) : async Bool {
    fraisFixes := lignes;
    true
  };

  // PARAMETRES RENTABILITE

  public query func getParametres() : async ParametresRentabilite { parametres };

  public func saveParametres(p: ParametresRentabilite) : async Bool {
    parametres := p;
    true
  };

  // JOURS OUVERTURE PAR SEMAINE

  public query func getJoursOuvertureParSemaine() : async Float { joursOuvertureParSemaineSV };

  public func saveJoursOuvertureParSemaine(v: Float) : async Bool {
    joursOuvertureParSemaineSV := v;
    true
  };

  // MIX PRODUIT PAR CATEGORIE

  public query func getMixProduitParCategorie() : async [(Text, Float)] { mixProduitParCategorieSV };

  public func saveMixProduitParCategorie(m: [(Text, Float)]) : async Bool {
    mixProduitParCategorieSV := m;
    true
  };

  // MOUVEMENTS STOCK

  public query func getMouvementsStock() : async [MouvementStock] { mouvementsStockV2 };

  public func createMouvement(ingredientId: Text, date: Text, typeOp: Text, quantite: Float, motif: Text) : async MouvementStock {
    let m: MouvementStock = { id = genId(); ingredientId; date; typeOp; quantite; motif };
    mouvementsStockV2 := mouvementsStockV2.concat([m]);
    m
  };

  public func deleteMouvement(id: Text) : async Bool {
    let before = mouvementsStockV2.size();
    mouvementsStockV2 := mouvementsStockV2.filter(func m = m.id != id);
    mouvementsStockV2.size() < before
  };

  // VENTES

  public query func getVentesRecettes() : async [VenteRecette] { ventesRecettes };

  public func createVente(recetteId: Text, date: Text, quantite: Float) : async VenteRecette {
    let v: VenteRecette = { id = genId(); recetteId; date; quantite };
    ventesRecettes := ventesRecettes.concat([v]);
    v
  };

  public func deleteVente(id: Text) : async Bool {
    let before = ventesRecettes.size();
    ventesRecettes := ventesRecettes.filter(func v = v.id != id);
    ventesRecettes.size() < before
  };

  // EMPRUNTS

  public query func getEmprunts() : async [Emprunt] { emprunts };

  public func createEmprunt(nom: Text, montant: Float, tauxAnnuel: Float, dureeMois: Nat, dateDebut: Text, differeMois: Nat) : async Emprunt {
    let e: Emprunt = { id = genId(); nom; montant; tauxAnnuel; dureeMois; dateDebut; differeMois };
    emprunts := emprunts.concat([e]);
    e
  };

  public func updateEmprunt(id: Text, nom: Text, montant: Float, tauxAnnuel: Float, dureeMois: Nat, dateDebut: Text, differeMois: Nat) : async Bool {
    var found = false;
    emprunts := emprunts.map(func(e) {
      if (e.id == id) { found := true; { id; nom; montant; tauxAnnuel; dureeMois; dateDebut; differeMois } }
      else { e }
    });
    found
  };

  public func deleteEmprunt(id: Text) : async Bool {
    let before = emprunts.size();
    emprunts := emprunts.filter(func e = e.id != id);
    emprunts.size() < before
  };

  // ASSOCIES / GERANTS

  public query func getAssociesGerants() : async [AssocieGerant] { associesGerants };

  public func createAssocieGerant(nom: Text, statut: Text, remunerationAnnuelle: Float) : async AssocieGerant {
    let a: AssocieGerant = { id = genId(); nom; statut; remunerationAnnuelle };
    associesGerants := associesGerants.concat([a]);
    a
  };

  public func updateAssocieGerant(id: Text, nom: Text, statut: Text, remunerationAnnuelle: Float) : async Bool {
    var found = false;
    associesGerants := associesGerants.map(func(a) {
      if (a.id == id) { found := true; { id; nom; statut; remunerationAnnuelle } }
      else { a }
    });
    found
  };

  public func deleteAssocieGerant(id: Text) : async Bool {
    let before = associesGerants.size();
    associesGerants := associesGerants.filter(func a = a.id != id);
    associesGerants.size() < before
  };

  // SALARIES

  public query func getSalaries() : async [Salarie] { salaries };

  public func createSalarie(nom: Text, poste: Text, salaireAnnuelBrut: Float) : async Salarie {
    let s: Salarie = { id = genId(); nom; poste; salaireAnnuelBrut };
    salaries := salaries.concat([s]);
    s
  };

  public func updateSalarie(id: Text, nom: Text, poste: Text, salaireAnnuelBrut: Float) : async Bool {
    var found = false;
    salaries := salaries.map(func(s) {
      if (s.id == id) { found := true; { id; nom; poste; salaireAnnuelBrut } }
      else { s }
    });
    found
  };

  public func deleteSalarie(id: Text) : async Bool {
    let before = salaries.size();
    salaries := salaries.filter(func s = s.id != id);
    salaries.size() < before
  };

  // PARAMETRES JURIDIQUES

  public query func getParametresJuridiques() : async ParametresJuridiques { parametresJuridiques };

  public func saveParametresJuridiques(p: ParametresJuridiques) : async Bool {
    parametresJuridiques := p;
    true
  };

  // AMORTISSEMENTS

  public query func getAmortissements() : async [LigneAmortissement] { amortissements };

  public func createAmortissement(nom: Text, coutTotal: Float, dureeMois: Nat) : async LigneAmortissement {
    let a: LigneAmortissement = { id = genId(); nom; coutTotal; dureeMois };
    amortissements := amortissements.concat([a]);
    a
  };

  public func updateAmortissement(id: Text, nom: Text, coutTotal: Float, dureeMois: Nat) : async Bool {
    var found = false;
    amortissements := amortissements.map(func(a) {
      if (a.id == id) { found := true; { id; nom; coutTotal; dureeMois } }
      else { a }
    });
    found
  };

  public func deleteAmortissement(id: Text) : async Bool {
    let before = amortissements.size();
    amortissements := amortissements.filter(func a = a.id != id);
    amortissements.size() < before
  };

};
