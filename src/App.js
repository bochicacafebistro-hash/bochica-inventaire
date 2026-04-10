import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, setDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC27HzALz_DoIN5huqGwVBsKTLHg37rUuc",
  authDomain: "bochica-inventaire.firebaseapp.com",
  projectId: "bochica-inventaire",
  storageBucket: "bochica-inventaire.firebasestorage.app",
  messagingSenderId: "261321722710",
  appId: "1:261321722710:web:5a7aa0039fa0fd1a20a4f7"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const SECTIONS = ["Cuisine", "Emballage", "Bar", "Autre"];

function genId() { return Math.random().toString(36).slice(2, 10); }

function getCurrentStock(p) {
  const entries = DAYS.map(d => p.dailyEntries?.[d]).filter(v => v !== undefined && v !== "");
  if (entries.length === 0) return Number(p.orderQty ?? 0);
  return Number(entries[entries.length - 1]);
}

function getStatus(p) {
  const stock = getCurrentStock(p);
  if (stock <= Number(p.minimum)) return "red";
  if (stock <= Number(p.minimum) * 1.2) return "yellow";
  return "green";
}

const STATUS_STYLE = {
  red:    { background: "#fee2e2", border: "2px solid #ef4444", color: "#991b1b" },
  yellow: { background: "#fef9c3", border: "2px solid #eab308", color: "#854d0e" },
  green:  { background: "#dcfce7", border: "2px solid #22c55e", color: "#166534" },
};

