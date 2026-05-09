/**
 * SearchableSelect — Composant de sélection avec recherche intégrée
 * Remplace les <select> HTML natifs et les Select shadcn sans recherche.
 * Props :
 *   options       : { value: string; label: string }[]
 *   value         : string  (valeur sélectionnée)
 *   onChange      : (value: string) => void
 *   placeholder?  : texte affiché quand rien n'est sélectionné
 *   searchPlaceholder? : placeholder du champ de recherche
 *   className?    : classes Tailwind supplémentaires sur le bouton
 *   disabled?     : désactive le composant
 *   id?           : id HTML pour le label association
 */
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  "data-ocid"?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  className = "",
  disabled = false,
  id,
  "data-ocid": dataOcid,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  // Focus search when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  function handleSelect(optValue: string) {
    onChange(optValue);
    setIsOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative" id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background hover:bg-accent/20 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        data-ocid={dataOcid}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={`truncate text-left ${!selectedLabel ? "text-muted-foreground" : ""}`}
        >
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-50 ml-2 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          {/* Search input */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                className="w-full rounded border border-input bg-background pl-7 pr-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Options list */}
          <div className="max-h-48 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Aucun résultat
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`flex w-full items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                    o.value === value ? "bg-accent/60 font-medium" : ""
                  }`}
                  onClick={() => handleSelect(o.value)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
