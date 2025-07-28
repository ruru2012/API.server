// /api/server.js
// Versão 4.0: Implementa a lógica de assinatura do "Taskitos" para acessar a API de tarefas.

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto'); // Módulo nativo do Node.js para criptografia

const app = express();
app.use(cors()); 
app.use(express.json());

// --- FUNÇÃO SECRETA PARA GERAR A ASSINATURA ---
// Recriamos a lógica de assinatura que o Taskitos provavelmente usa.
function generateSignature(timestamp, userId) {
    const text = `${timestamp}${userId}`;
    // Usamos o algoritmo MD5, que é comum para gerar assinaturas simples.
    const hash = crypto.createHash('md5').update(text).digest('hex');
    // A assinatura final é a hash MD5 codificada em Base64.
    return Buffer.from(hash).toString('base64');
}

// --- ROTAS DA SED (INALTERADAS) ---
app.post('/api/login', async (req, res) => { /* ...código de login inalterado... */ });
app.post('/api/dashboard-data', async (req, res) => { /* ...código do dashboard inalterado... */ });

// --- ROTA DE TAREFAS (COMPLETAMENTE NOVA) ---
app.post('/api/tarefas', async (req, res) => {
    // Agora recebemos o token e o ID do usuário da resposta de login do Taskitos.
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: 'Token e UserID são necessários.' });

    try {
        // --- PASSO 1: Obter a lista de "salas" (turmas) do usuário ---
        console.log("Taskitos - Passo 1: Buscando salas do usuário.");
        const timestamp1 = Date.now();
        const signature1 = generateSignature(timestamp1, userId);
        
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', {
            headers: {
                'x-api-key': token,
                'x-client-timestamp': timestamp1,
                'x-client-signature': signature1,
                'x-client-domain': 'taskitos.cupiditys.lol',
                'origin': 'https://taskitos.cupiditys.lol',
            }
        });
        
        const rooms = roomsResponse.data.items;
        if (!rooms || rooms.length === 0) {
            return res.status(200).json({ items: [] }); // Retorna sucesso, mas sem tarefas
        }
        console.log(`Taskitos - Encontradas ${rooms.length} salas.`);

        // --- PASSO 2: Buscar as tarefas para cada sala ---
        console.log("Taskitos - Passo 2: Buscando tarefas para cada sala.");
        const publicationTargets = rooms.map(room => `publication_target[]=${room.id}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const timestamp2 = Date.now();
        const signature2 = generateSignature(timestamp2, userId);

        const tarefasResponse = await axios.get(urlTarefas, {
            headers: {
                'x-api-key': token,
                'x-client-timestamp': timestamp2,
                'x-client-signature': signature2,
                'x-client-domain': 'taskitos.cupiditys.lol',
                'origin': 'https://taskitos.cupiditys.lol',
            }
        });

        console.log("Taskitos - Sucesso! Tarefas encontradas.");
        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        console.error("Erro no fluxo do Taskitos:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas pelo método Taskitos.', details: error.response?.data });
    }
});

// --- ROTA DE RESOLVER COM IA (INALTERADA) ---
app.post('/api/resolver-tarefa', async (req, res) => { /* ...código do Gemini inalterado... */ });


// --- CÓDIGOS OMITIDOS (INALTERADOS) ---
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
  try {
    // A primeira requisição para o Taskitos é diferente
    const timestamp = Date.now();
    // A assinatura do login parece ser apenas o ID do usuário em Base64
    const signature = Buffer.from(ra.replace(/\D/g, '')).toString('base64');

    const response = await axios.post('https://edusp-api.ip.tv/registration/edusp', 
      { realm: "edusp", platform: "webclient", id: `${ra}sp`, password: senha },
      { 
        headers: { 
            'x-client-timestamp': timestamp,
            'x-client-signature': signature,
            'x-client-domain': 'taskitos.cupiditys.lol',
            'origin': 'https://taskitos.cupiditys.lol',
        } 
      }
    );
    // A resposta do login do Taskitos contém o token e o userId que precisamos
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login (método Taskitos)', details: error.response?.data });
  }
});
app.post('/api/dashboard-data', async (req, res) => {
    const { token, codigoAluno } = req.body;
    if (!token || !codigoAluno) return res.status(400).json({ error: 'Token e Código do Aluno são necessários.' });
    const authHeader = { 'Authorization': `Bearer ${token}` };
    try {
        const turmasUrl = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${new Date().getFullYear()}`;
        const turmasResponse = await axios.get(turmasUrl, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab' }});
        const turmas = (turmasResponse.data.isSucess && turmasResponse.data.data) ? turmasResponse.data.data : [];
        let notificacoes = [], avisos = [];
        if (turmas.length > 0) {
            const primeiraTurmaId = turmas[0].codigo;
            const [notificacoesRes, avisosRes] = await Promise.all([
                axios.get(`https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${codigoAluno}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '1a758fd2f6be41448079c9616a861b91' } }),
                axios.get(`https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-avisos?CodigoUsuario=${codigoAluno}&PerfilAviso=1&Turmas=${primeiraTurmaId}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' } })
            ]);
            notificacoes = notificacoesRes.data;
            avisos = avisosRes.data;
        }
        res.status(200).json({ turmas, notificacoes, avisos });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao buscar os dados do dashboard.', details: error.response?.data || error.message });
    }
});
app.post('/api/resolver-tarefa', async (req, res) => {
    const { prompt, apiKey } = req.body;
    if (!prompt || !apiKey) return res.status(400).json({ error: 'Prompt e Chave de API são necessários.' });
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{ parts: [{ text: `Por favor, responda a seguinte questão acadêmica de forma clara e completa, como se fosse para um trabalho escolar. Questão: "${prompt}"` }] }]
        }, { headers: { 'Content-Type': 'application/json' } });
        const text = response.data.candidates[0].content.parts[0].text;
        res.status(200).json({ answer: text });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao comunicar com a IA.', details: error.response?.data?.error?.message });
    }
});

module.exports = app;

                                                   