export default function App() {
  const [products, setProducts]   = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab]           = useState("inventaire");
  const [activeSection, setActiveSection]   = useState("Cuisine");
  const [showProductModal, setShowProductModal]   = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingProduct, setEditingProduct]   = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, "products"), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubS = onSnapshot(collection(db, "suppliers"), snap => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubP(); unsubS(); };
  }, []);

  async function saveProduct(p) {
    const id = p.id || genId();
    await setDoc(doc(db, "products", id), { ...p, id });
    setShowProductModal(false); setEditingProduct(null);
  }
  async function deleteProduct(id) { await deleteDoc(doc(db, "products", id)); }

  async function updateDaily(productId, day, value) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const dailyEntries = { ...p.dailyEntries, [day]: value === "" ? "" : Number(value) };
    await setDoc(doc(db, "products", productId), { ...p, dailyEntries });
  }

  async function saveSupplier(s) {
    const id = s.id || genId();
    await setDoc(doc(db, "suppliers", id), { ...s, id });
    setShowSupplierModal(false); setEditingSupplier(null);
  }
  async function deleteSupplier(id) { await deleteDoc(doc(db, "suppliers", id)); }

  const sectionProducts = products.filter(p => p.section === activeSection);
  const toOrderProducts = products.filter(p => ["red","yellow"].includes(getStatus(p)));
  const lowCount        = toOrderProducts.length;

  function printReport() {
    const rows = toOrderProducts.map(p => {
      const sup = suppliers.find(s => s.id === p.supplierId);
      const stock = getCurrentStock(p); const st = getStatus(p);
      return `<tr style="background:${st==="red"?"#fff5f5":"#fffbeb"};border-bottom:1px solid #e2e8f0">
        <td style="padding:8px 12px;font-weight:600">${p.name}</td>
        <td style="padding:8px 12px">${p.section}</td>
        <td style="padding:8px 12px;text-align:center">${stock}</td>
        <td style="padding:8px 12px;text-align:center">${p.minimum}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:700;color:#3b82f6">${p.orderQty}</td>
        <td style="padding:8px 12px">${sup?.name ?? "—"}</td>
        <td style="padding:8px 12px">${sup?.contact ?? "—"}</td>
        <td style="padding:8px 12px;font-weight:700;color:${st==="red"?"#991b1b":"#854d0e"}">${st==="red"?"⚠️ Commander":"🟡 Bientôt bas"}</td>
      </tr>`;
    }).join("");
    const win = window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Rapport – Bochica</title>
    <style>body{font-family:system-ui,sans-serif;padding:32px;color:#1e293b}table{width:100%;border-collapse:collapse;font-size:13px}th{padding:10px 12px;background:#f1f5f9;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b}@media print{button{display:none}}</style></head>
    <body>
    <div style="margin-bottom:16px">
      <div style="font-size:28px;font-weight:900;letter-spacing:4px">BOCHICA</div>
      <div style="font-size:14px;color:#475569">Restaurant Colombien</div>
      <div style="display:flex;height:3px;width:220px;margin-top:4px"><div style="flex:1;background:#f5a623"></div><div style="flex:1;background:#4a90e2"></div><div style="flex:1;background:#e74c3c"></div></div>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>
    <h2 style="margin:0 0 4px">Rapport de commande</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">Généré le ${new Date().toLocaleDateString("fr-CA",{weekday:"long",year:"numeric",month:"long",day:"numeric"})} — ${toOrderProducts.length} produit(s)</p>
    <table><thead><tr><th>Produit</th><th>Section</th><th>Stock actuel</th><th>Minimum</th><th>Qté à commander</th><th>Fournisseur</th><th>Contact</th><th>Statut</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <br/><button onclick="window.print()" style="background:#3b82f6;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">🖨️ Imprimer</button>
    </body></html>`);
    win.document.close();
  }

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"system-ui", color:"#475569" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔥</div>
      <div style={{ fontWeight:700, fontSize:18 }}>Connexion à Firebase…</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"system-ui,sans-serif", minHeight:"100vh", background:"#f8fafc" }}>
      <div style={{ background:"linear-gradient(135deg,#1e293b,#334155)", color:"#fff", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontWeight:900, fontSize:22, letterSpacing:4, lineHeight:1 }}>BOCHICA</div>
          <div style={{ fontSize:10, opacity:0.7, letterSpacing:1 }}>Restaurant Colombien</div>
          <div style={{ display:"flex", height:2, marginTop:3, width:120 }}>
            <div style={{ flex:1, background:"#f5a623" }}></div>
            <div style={{ flex:1, background:"#4a90e2" }}></div>
            <div style={{ flex:1, background:"#e74c3c" }}></div>
          </div>
        </div>
        {lowCount > 0 && (
          <div style={{ background:"#ef4444", borderRadius:20, padding:"4px 14px", fontSize:13, fontWeight:600 }}>
            ⚠️ {lowCount} produit{lowCount>1?"s":""} à commander
          </div>
        )}
      </div>

      <div style={{ display:"flex", background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"0 24px" }}>
        {["inventaire","rapport","fournisseurs"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding:"12px 20px", fontWeight:600, fontSize:14, border:"none", background:"none", cursor:"pointer", borderBottom: activeTab===tab ? "3px solid #3b82f6" : "3px solid transparent", color: activeTab===tab ? "#3b82f6" : "#64748b" }}>
            {tab==="inventaire" ? "📦 Inventaire" : tab==="rapport" ? `📋 Rapport${lowCount>0?` (${lowCount})` : ""}` : "🏪 Fournisseurs"}
          </button>
        ))}
      </div>

      <div style={{ padding:"24px", maxWidth:1200, margin:"0 auto" }}>

        {activeTab==="inventaire" && <>
          <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
            {SECTIONS.map(s => {
              const cnt = products.filter(p => p.section===s && ["red","yellow"].includes(getStatus(p))).length;
              return (
                <button key={s} onClick={() => setActiveSection(s)}
                  style={{ padding:"8px 20px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:600, fontSize:14, background: activeSection===s ? "#3b82f6" : "#e2e8f0", color: activeSection===s ? "#fff" : "#475569" }}>
                  {s} {cnt>0 && <span style={{ background:"#ef4444", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:11, marginLeft:4 }}>{cnt}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h2 style={{ margin:0, fontSize:18, color:"#1e293b" }}>Section : {activeSection}</h2>
            <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
              style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:600, cursor:"pointer", fontSize:14 }}>
              + Ajouter un produit
            </button>
          </div>
          {sectionProducts.length===0 ? (
            <div style={{ textAlign:"center", color:"#94a3b8", marginTop:60, fontSize:15 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>📭</div>Aucun produit dans cette section.
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#f1f5f9" }}>
                    <th style={th()}>Produit</th><th style={th()}>Unité</th><th style={th()}>Qté à commander</th>
                    {DAYS.map(d => <th key={d} style={th()}>{d}</th>)}
                    <th style={th()}>Stock actuel</th><th style={th()}>Minimum</th><th style={th()}>Fournisseur</th><th style={th()}>Statut</th><th style={th()}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionProducts.map(p => {
                    const st = getStatus(p); const stock = getCurrentStock(p);
                    const sup = suppliers.find(s => s.id===p.supplierId);
                    return (
                      <tr key={p.id} style={{ borderBottom:"1px solid #e2e8f0", background: st==="red"?"#fff5f5": st==="yellow"?"#fffbeb":"#fff" }}>
                        <td style={td()}><strong>{p.name}</strong></td>
                        <td style={td()}>{p.unit}</td>
                        <td style={{ ...td(), fontWeight:600, color:"#3b82f6" }}>{p.orderQty}</td>
                        {DAYS.map(d => (
                          <td key={d} style={td()}>
                            <input type="number" value={p.dailyEntries?.[d]??""} onChange={e => updateDaily(p.id, d, e.target.value)}
                              placeholder="—" style={{ width:52, border:"1px solid #cbd5e1", borderRadius:4, padding:"2px 4px", textAlign:"center", fontSize:12 }} />
                          </td>
                        ))}
                        <td style={{ ...td(), fontWeight:700, fontSize:15, ...STATUS_STYLE[st], textAlign:"center" }}>{stock}</td>
                        <td style={td()}>{p.minimum}</td>
                        <td style={td()}>{sup ? <span>{sup.name}</span> : <span style={{ color:"#94a3b8" }}>—</span>}</td>
                        <td style={td()}>
                          <span style={{ ...STATUS_STYLE[st], borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                            {st==="red"?"⚠️ Commander": st==="yellow"?"🟡 Bientôt bas":"✅ OK"}
                          </span>
                        </td>
                        <td style={td()}>
                          <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} style={btnSm("#3b82f6")}>✏️</button>
                          <button onClick={() => deleteProduct(p.id)} style={btnSm("#ef4444")}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>}

        {activeTab==="rapport" && <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <h2 style={{ margin:0, fontSize:18, color:"#1e293b" }}>Rapport de commande</h2>
              <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:13 }}>Produits sous le minimum ou à moins de 20% du seuil</p>
            </div>
            <button onClick={printReport} disabled={toOrderProducts.length===0}
              style={{ background: toOrderProducts.length>0?"#3b82f6":"#e2e8f0", color: toOrderProducts.length>0?"#fff":"#94a3b8", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:600, cursor:"pointer", fontSize:14 }}>
              🖨️ Exporter / Imprimer
            </button>
          </div>
          {toOrderProducts.length===0 ? (
            <div style={{ textAlign:"center", color:"#94a3b8", marginTop:60 }}>
              <div style={{ fontSize:48, marginBottom:8 }}>✅</div>Tous les produits sont en quantité suffisante !
            </div>
          ) : <>
            <div style={{ display:"flex", gap:12, marginBottom:20 }}>
              {[
                { label:"⚠️ À commander immédiatement", count: toOrderProducts.filter(p=>getStatus(p)==="red").length, bg:"#fee2e2", color:"#991b1b" },
                { label:"🟡 Bientôt bas (< 20% du min)", count: toOrderProducts.filter(p=>getStatus(p)==="yellow").length, bg:"#fef9c3", color:"#854d0e" },
              ].map(c => (
                <div key={c.label} style={{ flex:1, background:c.bg, border:`1px solid ${c.color}`, borderRadius:10, padding:"12px 16px" }}>
                  <div style={{ fontWeight:700, fontSize:22, color:c.color }}>{c.count}</div>
                  <div style={{ fontSize:13, color:c.color }}>{c.label}</div>
                </div>
              ))}
            </div>
            {SECTIONS.map(section => {
              const items = toOrderProducts.filter(p => p.section===section);
              if (!items.length) return null;
              return (
                <div key={section} style={{ marginBottom:24 }}>
                  <h3 style={{ margin:"0 0 10px", fontSize:15, color:"#475569", borderBottom:"2px solid #e2e8f0", paddingBottom:6 }}>📁 {section}</h3>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead><tr style={{ background:"#f1f5f9" }}>
                      <th style={th()}>Produit</th><th style={th()}>Unité</th><th style={th()}>Stock actuel</th><th style={th()}>Minimum</th><th style={th()}>Qté à commander</th><th style={th()}>Fournisseur</th><th style={th()}>Contact</th><th style={th()}>Statut</th>
                    </tr></thead>
                    <tbody>
                      {items.map(p => {
                        const st = getStatus(p); const stock = getCurrentStock(p);
                        const sup = suppliers.find(s => s.id===p.supplierId);
                        return (
                          <tr key={p.id} style={{ borderBottom:"1px solid #e2e8f0", background: st==="red"?"#fff5f5":"#fffbeb" }}>
                            <td style={td()}><strong>{p.name}</strong></td>
                            <td style={td()}>{p.unit}</td>
                            <td style={{ ...td(), fontWeight:700, ...STATUS_STYLE[st], textAlign:"center" }}>{stock}</td>
                            <td style={td()}>{p.minimum}</td>
                            <td style={{ ...td(), fontWeight:700, color:"#3b82f6" }}>{p.orderQty}</td>
                            <td style={td()}>{sup?.name ?? "—"}</td>
                            <td style={td()}>{sup?.contact ?? "—"}</td>
                            <td style={td()}>
                              <span style={{ ...STATUS_STYLE[st], borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                                {st==="red"?"⚠️ Commander":"🟡 Bientôt bas"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </>}
        </>}

        {activeTab==="fournisseurs" && <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h2 style={{ margin:0, fontSize:18, color:"#1e293b" }}>Fournisseurs</h2>
            <button onClick={() => { setEditingSupplier(null); setShowSupplierModal(true); }}
              style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:600, cursor:"pointer", fontSize:14 }}>
              + Ajouter un fournisseur
            </button>
          </div>
          {suppliers.length===0 ? (
            <div style={{ textAlign:"center", color:"#94a3b8", marginTop:60 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🏪</div>Aucun fournisseur enregistré.
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
              {suppliers.map(s => {
                const linked = products.filter(p => p.supplierId===s.id);
                return (
                  <div key={s.id} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:20 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:16 }}>🏪 {s.name}</div>
                        {s.contact && <div style={{ color:"#64748b", fontSize:13, marginTop:4 }}>📞 {s.contact}</div>}
                        {s.email && <div style={{ color:"#64748b", fontSize:13 }}>✉️ {s.email}</div>}
                        {s.notes && <div style={{ color:"#94a3b8", fontSize:12, marginTop:6, fontStyle:"italic" }}>{s.notes}</div>}
                      </div>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={() => { setEditingSupplier(s); setShowSupplierModal(true); }} style={btnSm("#3b82f6")}>✏️</button>
                        <button onClick={() => deleteSupplier(s.id)} style={btnSm("#ef4444")}>🗑️</button>
                      </div>
                    </div>
                    {linked.length>0 && (
                      <div style={{ marginTop:12, borderTop:"1px solid #f1f5f9", paddingTop:10 }}>
                        <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, fontWeight:600 }}>PRODUITS LIÉS</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                          {linked.map(p => <span key={p.id} style={{ background:"#eff6ff", color:"#3b82f6", borderRadius:12, padding:"2px 10px", fontSize:12 }}>{p.name}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>}
      </div>

      {showProductModal && (
        <Modal title={editingProduct ? "Modifier le produit" : "Ajouter un produit"} onClose={() => { setShowProductModal(false); setEditingProduct(null); }}>
          <ProductForm initial={editingProduct || { name:"", unit:"", orderQty:0, minimum:0, section:activeSection, supplierId:"" }}
            suppliers={suppliers} sections={SECTIONS} onSave={saveProduct} onCancel={() => { setShowProductModal(false); setEditingProduct(null); }} />
        </Modal>
      )}
      {showSupplierModal && (
        <Modal title={editingSupplier ? "Modifier le fournisseur" : "Ajouter un fournisseur"} onClose={() => { setShowSupplierModal(false); setEditingSupplier(null); }}>
          <SupplierForm initial={editingSupplier || { name:"", contact:"", email:"", notes:"" }}
            onSave={saveSupplier} onCancel={() => { setShowSupplierModal(false); setEditingSupplier(null); }} />
        </Modal>
      )}
    </div>
  );
}

function ProductForm({ initial, suppliers, sections, onSave, onCancel }) {
  const [f, setF] = useState({ ...initial });
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <label style={lbl()}>Nom du produit<input style={inp()} value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="ex: Tomates"/></label>
      <label style={lbl()}>Unité<input style={inp()} value={f.unit} onChange={e=>upd("unit",e.target.value)} placeholder="ex: kg, boîte, litre..."/></label>
      <label style={lbl()}>Section
        <select style={inp()} value={f.section} onChange={e=>upd("section",e.target.value)}>
          {sections.map(s=><option key={s}>{s}</option>)}
        </select>
      </label>
      <div style={{ display:"flex", gap:12 }}>
        <label style={{ ...lbl(), flex:1 }}>Qté à commander<input style={inp()} type="number" value={f.orderQty} onChange={e=>upd("orderQty",e.target.value)}/></label>
        <label style={{ ...lbl(), flex:1 }}>Minimum requis<input style={inp()} type="number" value={f.minimum} onChange={e=>upd("minimum",e.target.value)}/></label>
      </div>
      <label style={lbl()}>Fournisseur
        <select style={inp()} value={f.supplierId||""} onChange={e=>upd("supplierId",e.target.value)}>
          <option value="">— Aucun —</option>
          {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
        <button onClick={onCancel} style={{ padding:"8px 18px", border:"1px solid #e2e8f0", borderRadius:8, cursor:"pointer", background:"#f8fafc" }}>Annuler</button>
        <button onClick={()=>onSave(f)} disabled={!f.name} style={{ padding:"8px 18px", border:"none", borderRadius:8, cursor:"pointer", background:"#3b82f6", color:"#fff", fontWeight:600, opacity:f.name?1:0.5 }}>Enregistrer</button>
      </div>
    </div>
  );
}

function SupplierForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ ...initial });
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <label style={lbl()}>Nom du fournisseur<input style={inp()} value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="ex: Distribution ABC"/></label>
      <label style={lbl()}>Téléphone<input style={inp()} value={f.contact} onChange={e=>upd("contact",e.target.value)} placeholder="ex: 514-555-0000"/></label>
      <label style={lbl()}>Courriel<input style={inp()} value={f.email} onChange={e=>upd("email",e.target.value)} placeholder="ex: commandes@abc.com"/></label>
      <label style={lbl()}>Notes<textarea style={{ ...inp(), height:70, resize:"vertical" }} value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Jours de livraison, conditions..."/></label>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
        <button onClick={onCancel} style={{ padding:"8px 18px", border:"1px solid #e2e8f0", borderRadius:8, cursor:"pointer", background:"#f8fafc" }}>Annuler</button>
        <button onClick={()=>onSave(f)} disabled={!f.name} style={{ padding:"8px 18px", border:"none", borderRadius:8, cursor:"pointer", background:"#3b82f6", color:"#fff", fontWeight:600, opacity:f.name?1:0.5 }}>Enregistrer</button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#0007", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:14, padding:24, width:"100%", maxWidth:480, boxShadow:"0 20px 60px #0003" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:17, color:"#1e293b" }}>{title}</h3>
          <button onClick={onClose} style={{ border:"none", background:"none", fontSize:20, cursor:"pointer", color:"#94a3b8" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const th  = () => ({ padding:"10px 12px", textAlign:"left", fontWeight:600, fontSize:12, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" });
const td  = () => ({ padding:"10px 12px", verticalAlign:"middle" });
const btnSm = bg => ({ background:bg, color:"#fff", border:"none", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:13, marginRight:4 });
const lbl = () => ({ display:"flex", flexDirection:"column", gap:4, fontSize:13, fontWeight:600, color:"#475569" });
const inp = () => ({ padding:"8px 12px", border:"1px solid #cbd5e1", borderRadius:8, fontSize:14, outline:"none" });
