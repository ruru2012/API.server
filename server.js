// Importa as bibliotecas necessárias
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// Inicializa o aplicativo Express
const app = express();
const PORT = 3000; // A porta em que nosso servidor irá rodar

// --- Middlewares ---
// Habilita o CORS para permitir que o frontend acesse este servidor
app.use(cors());
// Permite que o servidor entenda requisições com corpo em JSON
app.use(express.json());

// --- Constantes da API da SEDUC ---
const API_BASE_URL = 'https://sedintegracoes.educacao.sp.gov.br';
const LOGIN_API_KEY = '2b03c1db3884488795f79c37c069381a';
const TURMAS_API_KEY = '5936fddda3484fe1aa4436df1bd76dab';

// --- Rotas da Nossa API ---

/**
 * Rota de Login
 * Recebe 'ra' e 'senha' do frontend, faz o login na API da SEDUC
 * e retorna os dados do aluno.
 */
app.post('/api/login', async (req, res) => {
    // Pega o 'ra' e a 'senha' do corpo da requisição enviada pelo frontend
    const { ra, senha } = req.body;

    if (!ra || !senha) {
        return res.status(400).json({ message: 'RA e senha são obrigatórios.' });
    }

    // Monta o payload para a API da SEDUC
    const loginPayload = {
        user: `${ra}SP`,
        senha: senha
    };

    console.log(`[LOG] Tentando login para o usuário: ${loginPayload.user}`);

    try {
        // Faz a chamada POST para a API de login da SEDUC usando axios
        const response = await axios.post(
            `${API_BASE_URL}/credenciais/api/LoginCompletoToken`,
            loginPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': LOGIN_API_KEY
                }
            }
        );

        console.log('[LOG] Login bem-sucedido na API da SEDUC.');
        // Envia a resposta da API da SEDUC de volta para o frontend
        res.json(response.data);

    } catch (error) {
        console.error('[ERRO] Falha no login:', error.response ? error.response.data : error.message);
        // Se a API da SEDUC retornar um erro (ex: 401, 403), repassa o status e a mensagem
        const status = error.response ? error.response.status : 500;
        const data = error.response ? error.response.data : { message: 'Erro interno no servidor proxy.' };
        res.status(status).json(data);
    }
});

/**
 * Rota de Turmas
 * Recebe 'codigoAluno' como parâmetro, busca as turmas na API da SEDUC
 * e retorna a lista.
 */
app.get('/api/turmas', async (req, res) => {
    const { codigoAluno } = req.query;

    if (!codigoAluno) {
        return res.status(400).json({ message: 'O código do aluno é obrigatório.' });
    }

    console.log(`[LOG] Buscando turmas para o código de aluno: ${codigoAluno}`);

    try {
        // Faz a chamada GET para a API de turmas da SEDUC
        const response = await axios.get(
            `${API_BASE_URL}/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}`,
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': TURMAS_API_KEY
                }
            }
        );
        
        console.log('[LOG] Turmas encontradas com sucesso.');
        // Envia a resposta (lista de turmas) de volta para o frontend
        res.json(response.data);

    } catch (error) {
        console.error('[ERRO] Falha ao buscar turmas:', error.response ? error.response.data : error.message);
        const status = error.response ? error.response.status : 500;
        const data = error.response ? error.response.data : { message: 'Erro interno no servidor proxy.' };
        res.status(status).json(data);
    }
});


// Inicia o servidor para ouvir na porta definida
app.listen(PORT, () => {
    console.log(`Servidor proxy rodando em http://localhost:${PORT}`);
    console.log('Aguardando requisições do frontend...');
});

