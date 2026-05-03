import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Scanner from "@/pages/Scanner";
import Inventory from "@/pages/Inventory";
import Movements from "@/pages/Movements";
import Suppliers from "@/pages/Suppliers";
import Categories from "@/pages/Categories";
import Alerts from "@/pages/Alerts";
import Reorder from "@/pages/Reorder";
import Labels from "@/pages/Labels";
function App() {
  return (
    <div className="App">
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/inventaire" element={<Inventory />} />
            <Route path="/commander" element={<Reorder />} />
            <Route path="/etiquettes" element={<Labels />} />
            <Route path="/mouvements" element={<Movements />} />
            <Route path="/fournisseurs" element={<Suppliers />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/alertes" element={<Alerts />} />
          </Route>
        </Routes>
      </HashRouter>
    </div>
  );
}
export default App;