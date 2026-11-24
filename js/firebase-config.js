// =================================================================
// CONFIGURAÇÃO DO FIREBASE — projeto harmony-clinical-center-db462
// -----------------------------------------------------------------
// Estes dados NÃO são senha: ficam visíveis no navegador em qualquer
// site Firebase. Quem protege os dados são as REGRAS do Realtime
// Database (database.rules.json) + o login.
// =================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDgiWYKsr4JxIo3fier1FFAKVC6PKvyuAw",
  authDomain: "harmony-clinical-center-db462.firebaseapp.com",
  databaseURL: "https://harmony-clinical-center-db462-default-rtdb.firebaseio.com",
  projectId: "harmony-clinical-center-db462",
  storageBucket: "harmony-clinical-center-db462.firebasestorage.app",
  messagingSenderId: "1037506872309",
  appId: "1:1037506872309:web:4e37e0251f53ebe2f016bc",
  measurementId: "G-M6R8B678RL",
};

// No login a pessoa digita só o usuário ("fabiana").
// O site completa com este sufixo antes de enviar ao Firebase:
// fabiana → fabiana@hcc.com  (crie as contas em Authentication → Users)
export const LOGIN_DOMAIN = "@hcc.com";

// Cada usuário enxerga um setor (pasta no banco).
// Quem não estiver na lista vai para o setor padrão.
export const SETOR_PADRAO = { key: "agendamentos", label: "Estética" };
export const SETORES_POR_USUARIO = {
  hedney: { key: "pilates", label: "Pilates" },
};

// Atalhos de procedimento ao agendar (editáveis em Ajustes).
export const PROCEDIMENTOS_PADRAO = {
  agendamentos: [
    "Depilação a Laser", "Preenchimento", "Botox", "Retorno", "Sobrancelha",
    "Limpeza de Pele", "Avaliação", "Drenagem", "Bioestimulador", "Skin Booster",
  ],
  pilates: ["Pilates"],
};

// Grade de horários da agenda
export const HORA_INICIO = 7;   // 07:00
export const HORA_FIM = 22;     // último horário: 22:00
export const INTERVALO_MIN = 30;
