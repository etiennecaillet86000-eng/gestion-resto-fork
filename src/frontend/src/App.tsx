import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/core/ui/Layout";
import Amortissements from "@/modules/finance/Amortissements";
import BusinessPlan from "@/modules/finance/BusinessPlan";
import BusinessPlanReel from "@/modules/finance/BusinessPlanReel";
import Comptabilite from "@/modules/finance/Comptabilite";
import Emprunts from "@/modules/finance/Emprunts";
import FraisFixes from "@/modules/finance/FraisFixes";
import Marges from "@/modules/finance/Marges";
import Projections from "@/modules/finance/Projections";
import Rentabilite from "@/modules/finance/Rentabilite";
import AssociesGerants from "@/modules/hr/AssociesGerants";
import SalairesCotisations from "@/modules/hr/SalairesCotisations";
import Ingredients from "@/modules/restaurant/Ingredients";
import Operations from "@/modules/restaurant/Operations";
import Recettes from "@/modules/restaurant/Recettes";
import SimulateurCarte from "@/modules/restaurant/SimulateurCarte";
import Stock from "@/modules/restaurant/Stock";
import VentesDuJour from "@/modules/restaurant/VentesDuJour";
import ParametresJuridiques from "@/modules/settings/ParametresJuridiques";
import { ChefHat } from "lucide-react";
import { useEffect, useState } from "react";

const CREDS = { user: "admin", pass: "admin123" };

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (user === CREDS.user && pass === CREDS.pass) {
      localStorage.setItem("auth", "1");
      onLogin();
    } else {
      setError("Identifiants incorrects");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <ChefHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-sidebar-foreground">
            Gestion Resto
          </h1>
          <p className="text-sidebar-foreground/60 text-sm mt-1">
            Restauration &amp; Hôtellerie
          </p>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">Connexion</CardTitle>
            <CardDescription>Accès réservé aux gestionnaires</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="username">Identifiant</Label>
                <Input
                  id="username"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  autoComplete="username"
                  data-ocid="login.input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p
                  className="text-sm text-destructive"
                  data-ocid="login.error_state"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                data-ocid="login.submit_button"
              >
                Se connecter
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-sidebar-foreground/40 mt-6">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            caffeine.ai
          </a>
        </p>
      </div>
      <Toaster />
    </div>
  );
}

type Route =
  | "/"
  | "/ingredients"
  | "/operations"
  | "/recettes"
  | "/simulateur"
  | "/stock"
  | "/ventes"
  | "/ventes-du-jour"
  | "/salaries"
  | "/associes"
  | "/frais-fixes"
  | "/emprunts"
  | "/amortissements"
  | "/business-plan"
  | "/business-plan-reel"
  | "/comptabilite"
  | "/rentabilite"
  | "/marges"
  | "/projections"
  | "/parametres";

const ROUTES: Record<Route, React.ComponentType> = {
  "/": Ingredients,
  "/ingredients": Ingredients,
  "/operations": Operations,
  "/recettes": Recettes,
  "/simulateur": SimulateurCarte,
  "/stock": Stock,
  "/ventes": VentesDuJour,
  "/ventes-du-jour": VentesDuJour,
  "/salaries": SalairesCotisations,
  "/associes": AssociesGerants,
  "/frais-fixes": FraisFixes,
  "/emprunts": Emprunts,
  "/amortissements": Amortissements,
  "/business-plan": BusinessPlan,
  "/business-plan-reel": BusinessPlanReel,
  "/comptabilite": Comptabilite,
  "/rentabilite": Rentabilite,
  "/marges": Marges,
  "/projections": Projections,
  "/parametres": ParametresJuridiques,
};

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace("#", "") || "/";
  return (Object.keys(ROUTES).includes(hash) ? hash : "/") as Route;
}

function AppContent({ onLogout }: { onLogout: () => void }) {
  const [route, setRoute] = useState<Route>(getRouteFromHash);

  useEffect(() => {
    function onHashChange() {
      setRoute(getRouteFromHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const PageComponent = ROUTES[route];

  return (
    <Layout onLogout={onLogout} currentRoute={route}>
      <PageComponent />
    </Layout>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(
    () => localStorage.getItem("auth") === "1",
  );

  function logout() {
    localStorage.removeItem("auth");
    setAuthed(false);
  }

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return <AppContent onLogout={logout} />;
}
