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
             
             let bgClass = "bg-white hover:bg-yellow-100 cursor-pointer text-black";
             if (isUsed) bgClass = "bg-zinc-200 opacity-50 cursor-not-allowed";
             if (isActive) bgClass = "bg-black text-white animate-pulse";

             return (
               <div 
                 key={catIdx} 
                 onClick={() => !isUsed && !isActive && handleTileClick(catIdx, rowIdx)}
                 className={clsx(
                    "flex-[3] border-r-4 border-black last:border-r-0 aspect-video flex flex-col items-center justify-center transition-all relative group",
                    bgClass
                 )}
               >
                 <span className={clsx("text-5xl font-black italic tracking-tighter", isActive ? "text-white" : "text-black", isUsed ? "line-through opacity-20" : "")}>
                   {tile.value * (gameState.doublePointsActive ? 2 : 1) * (tile.double ? 2 : 1)}
                 </span>
                 {isHost && !isUsed && (
                   <div className="absolute top-2 right-2 flex gap-1">
                     {tile.double && <span className="w-3 h-3 bg-yellow-500 brutal-border" title="Double Trouble"/>}
                     {tile.risk && <span className="w-3 h-3 bg-red-500 brutal-border" title="Risk"/>}
                   </div>
                 )}
               </div>
             );
          })}
        </div>
      ))}
    </div>
  );
}
