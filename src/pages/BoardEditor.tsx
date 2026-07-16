import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Save, Upload, Download, Trash, Plus, Check, X, Dice5, Database, FileSpreadsheet } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";

// Flat spreadsheet schema: one row per tile, grouped into categories by the Category column.
const SHEET_COLUMNS = [
  "Category", "Value", "Mode", "Question", "QuestionImageURL", "Answer", "AnswerImageURL",
  "ChoiceA", "ChoiceB", "ChoiceC", "ChoiceD", "CorrectChoice", "CorrectValue",
  "Double", "Risk", "TorT_CategoryA", "TorT_CategoryB", "TorT_Correct",
];

const truthy = (v: any) => ["yes", "true", "1", "x", "ja", "y"].includes(String(v ?? "").trim().toLowerCase());
const LETTERS = ["A", "B", "C", "D"];

const normalizeMode = (m: any) => {
  const s = String(m ?? "buzzer").trim().toLowerCase();
  if (["t/t", "thisorthat", "this or that", "tort"].includes(s)) return "thisorthat";
  if (["buzzer", "guess", "choice", "text", "thisorthat"].includes(s)) return s;
  return "buzzer";
};

// Convert stored categories → flat array-of-arrays (with header row) for the sheet
const categoriesToRows = (categories: any[]) => {
  const rows: any[][] = [SHEET_COLUMNS];
  categories.forEach(cat => {
    const tiles = [...(cat.tiles || [])].sort((a, b) => (a.value || 0) - (b.value || 0));
    tiles.forEach(t => {
      const mode = normalizeMode(t.mode);
      rows.push([
        cat.name,
        t.value ?? "",
        mode,
        t.question?.content ?? "",
        t.question?.src ?? "",
        t.answer?.content ?? "",
        t.answer?.src ?? "",
        t.choices?.[0] ?? "",
        t.choices?.[1] ?? "",
        t.choices?.[2] ?? "",
        t.choices?.[3] ?? "",
        typeof t.correctIndex === "number" ? LETTERS[t.correctIndex] ?? "" : "",
        t.correctValue ?? "",
        t.double ? "yes" : "",
        t.risk ? "yes" : "",
        t.categoryA ?? "",
        t.categoryB ?? "",
        t.correctCategory ?? "",
      ]);
    });
  });
  return rows;
};

// Convert a sheet (array of row objects keyed by header) → categories with exactly 5 tiles each
const rowsToCategories = (records: any[]) => {
  const byName = new Map<string, any[]>();
  const order: string[] = [];
  records.forEach(r => {
    const name = String(r.Category ?? "").trim();
    if (!name) return;
    if (!byName.has(name)) { byName.set(name, []); order.push(name); }
    byName.get(name)!.push(r);
  });

  return order.map(name => {
    const rowList = byName.get(name)!;
    // Build 5 fixed value slots (100..500); fill from matching rows, else empty tile
    const slots = [100, 200, 300, 400, 500];
    const tiles = slots.map((slotValue, i) => {
      const match = rowList.find(r => Number(r.Value) === slotValue) || rowList[i];
      if (!match) {
        return {
          value: slotValue, mode: "buzzer",
          question: { type: "text", content: "" }, answer: { type: "text", content: "" },
          choices: ["", "", "", ""], correctIndex: null, correctValue: null, double: false, risk: false,
        };
      }
      const mode = normalizeMode(match.Mode);
      const qsrc = String(match.QuestionImageURL ?? "").trim();
      const asrc = String(match.AnswerImageURL ?? "").trim();
      const correctChoiceLetter = String(match.CorrectChoice ?? "").trim().toUpperCase();
      const correctIndex = LETTERS.indexOf(correctChoiceLetter);
      const cvRaw = String(match.CorrectValue ?? "").trim().replace(",", ".");
      const cv = cvRaw === "" ? null : (isNaN(Number(cvRaw)) ? null : Number(cvRaw));
      const tort = String(match.TorT_Correct ?? "").trim().toUpperCase();
      return {
        value: Number(match.Value) || slotValue,
        mode,
        question: { type: qsrc ? "image" : "text", content: String(match.Question ?? ""), ...(qsrc ? { src: qsrc } : {}) },
        answer: { type: asrc ? "image" : "text", content: String(match.Answer ?? ""), ...(asrc ? { src: asrc } : {}) },
        choices: [match.ChoiceA ?? "", match.ChoiceB ?? "", match.ChoiceC ?? "", match.ChoiceD ?? ""].map(x => String(x ?? "")),
        correctIndex: correctIndex >= 0 ? correctIndex : null,
        correctValue: cv,
        double: truthy(match.Double),
        risk: truthy(match.Risk),
        ...(mode === "thisorthat" ? {
          categoryA: String(match.TorT_CategoryA ?? ""),
          categoryB: String(match.TorT_CategoryB ?? ""),
          correctCategory: tort === "A" || tort === "B" ? tort : undefined,
        } : {}),
      };
    });
    return { name, tiles };
  });
};

