// ══════════════════════════════════════════════
// config.js — Firebase + Constantes da Rede
// ══════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "AIzaSyBjIveFv6Vl9XzvX3XQ9a10UCL0dV_4B9M",
  authDomain:        "estoque-pegpao.firebaseapp.com",
  databaseURL:       "https://estoque-pegpao-default-rtdb.firebaseio.com",
  projectId:         "estoque-pegpao",
  storageBucket:     "estoque-pegpao.firebasestorage.app",
  messagingSenderId: "233197174747",
  appId:             "1:233197174747:web:1812fb1dd8e69cc962b1fe",
  measurementId:     "G-RQC66W5SNP"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.database();
const auth = firebase.auth();

// ── Padarias ──────────────────────────────────
const PADARIAS = [
  { id:'mongagua_1',   nome:'Mongaguá 1',   cidade:'Mongaguá',    ico:'🌊', ativo:true  },
  { id:'mongagua_2',   nome:'Mongaguá 2',   cidade:'Mongaguá',    ico:'🌊', ativo:true  },
  { id:'itanhaem_1',   nome:'Itanhaém 1',   cidade:'Itanhaém',    ico:'🏝️', ativo:true  },
  { id:'itanhaem_2',   nome:'Itanhaém 2',   cidade:'Itanhaém',    ico:'🏝️', ativo:true  },
  { id:'itanhaem_3',   nome:'Itanhaém 3',   cidade:'Itanhaém',    ico:'🏝️', ativo:true  },
  { id:'peruibe_1',    nome:'Peruíbe 1',    cidade:'Peruíbe',     ico:'🐟', ativo:true  },
  { id:'saovicente_1', nome:'São Vicente',  cidade:'São Vicente',  ico:'⚓', ativo:true  },
  { id:'praiagde_1',   nome:'Praia Grande', cidade:'Praia Grande', ico:'🏖️', ativo:false }
];

// ── Categorias ────────────────────────────────
const CATEGORIAS = {
  FARINHAS:    { label:'Farinhas',    ico:'🌾', cls:'cat-farinhas'    },
  FRIOS:       { label:'Frios',       ico:'🧀', cls:'cat-frios'       },
  FRIGORIFICO: { label:'Frigorífico', ico:'🥩', cls:'cat-frigorifico' },
  SECOS:       { label:'Secos',       ico:'📦', cls:'cat-secos'       },
  EMBALAGENS:  { label:'Embalagens',  ico:'🗃️', cls:'cat-embalagens'  },
  LIMPEZA:     { label:'Limpeza',     ico:'🧹', cls:'cat-limpeza'     },
  BEBIDAS:     { label:'Bebidas',     ico:'🥤', cls:'cat-bebidas'     }
};

// ── Níveis ────────────────────────────────────
const NIVEL = { OPERADOR:1, GERENTE:2, ADMIN:3, DONO:4 };
