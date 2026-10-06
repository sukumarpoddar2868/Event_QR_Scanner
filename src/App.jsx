import { BrowserRouter, Routes, Route } from "react-router-dom";
import Generator from "./pages/Generator";
import Scanner from "./pages/Scanner";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Generator />} />
        <Route path="/scanner" element={<Scanner />} />
      </Routes>
    </BrowserRouter>
  );
}
