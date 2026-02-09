// CONFIGURAÇÃO DO SUPABASE - SUAS CONFIGURAÇÕES
const SUPABASE_URL = 'https://dhbavpdhdsixjnlfzpca.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoYmF2cGRoZHNpeGpubGZ6cGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjQxNjksImV4cCI6MjA4NTY0MDE2OX0.5HwmEVr9UwvSZCoLPvfnGT3GxrDLepjQFK0jRoGYej0';
const TABLE_NAME = 'transferencias';
const SENHA_ADMIN = '123456'; // SENHA PARA EXCLUIR TRANSFERÊNCIAS

// Estado da aplicação
let transferencias = [];
let transferenciaParaExcluir = null;
let clienteSupabase = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado. Iniciando aplicação...');
    
    // Criar cliente Supabase
    try {
        clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Cliente Supabase criado com sucesso');
    } catch (error) {
        console.error('Erro ao criar cliente Supabase:', error);
        atualizarStatusConexao('Erro na configuração do banco', 'error');
        return;
    }
    
    // Definir data atual como padrão
    const dataInput = document.getElementById('data');
    if (dataInput) {
        const hoje = new Date();
        const dataFormatada = hoje.toISOString().split('T')[0];
        dataInput.value = dataFormatada;
    }
    
    // Configurar eventos dos formulários
    document.getElementById('form-transferencia').addEventListener('submit', function(event) {
        registrarTransferencia(event);
    });
    
    document.getElementById('btn-limpar').addEventListener('click', limparFormulario);
    
    // Configurar eventos dos botões dos modais
    document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('btn-confirmar').addEventListener('click', function() {
        console.log('Botão "Sim, Excluir" clicado, ID:', transferenciaParaExcluir);
        if (transferenciaParaExcluir) {
            confirmarExclusao();
        } else {
            console.error('ID nulo ao tentar excluir');
            mostrarToast('Erro: Transferência não encontrada', 'error', 3000);
        }
    });
    
    document.getElementById('btn-cancelar-senha').addEventListener('click', function() {
        // Só limpa o input, não reseta a variável
        document.getElementById('modal-senha').style.display = 'none';
        document.getElementById('senha-admin').value = '';
    });
    
    document.getElementById('btn-verificar-senha').addEventListener('click', verificarSenha);
    
    // Enter na senha
    document.getElementById('senha-admin').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verificarSenha();
        }
    });
    
    // Fechar modal ao clicar fora
    document.getElementById('confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            fecharModal();
        }
    });
    
    document.getElementById('modal-senha').addEventListener('click', function(e) {
        if (e.target === this) {
            // Só fecha, não reseta a variável
            document.getElementById('modal-senha').style.display = 'none';
            document.getElementById('senha-admin').value = '';
        }
    });
    
    // Atualizar estilização dos radios
    document.querySelectorAll('input[name="transferencia"]').forEach(radio => {
        radio.addEventListener('change', atualizarEstiloRadios);
    });
    
    atualizarEstiloRadios();
    
    // Conectar ao Supabase
    inicializarSupabase();
});

// Inicializar conexão com Supabase
async function inicializarSupabase() {
    if (!clienteSupabase) {
        console.error('Supabase não inicializado');
        atualizarStatusConexao('Erro: Supabase não inicializado', 'error');
        return;
    }
    
    atualizarStatusConexao('Conectando ao banco de dados...', 'connecting');
    
    try {
        console.log('Testando conexão com Supabase...');
        
        // Testar conexão com um timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na conexão')), 10000)
        );
        
        const connectionPromise = clienteSupabase
            .from(TABLE_NAME)
            .select('id')
            .limit(1)
            .maybeSingle();
        
        const { data, error } = await Promise.race([connectionPromise, timeoutPromise]);
        
        if (error && error.code !== 'PGRST116') {
            console.error('Erro na conexão:', error);
            throw error;
        }
        
        console.log('Conexão bem-sucedida! Carregando dados...');
        
        // Carregar dados
        await carregarDados();
        
        // Escutar por mudanças em tempo real
        configurarEscutaTempoReal();
        
        atualizarStatusConexao('Conectado ao banco de dados ✓', 'connected');
        mostrarToast('Sistema conectado! Dados sincronizados.', 'success', 3000);
        
    } catch (error) {
        console.error('Erro ao conectar com Supabase:', error);
        atualizarStatusConexao('Erro na conexão. Verifique as configurações.', 'error');
        mostrarToast('Erro ao conectar com o banco de dados', 'error', 3000);
        
        // Tentar carregar dados locais se houver
        const dadosLocais = localStorage.getItem('transferencias_backup');
        if (dadosLocais) {
            try {
                transferencias = JSON.parse(dadosLocais);
                atualizarInterface();
                mostrarToast('Usando dados locais (modo offline)', 'warning', 3000);
            } catch (e) {
                console.error('Erro ao carregar dados locais:', e);
            }
        }
    }
}

