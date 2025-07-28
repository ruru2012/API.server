// /api/server.js
// Versão Final: Automatiza todo o fluxo de investigação do Taskitos.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- FUNÇÃO DE CABEÇALHOS PADRÃO ---
const getTaskitosHeaders = (token) => ({
    'x-api-key': token,
    'x-client-domain': 'taskitos.cupiditys.lol',
    'origin': 'https://taskitos.cupiditys.lol',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
});

// --- ROTAS DA API ---

// ROTA DE LOGIN (MÉTODO TASKITOS)
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
  try {
    const response = await axios.post('https://edusp-api.ip.tv/registration/edusp', 
      { realm: "edusp", platform: "webclient", id: `${ra}sp`, password: senha },
      { 
        headers: { 
            'x-client-timestamp': Date.now(),
            'x-client-domain': 'taskitos.cupiditys.lol',
            'origin': 'https://taskitos.cupiditys.lol',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
        } 
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login (método Taskitos)', details: error.response?.data });
  }
});

// ROTA "MESTRE" QUE BUSCA AS TAREFAS AUTOMATICAMENTE
app.post('/api/get-tasks', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token é necessário.' });

    try {
        // --- PASSO 1: Extrair Pistas Automaticamente ---
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', { 
            headers: getTaskitosHeaders(token) 
        });
        
        const roomsData = roomsResponse.data;
        if (!roomsData || !roomsData.rooms) {
            throw new Error("Resposta de /room/user inválida ou sem a propriedade 'rooms'.");
        }

        // Extrai todos os IDs necessários
        const roomIds = roomsData.rooms.map(room => room.id);
        const groupIds = roomsData.rooms.flatMap(room => room.group_categories ? room.group_categories.map(group => group.id) : []);
        const allTargets = [...new Set([...roomIds, ...groupIds])]; // Junta tudo e remove duplicados

        if (allTargets.length === 0) {
            return res.status(200).json({ items: [] });
        }

        // --- PASSO 2: Buscar as tarefas com os alvos corretos ---
        const publicationTargets = allTargets.map(target => `publication_target[]=${target}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const tarefasResponse = await axios.get(urlTarefas, { 
            headers: getTaskitosHeaders(token) 
        });

        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas.', details: error.response?.data });
    }
});

module.exports = app;

        
