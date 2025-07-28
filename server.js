const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Constantes das APIs ---
const SED_API_URL = 'https://sedintegracoes.educacao.sp.gov.br';
const EDUSP_API_URL = 'https://edusp-api.ip.tv';

const LOGIN_API_KEY = '2b03c1db3884488795f79c37c069381a';
const TURMAS_API_KEY = '5936fddda3484fe1aa4436df1bd76dab';

// --- Rotas ---

// Rota de Login (SEDUC) - Sem alterações
app.post('/api/login', async (req, res) => {
    const { ra, senha } = req.body;
    if (!ra || !senha) return res.status(400).json({ message: 'RA e senha são obrigatórios.' });
    try {
        const response = await axios.post(`${SED_API_URL}/credenciais/api/LoginCompletoToken`, 
            { user: `${ra}SP`, senha }, 
            { headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': LOGIN_API_KEY } }
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro no proxy.' });
    }
});

// Rota de Turmas (SEDUC) - Sem alterações
app.get('/api/turmas', async (req, res) => {
    const { codigoAluno } = req.query;
    if (!codigoAluno) return res.status(400).json({ message: 'Código do aluno é obrigatório.' });
    try {
        const response = await axios.get(`${SED_API_URL}/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}`, 
            { headers: { 'Ocp-Apim-Subscription-Key': TURMAS_API_KEY } }
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro no proxy.' });
    }
});

// NOVA ROTA: Troca o token de login pela chave da API EDUSP
app.post('/api/edusp-token', async (req, res) => {
    const { loginToken } = req.body;
    if (!loginToken) return res.status(400).json({ message: 'Token de login é obrigatório.' });
    try {
        const response = await axios.post(`${EDUSP_API_URL}/registration/edusp/token`, 
            { token: loginToken },
            { headers: { 'x-api-realm': 'edusp', 'x-api-platform': 'webclient' } }
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro no proxy.' });
    }
});

// ROTA ATUALIZADA: Busca as tarefas reais na API EDUSP
app.post('/api/tarefas', async (req, res) => {
    const { apiKey, turmas, nickname } = req.body;
    if (!apiKey || !turmas) return res.status(400).json({ message: 'Chave de API e lista de turmas são obrigatórias.' });

    // Constrói a lista de "publication_target" a partir dos dados das turmas
    const publicationTargets = new URLSearchParams();
    turmas.forEach(turma => {
        // A API parece usar vários IDs da turma. Adicionamos os que temos.
        if (turma.id) publicationTargets.append('publication_target', turma.id);
        if (turma.codigo) publicationTargets.append('publication_target', turma.codigo);
        if (turma.turmaId) publicationTargets.append('publication_target', turma.turmaId);
        
        // Adiciona o alvo específico do usuário para a turma, se o nickname estiver disponível
        if (turma.id && nickname) {
            publicationTargets.append('publication_target', `${turma.id}:${nickname}`);
        }
    });

    const queryString = `expired_only=false&limit=100&offset=0&filter_expired=true&is_exam=false&with_answer=true&is_essay=false&${publicationTargets.toString()}&with_apply_moment=true`;
    const fullUrl = `${EDUSP_API_URL}/tms/task/todo?${queryString}`;
    
    console.log(`[LOG] Buscando tarefas com URL: ${fullUrl}`);

    try {
        const response = await axios.get(fullUrl, {
            headers: {
                'accept': 'application/json',
                'x-api-key': apiKey,
                'x-api-realm': 'edusp',
                'x-api-platform': 'webclient'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('[ERRO] Falha ao buscar tarefas:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro ao buscar tarefas no servidor proxy.' });
    }
});

app.listen(PORT, () => console.log(`Servidor proxy rodando na porta ${PORT}`));

            
