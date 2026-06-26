"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DualListItem = {
  id: string;
  label: string;
  description?: string;
};

type DualListSelectorProps = {
  items: DualListItem[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  availableTitle: string;
  selectedTitle: string;
  availableSearchPlaceholder?: string;
  selectedSearchPlaceholder?: string;
  emptyAvailableMessage?: string;
  emptySelectedMessage?: string;
};

export function DualListSelector({
  items,
  selectedIds,
  onChange,
  availableTitle,
  selectedTitle,
  availableSearchPlaceholder = "Buscar disponíveis",
  selectedSearchPlaceholder = "Buscar selecionados",
  emptyAvailableMessage = "Nenhum item disponível.",
  emptySelectedMessage = "Nenhum item selecionado.",
}: DualListSelectorProps) {
  const [availableQuery, setAvailableQuery] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [markedAvailableIds, setMarkedAvailableIds] = useState<string[]>([]);
  const [markedSelectedIds, setMarkedSelectedIds] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const availableItems = useMemo(() => items.filter((item) => !selectedSet.has(item.id)), [items, selectedSet]);
  const selectedItems = useMemo(() => items.filter((item) => selectedSet.has(item.id)), [items, selectedSet]);

  const filteredAvailableItems = useMemo(
    () => filterItems(availableItems, availableQuery),
    [availableItems, availableQuery],
  );
  const filteredSelectedItems = useMemo(
    () => filterItems(selectedItems, selectedQuery),
    [selectedItems, selectedQuery],
  );

  function toggleMarked(id: string, currentIds: string[], setCurrentIds: (ids: string[]) => void) {
    setCurrentIds(currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id]);
  }

  function addMarkedItems() {
    const nextIds = Array.from(new Set([...selectedIds, ...markedAvailableIds]));
    onChange(nextIds);
    setMarkedAvailableIds([]);
  }

  function addItem(id: string) {
    onChange(Array.from(new Set([...selectedIds, id])));
    setMarkedAvailableIds((currentIds) => currentIds.filter((item) => item !== id));
  }

  function removeMarkedItems() {
    onChange(selectedIds.filter((id) => !markedSelectedIds.includes(id)));
    setMarkedSelectedIds([]);
  }

  function removeItem(id: string) {
    onChange(selectedIds.filter((item) => item !== id));
    setMarkedSelectedIds((currentIds) => currentIds.filter((item) => item !== id));
  }

  function addAllVisibleItems() {
    const nextIds = Array.from(new Set([...selectedIds, ...filteredAvailableItems.map((item) => item.id)]));
    onChange(nextIds);
    setMarkedAvailableIds([]);
  }

  function removeAllVisibleItems() {
    const visibleIds = new Set(filteredSelectedItems.map((item) => item.id));
    onChange(selectedIds.filter((id) => !visibleIds.has(id)));
    setMarkedSelectedIds([]);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <SelectorPanel
        title={availableTitle}
        searchValue={availableQuery}
        onSearchChange={setAvailableQuery}
        searchPlaceholder={availableSearchPlaceholder}
        items={filteredAvailableItems}
        markedIds={markedAvailableIds}
        onToggle={(id) => toggleMarked(id, markedAvailableIds, setMarkedAvailableIds)}
        onMove={addItem}
        emptyMessage={emptyAvailableMessage}
        moveHint="Duplo clique para adicionar"
      />

      <div className="flex items-center justify-center gap-2 lg:flex-col">
        <Button type="button" variant="outline" size="sm" onClick={addMarkedItems} disabled={!markedAvailableIds.length}>
          Adicionar
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={removeMarkedItems} disabled={!markedSelectedIds.length}>
          Remover
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={addAllVisibleItems} disabled={!filteredAvailableItems.length}>
          Todos
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={removeAllVisibleItems} disabled={!filteredSelectedItems.length}>
          Limpar
        </Button>
      </div>

      <SelectorPanel
        title={selectedTitle}
        searchValue={selectedQuery}
        onSearchChange={setSelectedQuery}
        searchPlaceholder={selectedSearchPlaceholder}
        items={filteredSelectedItems}
        markedIds={markedSelectedIds}
        onToggle={(id) => toggleMarked(id, markedSelectedIds, setMarkedSelectedIds)}
        onMove={removeItem}
        emptyMessage={emptySelectedMessage}
        moveHint="Duplo clique para remover"
      />
    </div>
  );
}

function SelectorPanel({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  items,
  markedIds,
  onToggle,
  onMove,
  emptyMessage,
  moveHint,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  items: DualListItem[];
  markedIds: string[];
  onToggle: (id: string) => void;
  onMove: (id: string) => void;
  emptyMessage: string;
  moveHint: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{items.length}</span>
      </div>
      <Input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="mb-2 h-9"
      />
      <div className="h-48 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-1">
        {items.map((item) => {
          const marked = markedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              onDoubleClick={() => onMove(item.id)}
              title={moveHint}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                marked ? "bg-brq-blue text-white shadow-sm" : "bg-white text-slate-700 hover:bg-blue-50"
              }`}
            >
              <span className="block font-semibold">{item.label}</span>
              {item.description && <span className={`block text-xs ${marked ? "text-blue-100" : "text-slate-400"}`}>{item.description}</span>}
            </button>
          );
        })}
        {!items.length && <p className="px-3 py-6 text-center text-xs text-slate-400">{emptyMessage}</p>}
      </div>
    </div>
  );
}

function filterItems(items: DualListItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => `${item.label} ${item.description ?? ""}`.toLowerCase().includes(normalizedQuery));
}