const emptyTiles = () => {
  const tiles: any[] = [];
  for (let t = 0; t < 5; t++) {
    tiles.push({
      value: (t + 1) * 100,
      mode: 'buzzer',
      question: { type: 'text', content: '' },
      answer: { type: 'text', content: '' },
      choices: ['', '', '', ''],
      correctIndex: null,
      correctValue: null,
      double: false,
      risk: false
    });
  }
  return tiles;
};

const clone = (x: any) => JSON.parse(JSON.stringify(x));

const tileHasContent = (tile: any) => {
  const tMode = tile.mode || 'buzzer';
  const hasQ = !!(tile.question?.content || tile.question?.src);
  const hasA = !!(tile.answer?.content || tile.answer?.src);
  if (!(hasQ && hasA)) return false;
  if (tMode === 'buzzer' || tMode === 'text') return true;
  if (tMode === 'choice') {
    const hasChoices = tile.choices && tile.choices.filter((x: string) => !!x).length >= 2;
    return !!(hasChoices && typeof tile.correctIndex === 'number' && tile.correctIndex >= 0);
  }
  if (tMode === 'guess') return typeof tile.correctValue === 'number';
  if (tMode === 'thisorthat') return !!(tile.categoryA && tile.categoryB && tile.correctCategory);
  return false;
};

const filledCount = (tiles: any[]) => (tiles || []).filter(tileHasContent).length;