// Carregar dados do Supabase
async function carregarDados() {
    if (!clienteSupabase) {
        console.error('Supabase não inicializado para carregar dados');
        return;
    }
    
    try {
        console.log('Carregando dados do Supabase...');
        
        const { data, error } = await clienteSupabase
            .from(TABLE_NAME)
            .select('*')
            .order('data', { ascending: false });
        
        if (error) {
            console.error('Erro ao carregar dados:', error);
            throw error;
        }
        
        transferencias = data || [];
        console.log(`Dados carregados: ${transferencias.length} transferências`);
        
        // Salvar backup local
        localStorage.setItem('transferencias_backup', JSON.stringify(transferencias));
        
        atualizarInterface();
        atualizarUltimaAtualizacao();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarToast('Erro ao carregar dados do banco', 'error', 3000);
        throw error;
    }
}

// Configurar escuta em tempo real
function configurarEscutaTempoReal() {
    if (!clienteSupabase) {
        console.error('Supabase não inicializado para escuta em tempo real');
        return;
    }
    
    console.log('Configurando escuta em tempo real...');
    
    clienteSupabase
        .channel('transferencias-channel')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: TABLE_NAME 
            }, 
            async (payload) => {
                console.log('Mudança detectada no banco:', payload.eventType);
                
                // Recarregar dados quando houver mudanças
                await carregarDados();
                
                // Mostrar notificação
                if (payload.eventType === 'INSERT') {
                    mostrarToast('Nova transferência registrada!', 'info', 2000);
                } else if (payload.eventType === 'DELETE') {
                    mostrarToast('Transferência excluída!', 'warning', 2000);
                }
                
                atualizarUltimaAtualizacao();
            }
        )
        .subscribe((status) => {
            console.log('Status da escuta em tempo real:', status);
        });
}

