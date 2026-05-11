import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Save, Upload, Download, Trash, Plus, Check, X } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "motion/react";

export default function BoardEditor() {
  const [boardData, setBoardData] = useState<any>(null);
  const [editingTile, setEditingTile] = useState<any>(null);
  const [catHover, setCatHover] = useState(-1);

  const initBoard = () => {
    const categories: any[] = [];
    for (let c = 0; c < 5; c++) {
      const cat = { name: `Category ${c + 1}`, tiles: [] as any[] };
      for (let t = 0; t < 5; t++) {
        cat.tiles.push({
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
      categories.push(cat);
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
      <div className="max-w-6xl mx-auto border-[12px] border-black bg-white brutal-shadow p-8 mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b-4 border-black pb-8">
          <div>
            <span className="text-sm font-black uppercase opacity-60 mb-2 tracking-widest block">System Utility</span>
            <h1 className="text-6xl font-black uppercase italic tracking-tighter">Board Editor</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/host" className="px-6 py-3 border-4 border-black text-black font-black uppercase tracking-widest hover:bg-yellow-400 brutal-shadow-sm active:translate-y-1 active:shadow-none transition-all">Back</Link>
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
                </div>
              ))}
            </div>
            
            {boardData.categories[0].tiles.map((_: any, rowIdx: number) => (
              <div key={rowIdx} className="flex border-b-4 border-black last:border-b-0 h-40">
                {boardData.categories.map((cat: any, cIdx: number) => {
                  const tile = cat.tiles[rowIdx];
                  const hasContent = tile.question.content || tile.question.src;
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
                        {tile.mode && <span className="px-1.5 py-0.5 bg-blue-200 text-blue-900 border-2 border-black text-[10px] font-black uppercase leading-none">{tile.mode}</span>}
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
                    {['buzzer', 'guess', 'choice', 'text'].map(m => (
                      <button 
                        key={m} 
                        onClick={() => setEditingTile({...editingTile, mode: m})}
                        className={clsx("flex-1 py-4 font-black uppercase tracking-widest brutal-border hover:shadow-[4px_4px_0_0_#000] transition-all", editingTile.mode === m ? "bg-black text-white" : "bg-white text-black hover:bg-zinc-100")}
                      >{m}</button>
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
                </div>
                
                <div>
                   <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">Expected Out</label>
                   <textarea rows={3} value={editingTile.answer.content} onChange={e => setEditingTile({...editingTile, answer: {...editingTile.answer, content: e.target.value}})} className="w-full bg-white brutal-border text-black font-black text-xl p-4 focus:outline-none focus:bg-emerald-50" placeholder="ENTER EXPLANATION / ANSWER..." />
                   <input type="text" value={editingTile.answer.src || ''} onChange={e => setEditingTile({...editingTile, answer: { ...editingTile.answer, type: e.target.value ? 'image' : 'text', src: e.target.value }})} placeholder="IMAGE / VIDEO URL" className="mt-4 w-full bg-white brutal-border text-black font-bold text-sm uppercase p-4 focus:outline-none focus:bg-emerald-50" />
                </div>
                
                {editingTile.mode === 'guess' && (
                  <div>
                    <label className="block text-sm font-black uppercase tracking-widest text-zinc-500 mb-3 border-b-4 border-black pb-2">Target Float/Int</label>
                    <input type="number" value={editingTile.correctValue || ''} onChange={e => setEditingTile({...editingTile, correctValue: parseFloat(e.target.value)})} className="w-full bg-white brutal-border text-black font-black text-2xl p-4 focus:outline-none focus:bg-yellow-50 text-center" placeholder="0000" />
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
    </div>
  );
}
