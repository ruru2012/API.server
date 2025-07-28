// /api/server.js
// Versão Final: Usa a informação de CD_ESCOLA diretamente da resposta do login.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// ROTA DE LOGIN (Inalterada)
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
    // Agora recebemos o token, codigoAluno e o codigoEscola do frontend
    const { token, codigoAluno, codigoEscola } = req.body;
    if (!token || !codigoAluno || codigoEscola === undefined) {
        return res.status(400).json({ error: 'Token, Código do Aluno e Código da Escola são necessários.' });
    }

    const authHeader = { 'Authorization': `Bearer ${token}` };

    try {
        // --- PASSO 1: Buscar Turmas com todos os dados corretos ---
        console.log(`[FINAL] Buscando turmas para aluno ${codigoAluno} na escola ${codigoEscola}...`);
        const anoLetivo = new Date().getFullYear();
        const turmasUrl = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${anoLetivo}&codigoEscola=${codigoEscola}`;
        
        const turmasResponse = await axios.get(turmasUrl, {
            headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab' }
        });

        if (!turmasResponse.data.isSucess) {
             throw new Error("A busca por turmas não foi bem-sucedida.");
        }
        const turmas = turmasResponse.data.data || [];
        console.log(`[FINAL] Encontradas ${turmas.length} turmas.`);

        // --- PASSO 2: Buscar Mensagens e Avisos (se houver turmas) ---
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

        // --- PASSO FINAL: Enviar tudo de volta para o frontend ---
        res.status(200).json({ turmas, notificacoes, avisos });

    } catch (error) {
        console.error("[FINAL] Erro no fluxo:", error.response?.data || error.message);
        res.status(400).json({ 
            error: 'Falha ao buscar os dados do dashboard.', 
            details: error.message 
        });
    }
});

module.exports = app;

