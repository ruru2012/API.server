// /api/server.js
// Versão 6.0: Implementa uma busca sequencial inteligente.
// 1. Login -> 2. Busca Perfil/Escola -> 3. Busca Turmas com dados completos.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// ROTA DE LOGIN (Método original da SED)
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

// ROTA "MESTRE" QUE BUSCA TODOS OS DADOS DO DASHBOARD
app.post('/api/get-all-data', async (req, res) => {
    const { token, codigoAluno } = req.body;
    if (!token || !codigoAluno) {
        return res.status(400).json({ error: 'Token e Código do Aluno são necessários.' });
    }

    const authHeader = { 'Authorization': `Bearer ${token}` };

    try {
        // --- PASSO 1: Buscar Perfis para encontrar o código da escola ---
        console.log("[DETETIVE] Passo 1: Buscando perfis do usuário...");
        const perfisUrl = 'https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-perfis';
        const perfisResponse = await axios.get(perfisUrl, { 
            headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' }
        });
        
        const perfilAluno = perfisResponse.data.find(p => p.perfilId === 1); // Perfil 1 é "Aluno"
        if (!perfilAluno || !perfilAluno.escolas || perfilAluno.escolas.length === 0) {
            throw new Error("Perfil de aluno ou código da escola não foi encontrado na resposta de perfis.");
        }
        const escolaId = perfilAluno.escolas[0].escolaId;
        console.log(`[DETETIVE] Passo 1 CONCLUÍDO. Escola ID: ${escolaId}`);
        
        // --- PASSO 2: Buscar Turmas com o código da escola e ano letivo ---
        console.log("[DETETIVE] Passo 2: Buscando turmas com dados precisos...");
        const anoLetivo = new Date().getFullYear();
        const turmasUrl = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${anoLetivo}&codigoEscola=${escolaId}`;
        
        const turmasResponse = await axios.get(turmasUrl, {
            headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab' }
        });

        if (!turmasResponse.data.isSucess || !turmasResponse.data.data) {
             throw new Error("A busca por turmas falhou ou não retornou dados. Verifique se o ano letivo e a escola estão corretos.");
        }
        const turmas = turmasResponse.data.data;
        console.log(`[DETETIVE] Passo 2 CONCLUÍDO. Encontradas ${turmas.length} turmas.`);

        // --- PASSO 3: Buscar Mensagens e Avisos (se houver turmas) ---
        let notificacoes = [], avisos = [];
        if (turmas.length > 0) {
            console.log("[DETETIVE] Passo 3: Buscando notificações e avisos...");
            const primeiraTurmaId = turmas[0].codigo;
            
            const [notificacoesRes, avisosRes] = await Promise.all([
                axios.get(`https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${codigoAluno}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '1a758fd2f6be41448079c9616a861b91' } }),
                axios.get(`https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-avisos?CodigoUsuario=${codigoAluno}&PerfilAviso=1&Turmas=${primeiraTurmaId}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' } })
            ]);
            notificacoes = notificacoesRes.data;
            avisos = avisosRes.data;
            console.log(`[DETETIVE] Passo 3 CONCLUÍDO. Encontradas ${notificacoes.length} notificações e ${avisos.length} avisos.`);
        }

        // --- PASSO FINAL: Enviar tudo de volta para o frontend ---
        res.status(200).json({ turmas, notificacoes, avisos });

    } catch (error) {
        console.error("[DETETIVE] Erro no fluxo:", error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Falha ao buscar os dados do dashboard.', 
            details: error.response?.data || error.message 
        });
    }
});

module.exports = app;

