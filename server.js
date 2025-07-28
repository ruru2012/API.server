// /api/server.js
// Versão 2.0: Abordagem de "detetive" para buscar todos os dados em sequência.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// ROTA DE LOGIN (sem mudanças)
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
  try {
    const response = await axios.post('https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken', 
      { user: `${ra}SP`, senha },
      { headers: { 'Ocp-Apim-Subscription-Key': '2b03c1db3884488795f79c37c069381a' } }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login', details: error.response?.data });
  }
});

// NOVA ROTA "MESTRE" QUE BUSCA TUDO
app.post('/api/dashboard-data', async (req, res) => {
    const { token, codigoAluno } = req.body;
    if (!token || !codigoAluno) {
        return res.status(400).json({ error: 'Token e Código do Aluno são necessários.' });
    }

    const authHeader = { 'Authorization': `Bearer ${token}` };

    try {
        // --- PASSO 1: Buscar Perfis para encontrar o código da escola ---
        console.log("Passo 1: Buscando perfis...");
        const perfisUrl = 'https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-perfis';
        const perfisResponse = await axios.get(perfisUrl, { 
            headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' }
        });
        
        // Assumindo que a resposta de perfis é um array e pegamos o primeiro perfil de aluno
        const perfilAluno = perfisResponse.data.find(p => p.perfilId === 1); // Perfil 1 é geralmente "Aluno"
        if (!perfilAluno || !perfilAluno.escolas || perfilAluno.escolas.length === 0) {
            throw new Error("Perfil de aluno ou código da escola não encontrado na resposta de perfis.");
        }
        const escolaId = perfilAluno.escolas[0].escolaId; // Pega o código da primeira escola
        console.log(`Passo 1.1: Encontrado escolaId: ${escolaId}`);
        
        // --- PASSO 2: Buscar Turmas com o código da escola ---
        console.log("Passo 2: Buscando turmas...");
        const turmasUrl = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${new Date().getFullYear()}`;
        const turmasResponse = await axios.get(turmasUrl, {
            headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab' }
        });

        if (!turmasResponse.data.isSucess || !turmasResponse.data.data) {
             throw new Error("A busca por turmas falhou ou não retornou dados.");
        }
        const turmas = turmasResponse.data.data;
        console.log(`Passo 2.1: Encontradas ${turmas.length} turmas.`);

        // --- PASSO 3: Buscar Mensagens e Avisos (se houver turmas) ---
        let notificacoes = [];
        let avisos = [];
        if (turmas.length > 0) {
            console.log("Passo 3: Buscando notificações e avisos...");
            const primeiraTurmaId = turmas[0].codigo;
            
            const urlNotificacoes = `https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${codigoAluno}`;
            const urlAvisos = `https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-avisos?CodigoUsuario=${codigoAluno}&PerfilAviso=1&Turmas=${primeiraTurmaId}`;

            const [notificacoesRes, avisosRes] = await Promise.all([
                axios.get(urlNotificacoes, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '1a758fd2f6be41448079c9616a861b91' } }),
                axios.get(urlAvisos, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' } })
            ]);
            notificacoes = notificacoesRes.data;
            avisos = avisosRes.data;
            console.log(`Passo 3.1: Encontradas ${notificacoes.length} notificações e ${avisos.length} avisos.`);
        }

        // --- PASSO FINAL: Enviar tudo de volta para o frontend ---
        res.status(200).json({
            turmas: turmas,
            notificacoes: notificacoes,
            avisos: avisos
        });

    } catch (error) {
        console.error("Erro no fluxo do dashboard:", error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Falha ao buscar os dados do dashboard.', 
            details: error.response?.data || error.message 
        });
    }
});

module.exports = app;

