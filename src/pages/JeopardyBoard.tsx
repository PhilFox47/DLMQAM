import React from "react";
import clsx from "clsx";
import { socket } from "../lib/socket";

export default function JeopardyBoard({ gameState, isHost }: { gameState: any, isHost: boolean }) {
  if (!gameState?.board) return null;

  const handleTileClick = (catIdx: number, tileIdx: number) => {
    if (isHost || gameState.boardSelector === socket.id) {
       socket.emit("select_tile", { category_index: catIdx, tile_index: tileIdx });
    }
  };

  return (
    <div className="w-full bg-white brutal-border brutal-shadow mt-6">
      <div className="flex border-b-4 border-black">
        <div className="flex-1 bg-black text-white p-4 font-black uppercase text-center border-r-4 border-black">PTS</div>
        {gameState.board.categories.map((cat: any, i: number) => (
          <div key={i} className="flex-[3] bg-yellow-400 p-4 font-black text-center border-r-4 border-black last:border-r-0 text-black uppercase tracking-tighter">
            {cat.name}
          </div>
        ))}
      </div>
      
      {gameState.board.categories[0].tiles.map((_: any, rowIdx: number) => (
        <div key={rowIdx} className="flex border-b-4 border-black last:border-b-0">
          <div className="flex-1 font-black flex items-center justify-center border-r-4 border-black bg-black text-white">{gameState.board.categories[0].tiles[rowIdx].value}</div>
          
          {gameState.board.categories.map((cat: any, catIdx: number) => {
             const key = `${catIdx}-${rowIdx}`;
             const isUsed = gameState.boardRevealed.includes(key);
             const isActive = gameState.boardCurrentTile?.[0] === catIdx && gameState.boardCurrentTile?.[1] === rowIdx;
             const tile = cat.tiles[rowIdx];
             
             const canClick = !isUsed && !isActive && (isHost || gameState.boardSelector === socket.id);
             const modeColorMap: Record<string, string> = {
               choice: "bg-blue-400",
               guess: "bg-red-400",
               text: "bg-emerald-400",
               buzzer: "bg-yellow-400"
             };
             const tileBg = isHost ? (modeColorMap[tile.mode || "buzzer"] || "bg-yellow-400") : "bg-white";

             let bgClass = `${tileBg} text-black`;
             if (isUsed) {
                 const usedColor = modeColorMap[tile.mode || "buzzer"] || "bg-yellow-400";
                 bgClass = `${usedColor} opacity-40 saturate-50 cursor-not-allowed`;
             }
             else if (isActive) bgClass = "bg-black text-white animate-pulse";
             else if (canClick) {
                 const hoverColorMap: Record<string, string> = {
                     choice: "hover:bg-blue-500",
                     guess: "hover:bg-red-500",
                     text: "hover:bg-emerald-500",
                     buzzer: "hover:bg-yellow-100"
                 };
                 const hoverBg = isHost ? (hoverColorMap[tile.mode || "buzzer"] || "hover:bg-yellow-100") : "hover:bg-yellow-100";
                 bgClass += ` ${hoverBg} cursor-pointer block hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-black`;
             }
             else bgClass += " cursor-not-allowed";

             return (
               <button 
                 key={catIdx} 
                 onClick={() => canClick && handleTileClick(catIdx, rowIdx)}
                 className={clsx(
                    "flex-[3] border-r-4 border-black last:border-r-0 flex flex-col items-center justify-center transition-all relative group",
                    bgClass,
                    isHost ? "py-2 sm:py-4 lg:py-6" : "aspect-video"
                 )}
               >
                 <span className={clsx(isHost ? "text-2xl lg:text-3xl" : "text-5xl", "font-black italic tracking-tighter", isActive ? "text-white" : "text-black", isUsed ? "line-through opacity-20" : "")}>
                   {gameState.boardPlayedValues?.[key] !== undefined ? gameState.boardPlayedValues[key] : tile.value * (gameState.doublePointsActive ? 2 : 1)}
                 </span>
                 {isHost && !isUsed && (
                   <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                     {tile.mode && <span className={clsx("px-1 py-0.5 border-2 border-black text-[10px] font-black uppercase leading-none", tile.mode === 'choice' ? "bg-blue-400 text-black" : tile.mode === 'guess' ? "bg-red-400 text-black" : tile.mode === 'text' ? "bg-emerald-400 text-black" : "bg-yellow-400 text-black")}>{tile.mode}</span>}
                     {tile.double && <span className="px-1 py-0.5 bg-yellow-400 text-black border-2 border-black text-[10px] font-black uppercase leading-none">2X</span>}
                     {tile.risk && <span className="px-1 py-0.5 bg-red-500 text-white border-2 border-black text-[10px] font-black uppercase leading-none">RISK</span>}
                   </div>
                 )}
               </button>
             );
          })}
        </div>
      ))}
    </div>
  );
}