export default function BoardEditor() {
  const [boardData, setBoardData] = useState<any>(null);
  const [editingTile, setEditingTile] = useState<any>(null);
  const [catHover, setCatHover] = useState(-1);
  const [categoryDb, setCategoryDb] = useState<any[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [showCatDb, setShowCatDb] = useState(false);
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  const loadCategoryDb = () => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => {
        setCategoryDb(data.categories || []);
        setRecentlyUsed((data.recentlyUsed || []).map((n: string) => n.toLowerCase()));
      })
      .catch(() => {});
  };

  useEffect(() => { loadCategoryDb(); }, []);

  const flashNotice = (msg: string) => {
    setDbNotice(msg);
    setTimeout(() => setDbNotice(null), 3000);
  };

  const isRecentlyUsed = (name: string) => recentlyUsed.includes(String(name).trim().toLowerCase());

  const pickRandomCategory = (cIdx: number) => {
    if (!boardData) return;
    const onBoard = new Set(
      boardData.categories.map((c: any, i: number) => i !== cIdx ? String(c.name).trim().toLowerCase() : null).filter(Boolean)
    );
    const eligible = categoryDb.filter(c => {
      const key = String(c.name).trim().toLowerCase();
      return !isRecentlyUsed(c.name) && !onBoard.has(key) && (c.tiles || []).length > 0;
    });
    if (eligible.length === 0) {
      flashNotice("No eligible categories — add more to the database, or all are used in the last 3 games.");
      return;
    }
    const chosen = eligible[Math.floor(Math.random() * eligible.length)];
    const nb = clone(boardData);
    nb.categories[cIdx] = { name: chosen.name, tiles: clone(chosen.tiles) };
    setBoardData(nb);
    flashNotice(`Column ${cIdx + 1} → "${chosen.name}"`);
  };

  const saveColumnToDb = async (cIdx: number, originalName?: string) => {
    if (!boardData) return;
    const col = boardData.categories[cIdx];
    if (!col?.name?.trim()) { flashNotice("Give the column a name first."); return; }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: col.name.trim(), tiles: clone(col.tiles), originalName })
      });
      const data = await res.json();
      if (!res.ok) { flashNotice(data.error || "Save failed"); return; }
      setCategoryDb(data.categories || []);
      flashNotice(`Saved "${col.name.trim()}" to database.`);
    } catch {
      flashNotice("Save failed");
    }
  };

  const deleteFromDb = async (name: string) => {
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) setCategoryDb(data.categories || []);
    } catch {}
  };

  const addEmptyDbCategory = async () => {
    let base = "New Category";
    let name = base;
    let n = 1;
    const lower = categoryDb.map(c => String(c.name).toLowerCase());
    while (lower.includes(name.toLowerCase())) { n++; name = `${base} ${n}`; }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tiles: emptyTiles() })
      });
      const data = await res.json();
      if (res.ok) setCategoryDb(data.categories || []);
    } catch {}
  };

  const loadDbCategoryToColumn = (dbCat: any, cIdx: number) => {
    if (!boardData) return;
    const nb = clone(boardData);
    nb.categories[cIdx] = { name: dbCat.name, tiles: clone(dbCat.tiles) };
    setBoardData(nb);
    flashNotice(`Loaded "${dbCat.name}" into column ${cIdx + 1}.`);
  };

  const downloadSheet = (rows: any[][], filename: string) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = SHEET_COLUMNS.map(h => ({ wch: Math.max(12, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Categories");
    XLSX.writeFile(wb, filename);
  };

  const exportCategoryDb = () => {
    if (categoryDb.length === 0) { flashNotice("Database is empty — nothing to export."); return; }
    downloadSheet(categoriesToRows(categoryDb), "category_database.xlsx");
  };

  const downloadTemplate = () => {
    // Header + a few illustrative example rows covering the different modes
    const example = [
      SHEET_COLUMNS,
      ["Example Category", 100, "buzzer", "What is the capital of France?", "", "Paris", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Example Category", 200, "choice", "Which planet is the Red Planet?", "", "Mars", "", "Venus", "Mars", "Jupiter", "Saturn", "B", "", "", "", "", "", ""],
      ["Example Category", 300, "guess", "How many bones in the adult human body?", "", "206", "", "", "", "", "", "", "206", "", "", "", "", ""],
      ["Example Category", 400, "thisorthat", "Tomato", "", "It is botanically a fruit.", "", "", "", "", "", "", "", "", "", "Fruit", "Vegetable", "A"],
      ["Example Category", 500, "buzzer", "Double + Risk example question?", "", "The answer", "", "", "", "", "", "", "", "yes", "yes", "", "", ""],
    ];
    downloadSheet(example, "category_template.xlsx");
  };

  const importSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const records: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const cats = rowsToCategories(records);
      if (cats.length === 0) { flashNotice("No categories found in the file. Check the Category column."); return; }
      const res = await fetch("/api/categories/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cats }),
      });
      const data = await res.json();
      if (!res.ok) { flashNotice(data.error || "Import failed"); return; }
      setCategoryDb(data.categories || []);
      flashNotice(`Imported ${cats.length} categor${cats.length === 1 ? "y" : "ies"} (${data.added} new, ${data.updated} updated).`);
    } catch (err) {
      flashNotice("Could not read that file — is it a valid .xlsx/.csv?");
    }
  };

  const initBoard = () => {
    const categories: any[] = [];
    for (let c = 0; c < 5; c++) {
      categories.push({ name: `Category ${c + 1}`, tiles: emptyTiles() });
    }
    setBoardData({ categories, finalRound: {} });
  };

  const importBoard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setBoardData(data);
      } catch (err) {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  const saveToGame = async () => {
    if (!boardData) return;
    try {
      await fetch("/api/board/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boardData)
      });
      alert("Board saved to live game!");
    } catch (err) {
      alert("Failed to save to game");
    }
  };

  const downloadJSON = () => {
    if (!boardData) return;
    const blob = new Blob([JSON.stringify(boardData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jeopardy_board.json";
    a.click();
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-6 md:p-12 text-black selection:bg-yellow-400 font-sans">
      {dbNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-black text-yellow-400 border-4 border-yellow-400 px-6 py-3 font-black uppercase tracking-widest text-sm brutal-shadow text-center max-w-lg">
          {dbNotice}
        </div>
      )}
      <div className="max-w-6xl mx-auto border-[12px] border-black bg-white brutal-shadow p-8 mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b-4 border-black pb-8">
          <div>
            <span className="text-sm font-black uppercase opacity-60 mb-2 tracking-widest block">System Utility</span>
            <h1 className="text-6xl font-black uppercase italic tracking-tighter">Board Editor</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/host" className="px-6 py-3 border-4 border-black text-black font-black uppercase tracking-widest hover:bg-yellow-400 brutal-shadow-sm active:translate-y-1 active:shadow-none transition-all">Back</Link>
            <button onClick={() => { loadCategoryDb(); setShowCatDb(true); }} className="flex items-center gap-2 px-6 py-3 border-4 border-black bg-purple-400 text-black font-black uppercase tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-purple-300 transition-all"><Database size={20}/> Category DB</button>
            {!boardData && <button onClick={initBoard} className="flex items-center gap-2 px-6 py-3 border-4 border-black bg-emerald-400 text-black font-black uppercase tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-emerald-300 transition-all"><Plus size={20}/> New</button>}
            <label className="flex items-center gap-2 px-6 py-3 border-4 border-black bg-blue-400 text-black font-black uppercase tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-blue-300 transition-all cursor-pointer">
              <Upload size={20}/> Import 
              <input type="file" accept=".json" onChange={importBoard} className="hidden" />
            </label>
            {boardData && (
              <>
                <button onClick={downloadJSON} className="flex items-center gap-2 px-6 py-3 border-4 border-black bg-white text-black font-black uppercase tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-zinc-100 transition-all"><Download size={20}/> Export</button>
                <button onClick={saveToGame} className="flex items-center gap-2 px-6 py-3 border-4 border-black bg-red-500 text-black font-black uppercase tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-red-400 transition-all"><Save size={20}/> Push</button>
              </>
            )}
          </div>
        </div>

        {boardData && (
          <div className="bg-white border-4 border-black mb-8 overflow-hidden">
            <div className="flex border-b-4 border-black bg-black text-yellow-400">
              {boardData.categories.map((cat: any, cIdx: number) => (
                <div key={cIdx} className="flex-1 p-4 border-r-4 border-black last:border-r-0 relative group" onMouseEnter={() => setCatHover(cIdx)} onMouseLeave={() => setCatHover(-1)}>
                  <input
                    value={cat.name}
                    onChange={e => {
                      const nb = { ...boardData };
                      nb.categories[cIdx].name = e.target.value;
                      setBoardData(nb);
                    }}
                    className="w-full bg-transparent border-b-2 border-transparent focus:border-yellow-400 text-center text-2xl font-black uppercase italic tracking-tighter text-yellow-400 focus:outline-none transition-colors"
                  />
                  <div className="flex justify-center gap-2 mt-2">
                    <button
                      onClick={() => pickRandomCategory(cIdx)}
                      title="Fill this column with a random category from the database (excludes the last 3 games)"
                      className="flex items-center gap-1 px-2 py-1 border-2 border-yellow-400 text-yellow-400 text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400 hover:text-black transition-colors"
                    >
                      <Dice5 size={14}/> Random
                    </button>
                    <button
                      onClick={() => saveColumnToDb(cIdx)}
                      title="Save this column as a category in the database"
                      className="flex items-center gap-1 px-2 py-1 border-2 border-yellow-400 text-yellow-400 text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400 hover:text-black transition-colors"
                    >
                      <Save size={14}/> To DB
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {boardData.categories[0].tiles.map((_: any, rowIdx: number) => (
              <div key={rowIdx} className="flex border-b-4 border-black last:border-b-0 h-40">
                {boardData.categories.map((cat: any, cIdx: number) => {
                  const tile = cat.tiles[rowIdx];
                  const tMode = tile.mode || 'buzzer';
                  const hasQTextOrSrc = !!(tile.question?.content || tile.question?.src);
                  const hasAnsTextOrSrc = !!(tile.answer?.content || tile.answer?.src);
                  let hasContent = false;
                  if (hasQTextOrSrc && hasAnsTextOrSrc) {
                     if (tMode === 'buzzer' || tMode === 'text') {
                        hasContent = true;
                     } else if (tMode === 'choice') {
                        const hasChoices = tile.choices && tile.choices.filter((x: string) => !!x).length >= 2;
                        hasContent = !!(hasChoices && typeof tile.correctIndex === 'number' && tile.correctIndex >= 0);
                     } else if (tMode === 'guess') {
                        hasContent = typeof tile.correctValue === 'number';
                     }
                  }
                  return (
                    <div 
                      key={cIdx} 
                      onClick={() => setEditingTile({ cIdx, rowIdx, ...tile })}
                      className={clsx(
                        "flex-1 border-r-4 border-black last:border-r-0 flex flex-col items-center justify-center cursor-pointer transition-colors relative group",
                        hasContent ? "bg-zinc-100 hover:bg-yellow-200 text-black" : "bg-white hover:bg-yellow-100 text-zinc-400 hover:text-black",
                        catHover === cIdx && "bg-zinc-100"
                      )}
                    >
                      <span className="text-4xl font-black italic tracking-tighter">{tile.value}</span>
                      <div className="flex flex-col items-center mt-2 gap-1">
                        {tile.mode && <span className={clsx("px-1.5 py-0.5 border-2 border-black text-[10px] font-black uppercase leading-none", tile.mode === 'choice' ? "bg-blue-400 text-black" : tile.mode === 'guess' ? "bg-red-400 text-black" : tile.mode === 'text' ? "bg-emerald-400 text-black" : tile.mode === 'thisorthat' ? "bg-purple-400 text-black" : "bg-yellow-400 text-black")}>{tile.mode === 'thisorthat' ? 'T/T' : tile.mode}</span>}
                        <div className="flex gap-1">
                           {tile.double && <span className="px-1.5 py-0.5 bg-yellow-400 text-black border-2 border-black text-[10px] font-black uppercase leading-none">2X</span>}
                           {tile.risk && <span className="px-1.5 py-0.5 bg-red-500 text-white border-2 border-black text-[10px] font-black uppercase leading-none">RISK</span>}
                        </div>
                      </div>
                      {hasContent ? <Check size={24} className="text-emerald-500 absolute bottom-3 right-3"/> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

      </div>

      <AnimatePresence>
        {editingTile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-yellow-400 opacity-90 mix-blend-multiply pointer-events-none"></div>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white brutal-border brutal-shadow w-full max-w-3xl p-8 md:p-12 max-h-[90vh] overflow-y-auto relative z-10"
            >
              <div className="flex justify-between items-center bg-black text-white -mx-8 md:-mx-12 -mt-8 md:-mt-12 px-8 md:px-12 py-6 mb-8 border-b-4 border-black">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter">{boardData?.categories[editingTile.cIdx].name} - {editingTile.value}</h3>
                <button onClick={() => setEditingTile(null)} className="text-white hover:text-zinc-400 transition-colors"><X size={32} /></button>
              </div>

              <div className="space-y-8 text-black">
                <div>
                  <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">Interaction Mode</label>
                  <div className="flex flex-wrap gap-4">
                    {['buzzer', 'guess', 'choice', 'text', 'thisorthat'].map(m => (
                      <button
                        key={m}
                        onClick={() => setEditingTile({...editingTile, mode: m})}
                        className={clsx("flex-1 py-4 font-black uppercase tracking-widest brutal-border hover:shadow-[4px_4px_0_0_#000] transition-all", editingTile.mode === m ? "bg-black text-white" : "bg-white text-black hover:bg-zinc-100")}
                      >{m === 'thisorthat' ? 'This or That' : m}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="flex items-center gap-4 p-4 bg-yellow-100 brutal-border cursor-pointer select-none">
                    <input type="checkbox" checked={editingTile.double} onChange={e => setEditingTile({...editingTile, double: e.target.checked})} className="w-6 h-6 border-4 border-black text-black bg-white focus:ring-0 rounded-none cursor-pointer" />
                    <span className="font-black uppercase tracking-widest text-xl">Double Trouble</span>
                  </label>
                  <label className="flex items-center gap-4 p-4 bg-red-100 brutal-border cursor-pointer select-none">
                    <input type="checkbox" checked={editingTile.risk} onChange={e => setEditingTile({...editingTile, risk: e.target.checked})} className="w-6 h-6 border-4 border-black text-black bg-white focus:ring-0 rounded-none cursor-pointer" />
                    <span className="font-black uppercase tracking-widest text-xl text-red-600">Risk Question</span>
                  </label>
                </div>

                <div>
                   <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">Query Prompt</label>
                   <textarea rows={3} value={editingTile.question.content} onChange={e => setEditingTile({...editingTile, question: {...editingTile.question, content: e.target.value}})} className="w-full bg-white brutal-border text-black font-black text-xl p-4 focus:outline-none focus:bg-yellow-50" placeholder="ENTER TEXT PROMPT..." />
                   <input type="text" value={editingTile.question.src || ''} onChange={e => setEditingTile({...editingTile, question: { ...editingTile.question, type: e.target.value ? 'image' : 'text', src: e.target.value }})} placeholder="IMAGE / VIDEO URL" className="mt-4 w-full bg-white brutal-border text-black font-bold text-sm uppercase p-4 focus:outline-none focus:bg-yellow-50" />
                   {editingTile.question.src && (
                      <div className="mt-4 p-4 border-4 border-black bg-white flex justify-center">
                         <img src={editingTile.question.src} alt="Question Graphic" className="max-h-64 object-contain" />
                      </div>
                   )}
                </div>
                
                <div>
                   <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">Expected Out</label>
                   <textarea rows={3} value={editingTile.answer.content} onChange={e => setEditingTile({...editingTile, answer: {...editingTile.answer, content: e.target.value}})} className="w-full bg-white brutal-border text-black font-black text-xl p-4 focus:outline-none focus:bg-emerald-50" placeholder="ENTER EXPLANATION / ANSWER..." />
                   <input type="text" value={editingTile.answer.src || ''} onChange={e => setEditingTile({...editingTile, answer: { ...editingTile.answer, type: e.target.value ? 'image' : 'text', src: e.target.value }})} placeholder="IMAGE / VIDEO URL" className="mt-4 w-full bg-white brutal-border text-black font-bold text-sm uppercase p-4 focus:outline-none focus:bg-emerald-50" />
                   {editingTile.answer.src && (
                      <div className="mt-4 p-4 border-4 border-black bg-white flex justify-center">
                         <img src={editingTile.answer.src} alt="Answer Graphic" className="max-h-64 object-contain" />
                      </div>
                   )}
                </div>
                
                {editingTile.mode === 'guess' && (
                  <div>
                    <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">Target Float/Int</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      pattern="[0-9.,\-]*"
                      value={editingTile.correctValue !== undefined ? editingTile.correctValue : ''} 
                      onChange={e => {
                         let val = e.target.value.replace(/[^0-9.,\-]/g, '');
                         val = val.replace(',', '.');
                         setEditingTile({...editingTile, correctValue: val === '' || isNaN(Number(val)) && val !== '-' && val !== '.' ? undefined : val})
                      }} 
                      onBlur={e => {
                          if (typeof editingTile.correctValue === 'string') {
                              const num = parseFloat(editingTile.correctValue);
                              setEditingTile({...editingTile, correctValue: isNaN(num) ? undefined : num});
                          }
                      }}
                      className="w-full bg-white brutal-border text-black font-black text-2xl p-4 focus:outline-none focus:bg-yellow-50 text-center" 
                      placeholder="0000" 
                    />
                  </div>
                )}

                {editingTile.mode === 'thisorthat' && (
                  <div>
                    <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">This or That Categories</label>
                    <p className="text-sm text-zinc-500 font-bold mb-4">The question prompt above is the item players must classify. Set the two categories and which one is correct.</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Category A Label</label>
                        <input type="text" value={editingTile.categoryA || ''} onChange={e => setEditingTile({...editingTile, categoryA: e.target.value})} className="w-full bg-white brutal-border text-black font-black text-lg uppercase p-4 focus:outline-none focus:bg-blue-50" placeholder="e.g. FRUITS" />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Category B Label</label>
                        <input type="text" value={editingTile.categoryB || ''} onChange={e => setEditingTile({...editingTile, categoryB: e.target.value})} className="w-full bg-white brutal-border text-black font-black text-lg uppercase p-4 focus:outline-none focus:bg-red-50" placeholder="e.g. VEGETABLES" />
                      </div>
                    </div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Correct Category</label>
                    <div className="flex gap-4">
                      {(['A', 'B'] as const).map(cat => (
                        <button key={cat} onClick={() => setEditingTile({...editingTile, correctCategory: cat})}
                          className={clsx("flex-1 py-4 font-black text-2xl uppercase brutal-border transition-all", editingTile.correctCategory === cat ? (cat === 'A' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white') : 'bg-white text-black hover:bg-zinc-100')}>
                          {cat === 'A' ? (editingTile.categoryA || 'Category A') : (editingTile.categoryB || 'Category B')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editingTile.mode === 'choice' && (
                  <div>
                    <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">Multi-Choice Array</label>
                    <div className="space-y-4">
                       {['A','B','C','D'].map((letter, i) => (
                         <div key={i} className="flex items-center gap-4">
                            <input type="radio" checked={editingTile.correctIndex === i} onChange={() => setEditingTile({...editingTile, correctIndex: i})} className="w-6 h-6 border-4 border-black text-black bg-white focus:ring-0 cursor-pointer" />
                            <span className="font-black text-2xl w-8 italic text-zinc-400">{letter}.</span>
                            <input type="text" value={editingTile.choices[i] || ''} onChange={e => {
                               const choices = [...editingTile.choices];
                               choices[i] = e.target.value;
                               setEditingTile({...editingTile, choices});
                            }} className="flex-1 bg-white brutal-border text-black font-black text-lg uppercase p-4 focus:outline-none focus:bg-yellow-50" placeholder={`VALUE ${letter}`} />
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-4 mt-12 pt-8 border-t-4 border-black">
                <button onClick={() => setEditingTile(null)} className="px-8 py-4 bg-white brutal-border text-black font-black tracking-widest uppercase hover:bg-zinc-100 transition-colors">Discard</button>
                <button onClick={() => {
                   const nb = {...boardData};
                   nb.categories[editingTile.cIdx].tiles[editingTile.rowIdx] = editingTile;
                   setBoardData(nb);
                   setEditingTile(null);
                }} className="px-8 py-4 bg-blue-500 brutal-border text-black font-black tracking-widest uppercase hover:shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all">Submit Tile</button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCatDb && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setShowCatDb(false)}></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white brutal-border brutal-shadow w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto relative z-10"
            >
              <div className="flex justify-between items-center bg-purple-500 text-white -mx-8 -mt-8 px-8 py-6 mb-6 border-b-4 border-black">
                <div className="flex items-center gap-3">
                  <Database size={28}/>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">Category Database</h3>
                </div>
                <button onClick={() => setShowCatDb(false)} className="text-white hover:text-zinc-300 transition-colors"><X size={32}/></button>
              </div>

              <p className="text-sm font-bold text-zinc-500 mb-4">
                Stored categories power the per-column <span className="text-purple-600 font-black">Random</span> button.
                Categories used in the last 3 games are skipped by Random (marked below).
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <button onClick={addEmptyDbCategory} className="flex items-center gap-2 px-4 py-2 border-4 border-black bg-emerald-400 text-black font-black uppercase text-sm tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-emerald-300 transition-all">
                  <Plus size={18}/> Add Empty
                </button>
                <label className="flex items-center gap-2 px-4 py-2 border-4 border-black bg-blue-400 text-black font-black uppercase text-sm tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-blue-300 transition-all cursor-pointer">
                  <Upload size={18}/> Import
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={importSheet} className="hidden" />
                </label>
                <button onClick={exportCategoryDb} className="flex items-center gap-2 px-4 py-2 border-4 border-black bg-white text-black font-black uppercase text-sm tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-zinc-100 transition-all">
                  <Download size={18}/> Export
                </button>
                <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 border-4 border-black bg-yellow-400 text-black font-black uppercase text-sm tracking-widest brutal-shadow-sm active:translate-y-1 hover:bg-yellow-300 transition-all">
                  <FileSpreadsheet size={18}/> Template
                </button>
              </div>

              {categoryDb.length === 0 ? (
                <div className="border-4 border-dashed border-zinc-300 p-12 text-center text-zinc-400 font-black uppercase tracking-widest">
                  No categories yet. Build a column on the board and hit "To DB", or add an empty one.
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryDb.map((cat, i) => {
                    const done = filledCount(cat.tiles);
                    const blocked = isRecentlyUsed(cat.name);
                    return (
                      <div key={i} className={clsx("border-4 border-black p-4", blocked ? "bg-zinc-100" : "bg-white")}>
                        <div className="flex flex-wrap items-center gap-3 justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                            <input
                              value={cat.name}
                              onChange={e => {
                                const nb = [...categoryDb];
                                nb[i] = { ...nb[i], name: e.target.value };
                                setCategoryDb(nb);
                              }}
                              onBlur={e => {
                                const newName = e.target.value.trim();
                                if (newName && newName.toLowerCase() !== String(cat.name).toLowerCase()) {
                                  // rename in place via originalName
                                  fetch("/api/categories", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ name: newName, tiles: cat.tiles, originalName: cat.name })
                                  }).then(r => r.json()).then(d => { if (d.categories) setCategoryDb(d.categories); });
                                }
                              }}
                              className="flex-1 min-w-0 bg-transparent border-b-2 border-zinc-300 focus:border-purple-500 text-xl font-black uppercase italic tracking-tighter focus:outline-none"
                            />
                            <span className={clsx("text-xs font-black uppercase px-2 py-1 border-2 border-black whitespace-nowrap", done === 5 ? "bg-emerald-400" : "bg-yellow-300")}>{done}/5</span>
                            {blocked && <span className="text-[10px] font-black uppercase px-2 py-1 border-2 border-red-500 bg-red-100 text-red-600 whitespace-nowrap" title="Used in the last 3 games — skipped by Random">Recent</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {boardData && (
                              <select
                                defaultValue=""
                                onChange={e => { if (e.target.value !== "") { loadDbCategoryToColumn(cat, parseInt(e.target.value)); e.target.value = ""; } }}
                                className="text-xs font-black uppercase border-2 border-black bg-white px-2 py-2 focus:outline-none cursor-pointer"
                              >
                                <option value="">Load to…</option>
                                {boardData.categories.map((_: any, ci: number) => (
                                  <option key={ci} value={ci}>Column {ci + 1}</option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => { if (confirm(`Delete category "${cat.name}" from the database?`)) deleteFromDb(cat.name); }}
                              className="p-2 border-2 border-black bg-red-500 text-white hover:bg-red-400 transition-colors"
                              title="Delete from database"
                            >
                              <Trash size={16}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {boardData && (
                <p className="text-xs text-zinc-400 font-bold mt-6 pt-4 border-t-2 border-zinc-200">
                  To edit a category's questions: load it into a board column, edit the tiles, then use that column's "To DB" button to save your changes back.
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
