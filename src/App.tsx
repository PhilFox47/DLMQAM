/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import RoleSelection from "./pages/RoleSelection";
import HostView from "./pages/HostView";
import PlayerView from "./pages/PlayerView";
import BoardEditor from "./pages/BoardEditor";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelection />} />
        <Route path="/host" element={<HostView />} />
        <Route path="/player" element={<PlayerView />} />
        <Route path="/board-editor" element={<BoardEditor />} />
      </Routes>
    </BrowserRouter>
  );
}