// Registrar nova transferência
async function registrarTransferencia(event) {
    event.preventDefault();
    
    if (!clienteSupabase) {
        mostrarToast('Erro: Banco de dados não conectado', 'error', 3000);
        return;
    }
    
    // Obter valores
    const direcao = document.querySelector('input[name="transferencia"]:checked').value;
    const valorInput = document.getElementById('valor');
    const valor = parseFloat(valorInput.value);
    const descricao = document.getElementById('descricao').value;
    const data = document.getElementById('data').value;
    
    // Validações
    if (!direcao || !valor || !data) {
        mostrarToast('Preencha todos os campos obrigatórios', 'error', 3000);
        return;
    }
    
    if (valor <= 0) {
        mostrarToast('O valor deve ser maior que zero', 'error', 3000);
        return;
    }
    
    if (isNaN(valor)) {
        mostrarToast('Valor inválido', 'error', 3000);
        return;
    }
    
    // Preparar dados
    const transferencia = {
        direcao,
        valor,
        descricao: descricao || null,
        data
    };
    
    console.log('Registrando transferência:', transferencia);
    
    // Obter referência ao botão ANTES do try-catch
    const btnRegistrar = document.getElementById('btn-registrar');
    const originalText = btnRegistrar ? btnRegistrar.innerHTML : '<i class="fas fa-save"></i> Registrar Transferência';
    
    try {
        // Desabilitar botão durante o salvamento
        if (btnRegistrar) {
            btnRegistrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btnRegistrar.disabled = true;
        }
        
        // Enviar para o Supabase
        const { data: novaTransferencia, error } = await clienteSupabase
            .from(TABLE_NAME)
            .insert([transferencia])
            .select();
        
        if (error) {
            console.error('Erro do Supabase:', error);
            throw error;
        }
        
        console.log('Transferência salva com sucesso:', novaTransferencia);
        
        // Mostrar mensagem de sucesso específica
        const quem = direcao === 'caio-para-itallo' ? 'Caio' : 'Itallo';
        const paraQuem = direcao === 'caio-para-itallo' ? 'Itallo' : 'Caio';
        mostrarToast(`✅ Transferência de R$ ${valor.toFixed(2).replace('.', ',')} registrada! (${quem} → ${paraQuem})`, 'success', 4000);
        
        // Atualizar interface imediatamente
        await carregarDados();
        
        // Limpar apenas o valor e descrição
        valorInput.value = '';
        document.getElementById('descricao').value = '';
        
    } catch (error) {
        console.error('Erro ao salvar transferência:', error);
        
        if (error.message.includes('network') || error.message.includes('fetch')) {
            mostrarToast('Erro de rede. Verifique sua conexão.', 'error', 3000);
        } else if (error.message.includes('JWT')) {
            mostrarToast('Erro de autenticação. Verifique a chave API.', 'error', 3000);
        } else {
            mostrarToast('Erro ao salvar no banco de dados: ' + error.message, 'error', 3000);
        }
        
        // Salvar localmente em caso de erro
        const idTemporario = Date.now();
        transferencias.unshift({
            id: idTemporario,
            ...transferencia,
            created_at: new Date().toISOString()
        });
        localStorage.setItem('transferencias_backup', JSON.stringify(transferencias));
        atualizarInterface();
        mostrarToast('Transferência salva localmente (modo offline)', 'warning', 3000);
        
    } finally {
        // Reabilitar botão
        if (btnRegistrar) {
            btnRegistrar.innerHTML = originalText;
            btnRegistrar.disabled = false;
        }
    }
}

// Solicitar exclusão de uma transferência
function solicitarExclusao(id) {
    console.log('Solicitando exclusão do ID:', id);
    transferenciaParaExcluir = id;
    
    // Encontrar a transferência para mostrar detalhes
    const transferencia = transferencias.find(t => t.id === id);
    if (transferencia) {
        const quem = transferencia.direcao === 'caio-para-itallo' ? 'Caio' : 'Itallo';
        const paraQuem = transferencia.direcao === 'caio-para-itallo' ? 'Itallo' : 'Caio';
        const valor = formatarMoeda(parseFloat(transferencia.valor));
        
        // Mostrar modal de senha com detalhes
        document.getElementById('mensagem-senha').innerHTML = 
            `Digite a senha para excluir a transferência:<br>
            <strong>${quem} → ${paraQuem} - ${valor}</strong>`;
    }
    
    // Mostrar modal de senha
    document.getElementById('modal-senha').style.display = 'flex';
    document.getElementById('senha-admin').focus();
    document.getElementById('senha-admin').value = '';
}

// Verificar senha
function verificarSenha() {
    const senhaDigitada = document.getElementById('senha-admin').value;
    
    if (senhaDigitada === SENHA_ADMIN) {
        // Senha correta, mostrar modal de confirmação
        document.getElementById('modal-senha').style.display = 'none';
        document.getElementById('senha-admin').value = '';
        
        const transferencia = transferencias.find(t => t.id === transferenciaParaExcluir);
        if (transferencia) {
            const quem = transferencia.direcao === 'caio-para-itallo' ? 'Caio' : 'Itallo';
            const paraQuem = transferencia.direcao === 'caio-para-itallo' ? 'Itallo' : 'Caio';
            const valor = formatarMoeda(parseFloat(transferencia.valor));
            
            document.getElementById('confirm-message').innerHTML = 
                `Tem certeza que deseja excluir esta transferência?<br>
                <strong>${quem} → ${paraQuem} - ${valor}</strong>`;
        }
        
        document.getElementById('confirm-modal').style.display = 'flex';
    } else {
        mostrarToast('Senha incorreta!', 'error', 3000);
        document.getElementById('senha-admin').value = '';
        document.getElementById('senha-admin').focus();
    }
}

