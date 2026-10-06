import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Generator from "./pages/Generator";
import Scanner from "./pages/Scanner";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ticket Generator */}
        <Route path="/" element={<Generator />} />

        {/* Event Scanner */}
        <Route path="/scanner" element={<Scanner />} />

        {/* Unknown URL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
