// CONFIGURAÇÃO DO SUPABASE - SUAS CONFIGURAÇÕES
const SUPABASE_URL = 'https://dhbavpdhdsixjnlfzpca.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoYmF2cGRoZHNpeGpubGZ6cGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjQxNjksImV4cCI6MjA4NTY0MDE2OX0.5HwmEVr9UwvSZCoLPvfnGT3GxrDLepjQFK0jRoGYej0';
const TABLE_NAME = 'transferencias';

// Estado da aplicação
let transferencias = [];
let transferenciaParaExcluir = null;

// Inicialização - AQUI criamos o cliente Supabase
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado. Iniciando aplicação...');
    
    // Criar cliente Supabase DENTRO do evento DOMContentLoaded
    let supabase;
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    
    // Configurar eventos
    document.getElementById('form-transferencia').addEventListener('submit', function(event) {
        registrarTransferencia(event, supabase);
    });
    document.getElementById('btn-limpar').addEventListener('click', limparFormulario);
    document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('btn-confirmar').addEventListener('click', function() {
        confirmarExclusao(supabase);
    });
    
    // Fechar modal ao clicar fora
    document.getElementById('confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });
    
    // Atualizar estilização dos radios
    document.querySelectorAll('input[name="transferencia"]').forEach(radio => {
        radio.addEventListener('change', atualizarEstiloRadios);
    });
    
    atualizarEstiloRadios();
    
    // Conectar ao Supabase
    inicializarSupabase(supabase);
});

// Inicializar conexão com Supabase
async function inicializarSupabase(supabase) {
    atualizarStatusConexao('Conectando ao banco de dados...', 'connecting');
    
    try {
        console.log('Testando conexão com Supabase...');
        
        // Testar conexão com um timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na conexão')), 10000)
        );
        
        const connectionPromise = supabase
            .from(TABLE_NAME)
            .select('id')
            .limit(1)
            .maybeSingle();
        
        const { data, error } = await Promise.race([connectionPromise, timeoutPromise]);
        
        if (error && error.code !== 'PGRST116') { // PGRST116 é "no rows returned", que é OK
            console.error('Erro na conexão:', error);
            throw error;
        }
        
        console.log('Conexão bem-sucedida! Carregando dados...');
        
        // Carregar dados
        await carregarDados(supabase);
        
        // Escutar por mudanças em tempo real
        configurarEscutaTempoReal(supabase);
        
        atualizarStatusConexao('Conectado ao banco de dados ✓', 'connected');
        mostrarToast('Sistema conectado! Dados sincronizados.', 'success');
        
    } catch (error) {
        console.error('Erro ao conectar com Supabase:', error);
        atualizarStatusConexao('Erro na conexão. Verifique as configurações.', 'error');
        mostrarToast('Erro ao conectar com o banco de dados', 'error');
        
        // Tentar carregar dados locais se houver
        const dadosLocais = localStorage.getItem('transferencias_backup');
        if (dadosLocais) {
            try {
                transferencias = JSON.parse(dadosLocais);
                atualizarInterface();
                mostrarToast('Usando dados locais (modo offline)', 'warning');
            } catch (e) {
                console.error('Erro ao carregar dados locais:', e);
            }
        }
    }
}

// Carregar dados do Supabase
async function carregarDados(supabase) {
    try {
        console.log('Carregando dados do Supabase...');
        
        const { data, error } = await supabase
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
        mostrarToast('Erro ao carregar dados do banco', 'error');
        throw error;
    }
}

// Configurar escuta em tempo real
function configurarEscutaTempoReal(supabase) {
    console.log('Configurando escuta em tempo real...');
    
    const channel = supabase
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
                await carregarDados(supabase);
                
                // Mostrar notificação
                if (payload.eventType === 'INSERT') {
                    mostrarToast('Nova transferência registrada!', 'info');
                } else if (payload.eventType === 'DELETE') {
                    mostrarToast('Transferência excluída!', 'warning');
                } else if (payload.eventType === 'UPDATE') {
                    mostrarToast('Transferência atualizada!', 'info');
                }
                
                atualizarUltimaAtualizacao();
            }
        )
        .subscribe((status) => {
            console.log('Status da escuta em tempo real:', status);
        });
}

// Registrar nova transferência
async function registrarTransferencia(event, supabase) {
    event.preventDefault();
    
    // Obter valores
    const direcao = document.querySelector('input[name="transferencia"]:checked').value;
    const valorInput = document.getElementById('valor');
    const valor = parseFloat(valorInput.value);
    const descricao = document.getElementById('descricao').value;
    const data = document.getElementById('data').value;
    
    // Validações
    if (!direcao || !valor || !data) {
        mostrarToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    if (valor <= 0) {
        mostrarToast('O valor deve ser maior que zero', 'error');
        return;
    }
    
    if (isNaN(valor)) {
        mostrarToast('Valor inválido', 'error');
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
        const { data: novaTransferencia, error } = await supabase
            .from(TABLE_NAME)
            .insert([transferencia])
            .select();
        
        if (error) {
            console.error('Erro do Supabase:', error);
            throw error;
        }
        
        console.log('Transferência salva com sucesso:', novaTransferencia);
        mostrarToast('Transferência registrada com sucesso!', 'success');
        
        // Limpar apenas o valor e descrição, manter data e direção
        valorInput.value = '';
        document.getElementById('descricao').value = '';
        
    } catch (error) {
        console.error('Erro ao salvar transferência:', error);
        
        if (error.message.includes('network') || error.message.includes('fetch')) {
            mostrarToast('Erro de rede. Verifique sua conexão.', 'error');
        } else if (error.message.includes('JWT')) {
            mostrarToast('Erro de autenticação. Verifique a chave API.', 'error');
        } else {
            mostrarToast('Erro ao salvar no banco de dados: ' + error.message, 'error');
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
        mostrarToast('Transferência salva localmente (modo offline)', 'warning');
        
    } finally {
        // Reabilitar botão
        if (btnRegistrar) {
            btnRegistrar.innerHTML = originalText;
            btnRegistrar.disabled = false;
        }
    }
}

// Confirmar exclusão
async function confirmarExclusao(supabase) {
    if (!transferenciaParaExcluir) return;
    
    console.log('Excluindo transferência ID:', transferenciaParaExcluir);
    
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', transferenciaParaExcluir);
        
        if (error) throw error;
        
        mostrarToast('Transferência excluída com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao excluir transferência:', error);
        mostrarToast('Erro ao excluir do banco de dados', 'error');
        
        // Remover localmente em caso de erro
        transferencias = transferencias.filter(t => t.id !== transferenciaParaExcluir);
        localStorage.setItem('transferencias_backup', JSON.stringify(transferencias));
        atualizarInterface();
        mostrarToast('Transferência removida localmente', 'warning');
    } finally {
        fecharModal();
        transferenciaParaExcluir = null;
    }
}

// As outras funções permanecem iguais...
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

// Solicitar exclusão
function solicitarExclusao(id) {
    transferenciaParaExcluir = id;
    
    // Mostrar modal
    document.getElementById('confirm-modal').style.display = 'flex';
}

// Fechar modal
function fecharModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    transferenciaParaExcluir = null;
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
function mostrarToast(mensagem, tipo = 'info') {
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
    }, 3000);
}

// Exportar funções para uso global
window.solicitarExclusao = solicitarExclusao;