// Confirmar exclusão após senha correta
async function confirmarExclusao() {
    console.log('Confirmar exclusão chamado para ID:', transferenciaParaExcluir);
    
    if (!transferenciaParaExcluir) {
        console.error('Nenhuma transferência selecionada para exclusão');
        mostrarToast('Erro: Transferência não encontrada', 'error', 3000);
        fecharModal();
        return;
    }
    
    if (!clienteSupabase) {
        mostrarToast('Erro: Banco de dados não conectado', 'error', 3000);
        fecharModal();
        return;
    }
    
    console.log('Excluindo transferência ID:', transferenciaParaExcluir);
    
    try {
        const { error } = await clienteSupabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', transferenciaParaExcluir);
        
        if (error) {
            console.error('Erro ao excluir do Supabase:', error);
            throw error;
        }
        
        // Mostrar mensagem de sucesso
        const transferenciaExcluida = transferencias.find(t => t.id === transferenciaParaExcluir);
        if (transferenciaExcluida) {
            const valor = formatarMoeda(parseFloat(transferenciaExcluida.valor));
            mostrarToast(`✅ Transferência de ${valor} excluída com sucesso!`, 'success', 3000);
        }
        
        // Atualizar interface imediatamente
        await carregarDados();
        
        // Fechar modal após exclusão
        fecharModal();
        
    } catch (error) {
        console.error('Erro ao excluir transferência:', error);
        mostrarToast('Erro ao excluir do banco de dados', 'error', 3000);
        
        // Remover localmente em caso de erro
        transferencias = transferencias.filter(t => t.id !== transferenciaParaExcluir);
        localStorage.setItem('transferencias_backup', JSON.stringify(transferencias));
        atualizarInterface();
        mostrarToast('Transferência removida localmente', 'warning', 3000);
        
        // Fechar modal mesmo com erro
        fecharModal();
    }
}

// Fechar modal de confirmação
function fecharModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    // Só resetar após a exclusão ser processada
    setTimeout(() => {
        transferenciaParaExcluir = null;
    }, 100);
}

// Atualizar status da conexão
function atualizarStatusConexao(mensagem, status) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.innerHTML = `<i class="fas fa-circle"></i> <span>${mensagem}</span>`;
        statusElement.className = `connection-status ${status}`;
    }
}

// Atualizar última atualização
function atualizarUltimaAtualizacao() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    const updateElement = document.getElementById('last-update');
    if (updateElement) {
        updateElement.innerHTML = `<i class="fas fa-clock"></i> <span>Atualizado: ${timeString}</span>`;
    }
}

// Atualizar interface completa
function atualizarInterface() {
    calcularSaldos();
    atualizarHistorico();
}

// Calcular saldos (ACUMULATIVO)
function calcularSaldos() {
    let saldoCaio = 0;
    let saldoItallo = 0;
    let valorTotal = 0;
    
    // Calcular saldos acumulados
    transferencias.forEach(transf => {
        const valor = parseFloat(transf.valor);
        valorTotal += valor;
        
        if (transf.direcao === 'caio-para-itallo') {
            // Caio transferiu para Itallo = Caio ganha +, Itallo perde -
            saldoCaio += valor;
            saldoItallo -= valor;
        } else {
            // Itallo transferiu para Caio = Itallo ganha +, Caio perde -
            saldoItallo += valor;
            saldoCaio -= valor;
        }
    });
    
    // Atualizar saldos na interface
    const saldoCaioElement = document.getElementById('saldo-caio');
    const saldoItalloElement = document.getElementById('saldo-itallo');
    
    if (saldoCaioElement) {
        saldoCaioElement.textContent = formatarMoeda(saldoCaio);
        saldoCaioElement.className = 'resumo-valor ' + (saldoCaio >= 0 ? 'positivo' : 'negativo');
    }
    
    if (saldoItalloElement) {
        saldoItalloElement.textContent = formatarMoeda(saldoItallo);
        saldoItalloElement.className = 'resumo-valor ' + (saldoItallo >= 0 ? 'positivo' : 'negativo');
    }
    
    // Atualizar estatísticas
    const totalElement = document.getElementById('total-transferencias');
    const valorTotalElement = document.getElementById('valor-total');
    
    if (totalElement) {
        totalElement.textContent = `${transferencias.length} transferência${transferencias.length !== 1 ? 's' : ''}`;
    }
    
    if (valorTotalElement) {
        valorTotalElement.textContent = `Total: ${formatarMoeda(valorTotal)}`;
    }
}

