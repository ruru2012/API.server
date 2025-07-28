// /api/server.js
// Versão Final: Usa o login do Taskitos para obter o x-api-key e o método da
// Sala do Futuro (sem assinatura) para buscar as tarefas.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- FUNÇÃO DE CABEÇALHOS PADRÃO ---
// Estes são os cabeçalhos mínimos necessários que ambos os sites usam.
const getHeaders = (token) => ({
    'x-api-key': token,
    'origin': 'https://saladofuturo.educacao.sp.gov.br', // Fingimos ser o site oficial
    'referer': 'https://saladofuturo.educacao.sp.gov.br/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
});

// --- ROTAS DA API ---

// ROTA DE LOGIN (MÉTODO TASKITOS - A nossa chave de entrada)
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
  try {
    // Usamos o endpoint de registro que nos dá o token correto.
    const response = await axios.post('https://edusp-api.ip.tv/registration/edusp', 
      { realm: "edusp", platform: "webclient", id: `${ra}sp`, password: senha },
      { 
        headers: { 
            'origin': 'https://taskitos.cupiditys.lol', // O login ainda precisa parecer vir do Taskitos
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
        } 
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login. Verifique seu RA e senha.', details: error.response?.data });
  }
});

// ROTA "MESTRE" QUE BUSCA AS TAREFAS
app.post('/api/get-tasks', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token é necessário.' });

    try {
        // --- PASSO 1: Obter a lista de "salas" e grupos ---
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', { 
            headers: getHeaders(token) 
        });
        
        const roomsData = roomsResponse.data;
        if (!roomsData || !roomsData.rooms) {
            throw new Error("Resposta de /room/user inválida.");
        }

        const roomIds = roomsData.rooms.map(room => room.id);
        const groupIds = roomsData.rooms.flatMap(room => room.group_categories ? room.group_categories.map(group => group.id) : []);
        const allTargets = [...new Set([...roomIds, ...groupIds])];

        if (allTargets.length === 0) {
            return res.status(200).json({ items: [] });
        }

        // --- PASSO 2: Buscar as tarefas com os alvos corretos ---
        const publicationTargets = allTargets.map(target => `publication_target=${target}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&limit=100&offset=0&filter_expired=true&is_exam=false&with_answer=true&is_essay=false&${publicationTargets}`;

        const tarefasResponse = await axios.get(urlTarefas, { 
            headers: getHeaders(token) 
        });

        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas.', details: error.response?.data });
    }
});

module.exports = app;

            