// Atualizar histórico
function atualizarHistorico() {
    const listaElement = document.getElementById('lista-transferencias');
    const semDadosElement = document.getElementById('sem-dados');
    
    if (!listaElement || !semDadosElement) return;
    
    listaElement.innerHTML = '';
    
    if (transferencias.length === 0) {
        semDadosElement.style.display = 'block';
        return;
    }
    
    semDadosElement.style.display = 'none';
    
    // Ordenar por data (mais recente primeiro)
    const transferenciasOrdenadas = [...transferencias].sort((a, b) => {
        const dataA = new Date(a.data || a.created_at);
        const dataB = new Date(b.data || b.created_at);
        return dataB - dataA;
    });
    
    transferenciasOrdenadas.forEach((transf) => {
        const div = document.createElement('div');
        div.className = `transferencia-item ${transf.direcao === 'caio-para-itallo' ? 'caio' : 'itallo'}`;
        
        // Formatar data
        const dataObj = new Date(transf.data || transf.created_at);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        
        // Determinar texto
        const quemTransferiu = transf.direcao === 'caio-para-itallo' ? 'Caio' : 'Itallo';
        const paraQuem = transf.direcao === 'caio-para-itallo' ? 'Itallo' : 'Caio';
        const sinal = transf.direcao === 'caio-para-itallo' ? '+' : '-';
        
        div.innerHTML = `
            <div class="transferencia-header">
                <div class="transferencia-direcao ${quemTransferiu.toLowerCase()}">
                    <i class="fas fa-arrow-right"></i> ${quemTransferiu} → ${paraQuem}
                </div>
                <div class="transferencia-data">
                    <i class="far fa-calendar"></i> ${dataFormatada}
                </div>
            </div>
            <div class="transferencia-valor">
                <span class="valor-sinal">${sinal}</span> ${formatarMoeda(parseFloat(transf.valor))}
            </div>
            ${transf.descricao ? `<div class="transferencia-descricao"><i class="far fa-comment"></i> ${transf.descricao}</div>` : ''}
            <div class="transferencia-acoes">
                <button class="btn-excluir" onclick="solicitarExclusao(${transf.id})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;
        
        listaElement.appendChild(div);
    });
}

// Atualizar estilo dos radios
function atualizarEstiloRadios() {
    const radios = document.querySelectorAll('.radio-option');
    radios.forEach(radio => {
        radio.classList.remove('caio-selecionado', 'itallo-selecionado');
    });
    
    const selecionado = document.querySelector('input[name="transferencia"]:checked');
    if (selecionado) {
        const radioOption = selecionado.closest('.radio-option');
        if (selecionado.value === 'caio-para-itallo') {
            radioOption.classList.add('caio-selecionado');
        } else {
            radioOption.classList.add('itallo-selecionado');
        }
    }
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('valor').value = '';
    document.getElementById('descricao').value = '';
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0];
    document.getElementById('data').value = dataFormatada;
    atualizarEstiloRadios();
}

// Formatar moeda
function formatarMoeda(valor) {
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

// Mostrar toast
function mostrarToast(mensagem, tipo = 'info', duracao = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = mensagem;
    toast.className = 'toast show';
    
    // Cores baseadas no tipo
    const cores = {
        'success': '#27ae60',
        'error': '#e74c3c',
        'warning': '#f39c12',
        'info': '#3498db'
    };
    
    toast.style.backgroundColor = cores[tipo] || '#333';
    
    setTimeout(() => {
        toast.className = 'toast';
    }, duracao);
}

// Exportar funções para uso global
window.solicitarExclusao = solicitarExclusao;